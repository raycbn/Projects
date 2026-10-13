import type { Env } from './types'
import { json, resolveAppUrl } from './types'
import { verifyFirebaseIdToken } from './firebaseAuth'
import {
  readSubscriptionCustomerId,
  readSubscriptionRecord,
  upsertSubscriptionAndPlan,
  writeSubscriptionCustomerId,
  claimWebhookEvent,
  markWebhookEventProcessed,
  claimCheckoutLock,
  finalizeCheckoutLock,
  releaseCheckoutLock,
} from './firestore'
import { activateGrupetaPack, deactivateGrupetaPack, GRUPETA_SEAT_LIMIT } from './grupetaPack'

async function stripeForm(
  env: Env,
  path: string,
  params: Record<string, string>,
  idempotencyKey?: string,
): Promise<Response> {
  const body = new URLSearchParams(params)
  return fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body,
  })
}

async function stripeGet(env: Env, path: string): Promise<Response> {
  return fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  })
}

/** Read-only readiness check; never creates customers, sessions, or payments. */
export async function handleStripeReadiness(env: Env): Promise<Response> {
  const secret = env.STRIPE_SECRET_KEY?.trim() ?? ''
  const mode = secret.startsWith('sk_live_')
    ? 'live'
    : secret.startsWith('sk_test_')
      ? 'test'
      : 'unknown'
  const priceIds = [
    ['soloMonthly', env.STRIPE_PRICE_MONTHLY],
    ['soloYearly', env.STRIPE_PRICE_YEARLY],
    ['grupetaMonthly', env.STRIPE_PRICE_GRUPETA_MONTHLY],
    ['grupetaYearly', env.STRIPE_PRICE_GRUPETA_YEARLY],
  ] as const
  const missingPrices = priceIds.filter(([, id]) => !id?.trim()).map(([name]) => name)
  if (!secret || mode !== 'live' || missingPrices.length > 0) {
    return json(
      { ok: false, mode, secretConfigured: Boolean(secret), missingPrices },
      503,
      { 'Cache-Control': 'no-store' },
    )
  }

  const prices = await Promise.all(
    priceIds.map(async ([name, id]) => {
      try {
        const response = await stripeGet(env, `prices/${encodeURIComponent(id!)}`)
        const price = (await response.json()) as {
          id?: string
          active?: boolean
          livemode?: boolean
        }
        return {
          name,
          valid: response.ok && price.id === id && price.active === true && price.livemode === true,
        }
      } catch {
        return { name, valid: false }
      }
    }),
  )
  const ok = prices.every((price) => price.valid)
  return json(
    { ok, mode: 'live', secretConfigured: true, missingPrices: [], prices },
    ok ? 200 : 503,
    { 'Cache-Control': 'no-store' },
  )
}

type CheckoutProduct = 'solo' | 'grupeta'

type StripeSubSummary = {
  id: string
  status: string
  product: CheckoutProduct
  hasTrialed: boolean
}

function resolvePriceId(
  env: Env,
  product: CheckoutProduct,
  interval: 'month' | 'year',
): string | undefined {
  if (product === 'grupeta') {
    return interval === 'year' ? env.STRIPE_PRICE_GRUPETA_YEARLY : env.STRIPE_PRICE_GRUPETA_MONTHLY
  }
  return interval === 'year' ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY
}

function isPayingStatus(status: string): boolean {
  // past_due: keep access while Stripe retries payment (grace), until canceled/unpaid.
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

export async function listCustomerSubscriptions(
  env: Env,
  customerId: string,
): Promise<StripeSubSummary[]> {
  const subscriptions: StripeSubSummary[] = []
  let startingAfter: string | undefined

  // Stripe paginates subscriptions. Never conclude "none active" based on only
  // the first page: a later page may hold the subscription that blocks checkout.
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({
      customer: customerId,
      status: 'all',
      limit: '100',
    })
    if (startingAfter) query.set('starting_after', startingAfter)

    const res = await stripeGet(env, `subscriptions?${query.toString()}`)
    const json = (await res.json()) as {
      data?: Array<{
        id: string
        status: string
        trial_end?: number | null
        metadata?: { product?: string }
      }>
      has_more?: boolean
    }
    if (!res.ok) {
      throw new Error(`Stripe subscription lookup failed: ${res.status}`)
    }
    if (!Array.isArray(json.data)) {
      throw new Error('Stripe subscription lookup returned an invalid response')
    }

    subscriptions.push(...json.data.map((s) => ({
      id: s.id,
      status: String(s.status || ''),
      product: (s.metadata?.product === 'grupeta' ? 'grupeta' : 'solo') as CheckoutProduct,
      hasTrialed: Boolean(s.trial_end),
    })))

    if (!json.has_more) return subscriptions
    const lastId = json.data[json.data.length - 1]?.id
    if (!lastId) {
      throw new Error('Stripe subscription pagination returned an empty page with has_more')
    }
    startingAfter = lastId
  }

  throw new Error('Stripe subscription lookup exceeded the safe pagination limit')
}

export async function findCustomerByFirebaseUid(
  env: Env,
  uid: string,
): Promise<string | undefined> {
  const res = await stripeGet(
    env,
    `customers/search?query=metadata['firebaseUid']:'${encodeURIComponent(uid)}'`,
  )
  const json = (await res.json()) as {
    data?: Array<{ id: string }>
  }
  if (!res.ok) {
    throw new Error(`Stripe customer lookup failed: ${res.status}`)
  }
  if (!Array.isArray(json.data)) {
    throw new Error('Stripe customer lookup returned an invalid response')
  }
  if (json.data.length === 0) return undefined
  return String(json.data[0].id)
}

export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe secret missing' }, 500)
  const identity = await verifyFirebaseIdToken(env, request.headers.get('Authorization'))
  if (identity.isAnonymous) {
    return json({ error: 'Se requiere una cuenta real', code: 'auth_required' }, 401)
  }
  const payload = (await request.json().catch(() => ({}))) as {
    interval?: string
    product?: string
  }
  const interval = payload.interval === 'year' ? 'year' : 'month'
  const product: CheckoutProduct = payload.product === 'grupeta' ? 'grupeta' : 'solo'
  const priceId = resolvePriceId(env, product, interval)
  if (!priceId) {
    return json(
      {
        error:
          product === 'grupeta'
            ? 'Pack Grupeta no configurado (faltan STRIPE_PRICE_GRUPETA_*).'
            : 'Price id not configured',
        code: 'price_missing',
      },
      500,
    )
  }

  let customerId = await readSubscriptionCustomerId(env, identity.uid)
  if (!customerId) {
    // Firestore may have lost the pointer after a prior successful Stripe create.
    // Search by the stable Firebase UID before making another Customer.
    customerId = await findCustomerByFirebaseUid(env, identity.uid)
    if (customerId) {
      await writeSubscriptionCustomerId(env, identity.uid, customerId)
    }
  }
  if (!customerId) {
    const customerRes = await stripeForm(
      env,
      'customers',
      {
        ...(identity.email ? { email: identity.email } : {}),
        'metadata[firebaseUid]': identity.uid,
      },
      `pedalmap-customer-${identity.uid}`,
    )
    const customer = (await customerRes.json()) as { id?: string; error?: { message?: string } }
    if (!customerRes.ok || !customer.id) {
      return json({ error: customer.error?.message || 'Could not create Stripe customer' }, 502)
    }
    customerId = customer.id
    await writeSubscriptionCustomerId(env, identity.uid, customerId)
  }

  const existingSubs = await listCustomerSubscriptions(env, customerId)
  const paying = existingSubs.filter((s) => isPayingStatus(s.status))
  if (paying.length > 0) {
    return json(
      {
        error:
          'Ya tienes una suscripción activa o en prueba. Gestiona o cancela en el portal antes de contratar otra.',
        code: 'already_subscribed',
      },
      409,
    )
  }

  let lockToken: string
  const lockClaim = await claimCheckoutLock(env, identity.uid, product, interval)
  if (lockClaim.kind === 'in_progress') {
    return json(
      { error: 'Ya hay una compra en curso para esta cuenta. Inténtalo de nuevo en unos segundos.', code: 'checkout_in_progress' },
      409,
    )
  }

  if (lockClaim.kind === 'existing_session') {
    const currentRes = await stripeGet(env, `checkout/sessions/${encodeURIComponent(lockClaim.sessionId)}`)
    const current = (await currentRes.json()) as { status?: string; url?: string; error?: { message?: string } }
    if (!currentRes.ok || !current.status) {
      return json({ error: 'No se pudo verificar la sesión Checkout existente.', code: 'checkout_unavailable' }, 503)
    }
    if (current.status === 'open') {
      if (lockClaim.product !== product || lockClaim.interval !== interval) {
        // The user explicitly requested a different plan/interval. Expire the old
        // open session first so two products cannot both be purchased.
        const expireRes = await stripeForm(
          env,
          `checkout/sessions/${encodeURIComponent(lockClaim.sessionId)}/expire`,
          {},
        )
        const expireResult = (await expireRes.json()) as { status?: string }
        if (expireRes.ok && expireResult.status === 'expired') {
          current.status = 'expired'
        } else {
          // The session may have completed between the status check and expire request.
          const verifyRes = await stripeGet(env, `checkout/sessions/${encodeURIComponent(lockClaim.sessionId)}`)
          const verified = (await verifyRes.json()) as { status?: string }
          if (!verifyRes.ok || !verified.status) {
            return json(
              { error: 'No se pudo verificar la sesión Checkout existente.', code: 'checkout_unavailable' },
              503,
            )
          }
          if (verified.status === 'expired' || verified.status === 'complete') {
            current.status = verified.status
          } else {
            return json(
              { error: 'No se pudo cerrar la sesión Checkout anterior. Inténtalo de nuevo.', code: 'checkout_in_progress' },
              409,
            )
          }
        }
      } else {
        return json({
          url: current.url || lockClaim.checkoutUrl,
          product,
          interval,
          trial: lockClaim.trial,
          reused: true,
        })
      }
    }
    if (current.status === 'complete') {
      const latestSubs = await listCustomerSubscriptions(env, customerId)
      if (latestSubs.some((sub) => isPayingStatus(sub.status))) {
        return json(
          { error: 'Ya tienes una suscripción activa o en prueba.', code: 'already_subscribed' },
          409,
        )
      }
      // The checkout completed but Stripe/Firebase lifecycle processing has not
      // converged yet. The webhook releases the lock after persistence succeeds.
      return json(
        { error: 'La compra se está confirmando. Espera un momento y vuelve a intentarlo.', code: 'checkout_processing' },
        409,
      )
    }
    if (current.status !== 'expired') {
      return json({ error: 'El estado de la sesión Checkout no es válido.', code: 'checkout_unavailable' }, 503)
    }

    await releaseCheckoutLock(env, identity.uid, { sessionId: lockClaim.sessionId })
    const reclaimed = await claimCheckoutLock(env, identity.uid, product, interval)
    if (reclaimed.kind !== 'claimed') {
      return json(
        { error: 'Otra solicitud está renovando la compra. Inténtalo de nuevo.', code: 'checkout_in_progress' },
        409,
      )
    }
    lockToken = reclaimed.lockToken
  } else {
    lockToken = lockClaim.lockToken
  }

  // Annual trial only once per Stripe customer (any past trial or any past sub blocks it).
  const everHadSub = existingSubs.length > 0
  const everTrialed = existingSubs.some((s) => s.hasTrialed)
  const stored = await readSubscriptionRecord(env, identity.uid)
  const annualTrialUsed = Boolean(stored?.annualTrialUsed) || everTrialed || everHadSub
  const ANNUAL_TRIAL_DAYS = '7'
  const trialDays =
    interval === 'year' && !annualTrialUsed ? ANNUAL_TRIAL_DAYS : undefined

  const appUrl = resolveAppUrl(env, request)
  const successQs = new URLSearchParams({ checkout: 'success' })
  if (trialDays) successQs.set('trial', '1')
  if (product === 'grupeta') successQs.set('pack', 'grupeta')

  const sessionRes = await stripeForm(env, 'checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${appUrl}/premium?${successQs.toString()}`,
      cancel_url: `${appUrl}/premium?checkout=cancel${product === 'grupeta' ? '&pack=grupeta' : ''}`,
      'metadata[firebaseUid]': identity.uid,
      'metadata[product]': product,
      'metadata[seatLimit]': product === 'grupeta' ? String(GRUPETA_SEAT_LIMIT) : '1',
      'subscription_data[metadata][firebaseUid]': identity.uid,
      'subscription_data[metadata][product]': product,
      'subscription_data[metadata][seatLimit]':
        product === 'grupeta' ? String(GRUPETA_SEAT_LIMIT) : '1',
      allow_promotion_codes: product === 'solo' ? 'true' : 'false',
      ...(trialDays ? { 'subscription_data[trial_period_days]': trialDays } : {}),
    }, `pedalmap-checkout-${identity.uid}-${product}-${interval}`)

  const session = (await sessionRes.json()) as {
    id?: string
    url?: string
    expires_at?: number
    error?: { message?: string }
  }
  if (!sessionRes.ok) {
    await releaseCheckoutLock(env, identity.uid, { lockToken })
    return json({ error: session.error?.message || 'Checkout session failed' }, 502)
  }
  if (!session.id || !session.url || !Number.isFinite(session.expires_at)) {
    // Stripe may have created a session despite an incomplete response; keep the
    // lease instead of permitting a second product to race this uncertain result.
    return json({ error: 'Stripe returned an incomplete Checkout Session', code: 'checkout_unavailable' }, 502)
  }

  await finalizeCheckoutLock(env, identity.uid, lockToken, {
    product,
    interval,
    sessionId: session.id,
    checkoutUrl: session.url,
    expiresAt: session.expires_at!,
    trial: Boolean(trialDays),
  })
  return json({ url: session.url, product, interval, trial: Boolean(trialDays) })
}

export async function handlePortal(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe secret missing' }, 500)
  const identity = await verifyFirebaseIdToken(env, request.headers.get('Authorization'))
  let customerId = await readSubscriptionCustomerId(env, identity.uid)
  if (!customerId) {
    customerId = await findCustomerByFirebaseUid(env, identity.uid)
    if (customerId) {
      await writeSubscriptionCustomerId(env, identity.uid, customerId)
    }
  }
  if (!customerId) return json({ error: 'No Stripe customer for this user' }, 400)

  const portalRes = await stripeForm(env, 'billing_portal/sessions', {
    customer: customerId,
    return_url: `${resolveAppUrl(env, request)}/premium`,
  })
  const portal = (await portalRes.json()) as { url?: string; error?: { message?: string } }
  if (!portalRes.ok || !portal.url) {
    return json({ error: portal.error?.message || 'Portal session failed' }, 502)
  }
  return json({ url: portal.url })
}

async function hmacSha256(secret: string, payload: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): Promise<boolean> {
  if (!header) return false
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k.trim(), v]
    }),
  ) as { t?: string; v1?: string }
  if (!parts.t || !parts.v1) return false
  const ts = Number(parts.t)
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return false
  const signed = `${parts.t}.${payload}`
  const digest = toHex(await hmacSha256(secret, signed))
  const candidates = header
    .split(',')
    .filter((p) => p.trim().startsWith('v1='))
    .map((p) => p.trim().slice(3))
  return candidates.some((sig) => timingSafeEqual(sig, digest))
}

export async function resolveFirebaseUid(
  env: Env,
  obj: Record<string, unknown>,
  eventType: string,
): Promise<{
  uid?: string
  customerId?: string
  subscriptionId?: string
  product: CheckoutProduct
  interval?: 'month' | 'year'
  ownerEmail?: string | null
  status?: string
  trialEnd?: number | null
}> {
  const metadata = (obj.metadata || {}) as Record<string, string>
  let uid: string | undefined = metadata.firebaseUid
  let product: CheckoutProduct = metadata.product === 'grupeta' ? 'grupeta' : 'solo'
  let interval: 'month' | 'year' | undefined
  let ownerEmail: string | null | undefined
  const isInvoiceEvent =
    eventType === 'invoice.paid' || eventType === 'invoice.payment_succeeded'
  // Invoice.status describes the invoice (for example, "paid"), never the subscription.
  let status =
    !isInvoiceEvent && typeof obj.status === 'string' ? obj.status : undefined
  let trialEnd: number | null | undefined =
    typeof obj.trial_end === 'number' ? obj.trial_end : null

  const customerId = typeof obj.customer === 'string' ? obj.customer : undefined
  const expandableId = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      const id = (value as { id?: unknown }).id
      if (typeof id === 'string') return id
    }
    return undefined
  }
  const parent = obj.parent as
    | { subscription_details?: { subscription?: unknown } }
    | undefined
  const subscriptionId =
    expandableId(obj.subscription) ||
    expandableId(parent?.subscription_details?.subscription) ||
    (typeof obj.id === 'string' && eventType.startsWith('customer.subscription')
      ? obj.id
      : undefined)

  if (subscriptionId) {
    const subRes = await stripeGet(env, `subscriptions/${subscriptionId}`)
    const sub = (await subRes.json()) as {
      metadata?: { firebaseUid?: string; product?: string }
      items?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> }
      status?: string
      trial_end?: number | null
    }
    const requiresCurrentSubscriptionStatus =
      isInvoiceEvent ||
      eventType === 'checkout.session.completed' ||
      eventType === 'customer.subscription.created' ||
      eventType === 'customer.subscription.updated'
    if (!uid) uid = sub.metadata?.firebaseUid
    if (sub.metadata?.product === 'grupeta') product = 'grupeta'
    const recInterval = sub.items?.data?.[0]?.price?.recurring?.interval
    if (recInterval === 'month' || recInterval === 'year') interval = recInterval
    if (requiresCurrentSubscriptionStatus) {
      // Use only the current Stripe state, not a possibly stale event snapshot.
      // The webhook handler turns a missing state into a retryable 500 after
      // attempting to resolve the Firebase UID.
      status =
        subRes.ok && typeof sub.status === 'string' && sub.status
          ? sub.status
          : undefined
    } else if (!status && sub.status) {
      status = sub.status
    }
    if (trialEnd == null && sub.trial_end != null) trialEnd = sub.trial_end
  }

  if (!uid && customerId) {
    const custRes = await stripeGet(env, `customers/${customerId}`)
    const cust = (await custRes.json()) as {
      metadata?: { firebaseUid?: string }
      email?: string
    }
    uid = cust.metadata?.firebaseUid
    ownerEmail = cust.email || null
  }

  if (!ownerEmail) {
    const details = obj.customer_details as { email?: string } | undefined
    ownerEmail = details?.email || (typeof obj.customer_email === 'string' ? obj.customer_email : null)
  }

  return { uid, customerId, subscriptionId, product, interval, ownerEmail, status, trialEnd }
}

export function effectivePlanFromSides(soloStatus?: string, grupetaStatus?: string): {
  plan: 'free' | 'premium'
  status: string
  product: CheckoutProduct
} {
  const soloPay = soloStatus && isPayingStatus(soloStatus)
  const grupetaPay = grupetaStatus && isPayingStatus(grupetaStatus)
  if (grupetaPay) {
    return { plan: 'premium', status: grupetaStatus!, product: 'grupeta' }
  }
  if (soloPay) {
    return { plan: 'premium', status: soloStatus!, product: 'solo' }
  }
  return {
    plan: 'free',
    status: grupetaStatus || soloStatus || 'canceled',
    product: grupetaStatus ? 'grupeta' : 'solo',
  }
}

export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe secret missing' }, 500)
  const payload = await request.text()
  const signature = request.headers.get('Stripe-Signature')

  if (env.STRIPE_WEBHOOK_SECRET) {
    const ok = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)
    if (!ok) return json({ error: 'Invalid signature' }, 400)
  } else {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET missing — rejecting webhook')
    return json({ error: 'Webhook secret not configured' }, 500)
  }

  const event = JSON.parse(payload) as {
    id: string
    type: string
    data: { object: Record<string, unknown> }
  }

  const claim = await claimWebhookEvent(env, event.id, event.type)

  if (claim === 'duplicate') {
    console.log(`[stripe] event ${event.id} already completed`)
    return json({ received: true, duplicate: true })
  }

  if (claim === 'in_progress') {
    console.warn(`[stripe] event ${event.id} is still being processed; requesting retry`)
    return json({ error: 'Webhook event is still being processed', code: 'webhook_in_progress' }, 503)
  }

  if (claim === 'failed') {
    console.error(`[stripe] failed to claim event ${event.id}, allowing retry`)
    return json({ error: 'Failed to claim event for processing' }, 500)
  }

  try {
    const isSubscriptionEvent =
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    const isInvoiceEvent =
      event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded'

    if (!isSubscriptionEvent && !isInvoiceEvent) {
      // This event is intentionally ignored, but it is still a completed delivery.
      // Persist completion before returning 2xx so duplicate deliveries remain idempotent.
      await markWebhookEventProcessed(env, event.id)
      return json({ received: true, ignored: true })
    }

    const obj = event.data.object
    const resolved = await resolveFirebaseUid(env, obj, event.type)
    const { uid, customerId, subscriptionId, product, interval, ownerEmail, trialEnd } = resolved

    if (!uid) {
      console.warn('[stripe] missing firebaseUid', event.type, { customerId, subscriptionId })
      // This is a permanent metadata/configuration error (400 is not retried by Stripe).
      // Mark the delivery terminal so manual replays do not stay stuck in "processing".
      await markWebhookEventProcessed(env, event.id)
      return json({ error: 'missing firebaseUid' }, 400)
    }
    const requiresCurrentSubscriptionStatus =
      isInvoiceEvent ||
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    if (requiresCurrentSubscriptionStatus && (!subscriptionId || !resolved.status)) {
      throw new Error('Event missing authoritative subscription status')
    }

    // Prefer real Stripe subscription status (trialing vs active). Never force active on checkout.
    // Invoice events must use the fetched subscription status; invoice "paid" is not a plan state.
    let status =
      event.type === 'customer.subscription.deleted'
        ? 'canceled'
        : resolved.status || 'active'
    if (event.type === 'checkout.session.completed' && subscriptionId) {
      const subRes = await stripeGet(env, `subscriptions/${subscriptionId}`)
      const sub = (await subRes.json()) as { status?: string }
      if (sub.status) status = sub.status
    }

    const prev = await readSubscriptionRecord(env, uid)
    // Some invoice/legacy events omit product metadata. Use the stored subscription
    // IDs to identify which side changed instead of accidentally overwriting Solo.
    const effectiveProduct: CheckoutProduct =
      subscriptionId && prev?.grupetaSubscriptionId === subscriptionId
        ? 'grupeta'
        : subscriptionId && prev?.soloSubscriptionId === subscriptionId
          ? 'solo'
          : product
    const currentSideId =
      effectiveProduct === 'grupeta' ? prev?.grupetaSubscriptionId : prev?.soloSubscriptionId
    const currentSideStatus =
      effectiveProduct === 'grupeta' ? prev?.grupetaStatus : prev?.soloStatus
    const isExistingSubscriptionEvent =
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted' ||
      isInvoiceEvent
    const isOlderCreationBesidePayingSubscription =
      (event.type === 'customer.subscription.created' || event.type === 'checkout.session.completed') &&
      Boolean(currentSideId && currentSideId !== subscriptionId && isPayingStatus(currentSideStatus || ''))
    if (
      subscriptionId &&
      currentSideId &&
      currentSideId !== subscriptionId &&
      (isExistingSubscriptionEvent || isOlderCreationBesidePayingSubscription)
    ) {
      // A delayed update/delete/invoice (or old created event) must not replace
      // the currently stored subscription ID or revoke/replace its paying plan.
      await markWebhookEventProcessed(env, event.id)
      return json({ received: true, ignored: true, staleSubscription: true })
    }
    const nextSoloId = effectiveProduct === 'solo' ? subscriptionId : prev?.soloSubscriptionId
    const nextSoloStatus = effectiveProduct === 'solo' ? status : prev?.soloStatus
    const nextGrupetaId = effectiveProduct === 'grupeta' ? subscriptionId : prev?.grupetaSubscriptionId
    const nextGrupetaStatus = effectiveProduct === 'grupeta' ? status : prev?.grupetaStatus
    const eff = effectivePlanFromSides(nextSoloStatus, nextGrupetaStatus)

    await upsertSubscriptionAndPlan(env, {
      expectedExistingUpdateTime: prev?.updateTime ?? null,
      uid,
      plan: eff.plan,
      status: eff.status,
      stripeCustomerId: customerId,
      stripeSubscriptionId:
        eff.product === 'grupeta'
          ? nextGrupetaId || subscriptionId
          : nextSoloId || subscriptionId,
      product: eff.product,
      soloSubscriptionId: nextSoloId,
      soloStatus: nextSoloStatus,
      grupetaSubscriptionId: nextGrupetaId,
      grupetaStatus: nextGrupetaStatus,
      annualTrialUsed: Boolean(prev?.annualTrialUsed) || Boolean(trialEnd) || status === 'trialing',
    })

    if (effectiveProduct === 'grupeta') {
      if (eff.plan === 'premium' && nextGrupetaStatus && isPayingStatus(nextGrupetaStatus)) {
        await activateGrupetaPack(env, {
          ownerUid: uid,
          ownerEmail: ownerEmail || null,
          status: nextGrupetaStatus,
          interval,
          stripeCustomerId: customerId,
          stripeSubscriptionId: nextGrupetaId || subscriptionId,
        })
      } else {
        await deactivateGrupetaPack(env, uid, nextGrupetaStatus || status)
      }
    }

    if (event.type === 'checkout.session.completed' && typeof obj.id === 'string') {
      // Unlock only the Checkout session represented by this verified event.
      // This happens after the subscription plan write succeeds.
      await releaseCheckoutLock(env, uid, { sessionId: obj.id })
    }

    // Mark event as successfully completed
    await markWebhookEventProcessed(env, event.id)
  } catch (error) {
    console.error('[stripe webhook]', error)
    return json({ error: 'Webhook handler failed' }, 500)
  }

  return json({ received: true })
}
