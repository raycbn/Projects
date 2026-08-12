import type { Env } from './types'
import { json, resolveAppUrl } from './types'
import { verifyFirebaseIdToken } from './firebaseAuth'
import {
  readSubscriptionCustomerId,
  upsertSubscriptionAndPlan,
  writeSubscriptionCustomerId,
} from './firestore'
import { activateGrupetaPack, deactivateGrupetaPack, GRUPETA_SEAT_LIMIT } from './grupetaPack'

async function stripeForm(
  env: Env,
  path: string,
  params: Record<string, string>,
): Promise<Response> {
  const body = new URLSearchParams(params)
  return fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
}

async function stripeGet(env: Env, path: string): Promise<Response> {
  return fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  })
}

type CheckoutProduct = 'solo' | 'grupeta'

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

export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe secret missing' }, 500)
  const identity = await verifyFirebaseIdToken(env, request.headers.get('Authorization'))
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
    const customerRes = await stripeForm(env, 'customers', {
      ...(identity.email ? { email: identity.email } : {}),
      'metadata[firebaseUid]': identity.uid,
    })
    const customer = (await customerRes.json()) as { id?: string; error?: { message?: string } }
    if (!customerRes.ok || !customer.id) {
      return json({ error: customer.error?.message || 'Could not create Stripe customer' }, 502)
    }
    customerId = customer.id
    await writeSubscriptionCustomerId(env, identity.uid, customerId)
  }

  const appUrl = resolveAppUrl(env, request)
  const ANNUAL_TRIAL_DAYS = '7'
  // Trial only on annual (solo + grupeta). Monthly never trials.
  const trialDays = interval === 'year' ? ANNUAL_TRIAL_DAYS : undefined
  const successQs = new URLSearchParams({ checkout: 'success' })
  if (interval === 'year') successQs.set('trial', '1')
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
    // Solo may use promo codes; Grupeta is a fixed pack price (no stacking discounts).
    allow_promotion_codes: product === 'solo' ? 'true' : 'false',
    ...(trialDays ? { 'subscription_data[trial_period_days]': trialDays } : {}),
  })
  const session = (await sessionRes.json()) as { url?: string; error?: { message?: string } }
  if (!sessionRes.ok || !session.url) {
    return json({ error: session.error?.message || 'Checkout session failed' }, 502)
  }
  return json({ url: session.url, product, interval })
}

export async function handlePortal(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe secret missing' }, 500)
  const identity = await verifyFirebaseIdToken(env, request.headers.get('Authorization'))
  const customerId = await readSubscriptionCustomerId(env, identity.uid)
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

/** Verify Stripe-Signature header (v1) with timestamp skew check. */
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

async function resolveFirebaseUid(
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
}> {
  const metadata = (obj.metadata || {}) as Record<string, string>
  let uid: string | undefined = metadata.firebaseUid
  let product: CheckoutProduct = metadata.product === 'grupeta' ? 'grupeta' : 'solo'
  let interval: 'month' | 'year' | undefined
  let ownerEmail: string | null | undefined

  const customerId = typeof obj.customer === 'string' ? obj.customer : undefined
  const subscriptionId =
    typeof obj.subscription === 'string'
      ? obj.subscription
      : typeof obj.id === 'string' && eventType.startsWith('customer.subscription')
        ? obj.id
        : undefined

  if (subscriptionId) {
    const subRes = await stripeGet(env, `subscriptions/${subscriptionId}`)
    const sub = (await subRes.json()) as {
      metadata?: { firebaseUid?: string; product?: string }
      items?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> }
      customer?: string
    }
    if (!uid) uid = sub.metadata?.firebaseUid
    if (sub.metadata?.product === 'grupeta') product = 'grupeta'
    const recInterval = sub.items?.data?.[0]?.price?.recurring?.interval
    if (recInterval === 'month' || recInterval === 'year') interval = recInterval
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

  // Checkout session may include customer_email / customer_details
  if (!ownerEmail) {
    const details = obj.customer_details as { email?: string } | undefined
    ownerEmail = details?.email || (typeof obj.customer_email === 'string' ? obj.customer_email : null)
  }

  return { uid, customerId, subscriptionId, product, interval, ownerEmail }
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
    type: string
    data: { object: Record<string, unknown> }
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const obj = event.data.object
      const resolved = await resolveFirebaseUid(env, obj, event.type)
      const { uid, customerId, subscriptionId, product, interval, ownerEmail } = resolved

      if (!uid) {
        console.warn('[stripe] missing firebaseUid', event.type)
        return json({ received: true, warning: 'missing firebaseUid' })
      }

      const status =
        event.type === 'checkout.session.completed'
          ? 'active'
          : String(obj.status || 'active')
      const plan = status === 'active' || status === 'trialing' ? 'premium' : 'free'

      await upsertSubscriptionAndPlan(env, {
        uid,
        plan,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        product,
      })

      if (product === 'grupeta') {
        if (plan === 'premium') {
          await activateGrupetaPack(env, {
            ownerUid: uid,
            ownerEmail: ownerEmail || null,
            status,
            interval,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          })
        } else {
          await deactivateGrupetaPack(env, uid, status)
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const obj = event.data.object
      const resolved = await resolveFirebaseUid(env, obj, event.type)
      const { uid, customerId, subscriptionId, product } = resolved
      if (uid) {
        await upsertSubscriptionAndPlan(env, {
          uid,
          plan: 'free',
          status: 'canceled',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId || (typeof obj.id === 'string' ? obj.id : undefined),
          product,
        })
        if (product === 'grupeta') {
          await deactivateGrupetaPack(env, uid, 'canceled')
        }
      }
    }
  } catch (error) {
    console.error('[stripe webhook]', error)
    return json({ error: 'Webhook handler failed' }, 500)
  }

  return json({ received: true })
}
