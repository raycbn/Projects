/**
 * PedalMap Cloud Functions — Fase 4
 *
 * - ORS proxy (hides API key from the browser)
 * - Stripe Checkout + webhook (plan upgrades)
 * - Server-side freemium counters on route create
 *
 * Requires Firebase Blaze + secrets:
 *   ORS_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, APP_URL
 */

import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret, defineString } from 'firebase-functions/params'
import Stripe from 'stripe'

initializeApp()

const ORS_API_KEY = defineSecret('ORS_API_KEY')
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET')
const STRIPE_PRICE_MONTHLY = defineString('STRIPE_PRICE_MONTHLY', { default: '' })
const STRIPE_PRICE_YEARLY = defineString('STRIPE_PRICE_YEARLY', { default: '' })
const APP_URL = defineString('APP_URL', { default: 'http://localhost:5173' })

const ORS_BASE = 'https://api.heigit.org/openrouteservice'
const FREE_MAX_SAVED = 5
const FREE_MAX_CREATED_MONTH = 15

function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function stripeClient(secret: string): Stripe {
  return new Stripe(secret)
}

/** Proxy ORS directions — client never sees ORS_API_KEY. */
export const orsProxy = onRequest(
  { region: 'europe-west1', secrets: [ORS_API_KEY], cors: true },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' })
      return
    }

    const pathMatch = String(req.path || '').match(
      /\/v2\/directions\/(cycling-(?:regular|road|mountain|electric))\/geojson\/?$/,
    )
    const profile =
      pathMatch?.[1] ||
      String(req.query.profile || req.body?.profile || '')

    if (!/^cycling-(regular|road|mountain|electric)$/.test(profile)) {
      res.status(400).json({
        error: 'Invalid cycling profile',
        hint: 'POST .../orsProxy/v2/directions/{profile}/geojson',
      })
      return
    }

    const body = { ...(req.body ?? {}) }
    delete body.profile

    try {
      const upstream = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, application/geo+json',
          Authorization: ORS_API_KEY.value(),
        },
        body: JSON.stringify(body),
      })
      const text = await upstream.text()
      res.status(upstream.status).type('application/json').send(text)
    } catch (error) {
      console.error('[orsProxy]', error)
      res.status(502).json({ error: 'Upstream routing failed' })
    }
  },
)

export const createCheckoutSession = onCall(
  { region: 'europe-west1', secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Login required')
    }
    const uid = request.auth.uid
    const interval = request.data?.interval === 'year' ? 'year' : 'month'
    const priceId =
      interval === 'year' ? STRIPE_PRICE_YEARLY.value() : STRIPE_PRICE_MONTHLY.value()
    if (!priceId) {
      throw new HttpsError('failed-precondition', 'Stripe price not configured')
    }

    const db = getFirestore()
    const subRef = db.collection('subscriptions').doc(uid)
    const subSnap = await subRef.get()
    let customerId = subSnap.data()?.stripeCustomerId as string | undefined

    const stripe = stripeClient(STRIPE_SECRET_KEY.value())
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: request.auth.token.email,
        metadata: { firebaseUid: uid },
      })
      customerId = customer.id
      await subRef.set(
        {
          userId: uid,
          stripeCustomerId: customerId,
          status: 'none',
          plan: 'free',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL.value()}/premium?checkout=success`,
      cancel_url: `${APP_URL.value()}/premium?checkout=cancel`,
      metadata: { firebaseUid: uid },
      subscription_data: { metadata: { firebaseUid: uid } },
      allow_promotion_codes: true,
    })

    if (!session.url) throw new HttpsError('internal', 'No checkout URL')
    return { url: session.url }
  },
)

export const createCustomerPortalSession = onCall(
  { region: 'europe-west1', secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Login required')
    }
    const uid = request.auth.uid
    const subSnap = await getFirestore().collection('subscriptions').doc(uid).get()
    const customerId = subSnap.data()?.stripeCustomerId as string | undefined
    if (!customerId) {
      throw new HttpsError('failed-precondition', 'No Stripe customer')
    }
    const stripe = stripeClient(STRIPE_SECRET_KEY.value())
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL.value()}/premium`,
    })
    return { url: session.url }
  },
)

export const stripeWebhook = onRequest(
  { region: 'europe-west1', secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('POST only')
      return
    }

    const stripe = stripeClient(STRIPE_SECRET_KEY.value())
    let event: Stripe.Event
    try {
      const signature = req.headers['stripe-signature']
      if (!signature || Array.isArray(signature)) {
        res.status(400).send('Missing signature')
        return
      }
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET.value(),
      )
    } catch (error) {
      console.error('[stripeWebhook] signature', error)
      res.status(400).send('Invalid signature')
      return
    }

    const db = getFirestore()

    try {
      if (
        event.type === 'checkout.session.completed' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.created'
      ) {
        const obj = event.data.object as Stripe.Checkout.Session | Stripe.Subscription
        const uid =
          ('metadata' in obj && obj.metadata?.firebaseUid) ||
          (event.type === 'checkout.session.completed'
            ? (obj as Stripe.Checkout.Session).metadata?.firebaseUid
            : undefined)
        if (!uid) {
          console.warn('[stripeWebhook] missing firebaseUid', event.type)
        } else {
          const status =
            event.type === 'checkout.session.completed'
              ? 'active'
              : ((obj as Stripe.Subscription).status as string)
          const plan = status === 'active' || status === 'trialing' ? 'premium' : 'free'
          await db.collection('subscriptions').doc(uid).set(
            {
              userId: uid,
              status,
              plan,
              stripeSubscriptionId:
                event.type === 'checkout.session.completed'
                  ? ((obj as Stripe.Checkout.Session).subscription as string | undefined)
                  : (obj as Stripe.Subscription).id,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
          await db.collection('users').doc(uid).set(
            { plan, updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
          )
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object as Stripe.Subscription
        const uid = sub.metadata?.firebaseUid
        if (uid) {
          await db.collection('subscriptions').doc(uid).set(
            {
              status: 'canceled',
              plan: 'free',
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
          await db.collection('users').doc(uid).set(
            { plan: 'free', updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
          )
        }
      }
    } catch (error) {
      console.error('[stripeWebhook] handler', error)
      res.status(500).send('Handler error')
      return
    }

    res.json({ received: true })
  },
)

/** Server-side usage counters + soft free-tier enforcement when routes are saved. */
export const onRouteCreated = onDocumentCreated(
  { region: 'europe-west1', document: 'routes/{routeId}' },
  async (event) => {
    const data = event.data?.data()
    if (!data?.userId) return
    const uid = data.userId as string
    const db = getFirestore()
    const userRef = db.collection('users').doc(uid)
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef)
      if (!snap.exists) return
      const user = snap.data()!
      const key = monthKey()
      const usage = user.usage ?? {
        routesCreatedThisMonth: 0,
        routesSaved: 0,
        monthKey: key,
      }
      const sameMonth = usage.monthKey === key
      const created = sameMonth ? (usage.routesCreatedThisMonth ?? 0) + 1 : 1
      const saved = (usage.routesSaved ?? 0) + 1
      const plan = user.plan === 'premium' ? 'premium' : 'free'

      if (plan === 'free' && (saved > FREE_MAX_SAVED || created > FREE_MAX_CREATED_MONTH)) {
        console.warn('[onRouteCreated] free limit exceeded', { uid, saved, created })
      }

      tx.update(userRef, {
        usage: {
          routesCreatedThisMonth: created,
          routesSaved: saved,
          monthKey: key,
        },
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
  },
)

/** Optional health check for deployed Functions. */
export const health = onRequest({ region: 'europe-west1' }, async (req, res) => {
  res.json({
    ok: true,
    service: 'pedalmap-functions',
    phase: 4,
    authProbe: Boolean(req.headers.authorization),
  })
})
