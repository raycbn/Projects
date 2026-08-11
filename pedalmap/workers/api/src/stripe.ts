import type { Env } from './types'
import { json, resolveAppUrl } from './types'
import { verifyFirebaseIdToken } from './firebaseAuth'
import {
  readSubscriptionCustomerId,
  upsertSubscriptionAndPlan,
  writeSubscriptionCustomerId,
} from './firestore'

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

export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe secret missing' }, 500)
  const identity = await verifyFirebaseIdToken(env, request.headers.get('Authorization'))
  const payload = (await request.json().catch(() => ({}))) as { interval?: string }
  const interval = payload.interval === 'year' ? 'year' : 'month'
  const priceId = interval === 'year' ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY
  if (!priceId) return json({ error: 'Price id not configured' }, 500)

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
  // Annual plan trial (webhook already treats `trialing` as premium).
  const ANNUAL_TRIAL_DAYS = '7'
  const trialDays = interval === 'year' ? ANNUAL_TRIAL_DAYS : undefined
  const sessionRes = await stripeForm(env, 'checkout/sessions', {
    mode: 'subscription',
    customer: customerId,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${appUrl}/premium?checkout=success${interval === 'year' ? '&trial=1' : ''}`,
    cancel_url: `${appUrl}/premium?checkout=cancel`,
    'metadata[firebaseUid]': identity.uid,
    'subscription_data[metadata][firebaseUid]': identity.uid,
    allow_promotion_codes: 'true',
    ...(trialDays ? { 'subscription_data[trial_period_days]': trialDays } : {}),
  })
  const session = (await sessionRes.json()) as { url?: string; error?: { message?: string } }
  if (!sessionRes.ok || !session.url) {
    return json({ error: session.error?.message || 'Checkout session failed' }, 502)
  }
  return json({ url: session.url })
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
  // Stripe may send multiple v1 signatures
  const candidates = header
    .split(',')
    .filter((p) => p.trim().startsWith('v1='))
    .map((p) => p.trim().slice(3))
  return candidates.some((sig) => timingSafeEqual(sig, digest))
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
      const metadata = (obj.metadata || {}) as Record<string, string>
      let uid: string | undefined = metadata.firebaseUid
      const customerId = typeof obj.customer === 'string' ? obj.customer : undefined
      const subscriptionId =
        typeof obj.subscription === 'string'
          ? obj.subscription
          : typeof obj.id === 'string' && event.type.startsWith('customer.subscription')
            ? obj.id
            : undefined

      if (!uid && subscriptionId) {
        const subRes = await stripeGet(env, `subscriptions/${subscriptionId}`)
        const sub = (await subRes.json()) as { metadata?: { firebaseUid?: string } }
        uid = sub.metadata?.firebaseUid
      }

      if (!uid && customerId) {
        const custRes = await stripeGet(env, `customers/${customerId}`)
        const cust = (await custRes.json()) as { metadata?: { firebaseUid?: string } }
        uid = cust.metadata?.firebaseUid
      }

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
      })
    }

    if (event.type === 'customer.subscription.deleted') {
      const obj = event.data.object
      const metadata = (obj.metadata || {}) as Record<string, string>
      let uid: string | undefined = metadata.firebaseUid
      const customerId = typeof obj.customer === 'string' ? obj.customer : undefined
      if (!uid && customerId) {
        const custRes = await stripeGet(env, `customers/${customerId}`)
        const cust = (await custRes.json()) as { metadata?: { firebaseUid?: string } }
        uid = cust.metadata?.firebaseUid
      }
      if (uid) {
        await upsertSubscriptionAndPlan(env, {
          uid,
          plan: 'free',
          status: 'canceled',
          stripeCustomerId: customerId,
          stripeSubscriptionId: typeof obj.id === 'string' ? obj.id : undefined,
        })
      }
    }
  } catch (error) {
    console.error('[stripe webhook]', error)
    return json({ error: 'Webhook handler failed' }, 500)
  }

  return json({ received: true })
}
