import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'

async function signStripePayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('effectivePlanFromSides', () => {
  let effectivePlanFromSides: (
    soloStatus?: string,
    grupetaStatus?: string,
  ) => { plan: 'free' | 'premium'; status: string; product: 'solo' | 'grupeta' }

  beforeAll(async () => {
    const mod = await import('./stripe')
    effectivePlanFromSides = mod.effectivePlanFromSides
  })

  it('solo active → premium', () => {
    expect(effectivePlanFromSides('active', undefined)).toEqual({
      plan: 'premium',
      status: 'active',
      product: 'solo',
    })
  })

  it('grupeta active → premium', () => {
    expect(effectivePlanFromSides(undefined, 'active')).toEqual({
      plan: 'premium',
      status: 'active',
      product: 'grupeta',
    })
  })

  it('sin estados → free', () => {
    expect(effectivePlanFromSides(undefined, undefined)).toEqual({
      plan: 'free',
      status: 'canceled',
      product: 'solo',
    })
  })

  it('past_due mantiene premium', () => {
    expect(effectivePlanFromSides('past_due', undefined)).toEqual({
      plan: 'premium',
      status: 'past_due',
      product: 'solo',
    })
  })
})

describe('resolveFirebaseUid', () => {
  const env = {
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_WEBHOOK_SECRET: 'whsec',
  } as any

  it('resuelve uid desde obj.metadata', async () => {
    const { resolveFirebaseUid } = await import('./stripe')
    const obj = {
      metadata: { firebaseUid: 'uid_1', product: 'solo' },
      customer: 'cus_1',
      subscription: 'sub_1',
      status: 'active',
      trial_end: null,
      customer_details: { email: 'a@b.com' },
    }
    const res = await resolveFirebaseUid(env, obj, 'customer.subscription.created')
    expect(res.uid).toBe('uid_1')
    expect(res.customerId).toBe('cus_1')
    expect(res.subscriptionId).toBe('sub_1')
    expect(res.product).toBe('solo')
  })

  it('resuelve uid desde subscription metadata cuando obj.metadata no lo tiene', async () => {
    const { resolveFirebaseUid } = await import('./stripe')
    const sub = {
      metadata: { firebaseUid: 'uid_sub', product: 'grupeta' },
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      status: 'active',
      trial_end: null,
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(sub) })
    ;(globalThis as any).fetch = fetchMock

    const obj = {
      metadata: {},
      customer: 'cus_1',
      subscription: 'sub_1',
      status: 'active',
      trial_end: null,
      customer_details: { email: 'a@b.com' },
    }
    const res = await resolveFirebaseUid(env, obj, 'customer.subscription.created')
    expect(res.uid).toBe('uid_sub')
    expect(res.product).toBe('grupeta')
    expect(res.interval).toBe('month')
  })

  it('resuelve uid desde customer metadata cuando no está en obj ni subscription', async () => {
    const { resolveFirebaseUid } = await import('./stripe')
    const sub = {
      metadata: {},
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      status: 'active',
      trial_end: null,
    }
    const customer = {
      metadata: { firebaseUid: 'uid_cust' },
      email: 'owner@test.com',
    }
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/subscriptions/sub_1')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sub) })
      }
      if (url.includes('/customers/cus_1')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(customer) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    ;(globalThis as any).fetch = fetchMock

    const obj = {
      metadata: {},
      customer: 'cus_1',
      subscription: 'sub_1',
      status: 'active',
      trial_end: null,
      customer_details: {},
    }
    const res = await resolveFirebaseUid(env, obj, 'customer.subscription.created')
    expect(res.uid).toBe('uid_cust')
    expect(res.ownerEmail).toBe('owner@test.com')
  })
})

describe('handleWebhook', () => {
  const baseEnv = {
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_WEBHOOK_SECRET: 'whsec',
    FIREBASE_SERVICE_ACCOUNT: '',
    FIREBASE_PROJECT_ID: 'test',
  } as any

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.resetAllMocks()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      status: 200,
    })
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      writable: true,
      configurable: true,
    })
  })

  it('customer.subscription.created activa premium para el caso real', async () => {
    vi.mock('./firestore', () => ({
      claimWebhookEvent: vi.fn().mockResolvedValue('claimed'),
      markWebhookEventProcessed: vi.fn().mockResolvedValue(undefined),
      readSubscriptionRecord: vi.fn().mockResolvedValue(null),
      upsertSubscriptionAndPlan: vi.fn().mockResolvedValue(undefined),
      writeSubscriptionCustomerId: vi.fn().mockResolvedValue(undefined),
      readSubscriptionCustomerId: vi.fn().mockResolvedValue(undefined),
    }))

    vi.mock('./grupetaPack', () => ({
      activateGrupetaPack: vi.fn().mockResolvedValue(undefined),
      deactivateGrupetaPack: vi.fn().mockResolvedValue(undefined),
      GRUPETA_SEAT_LIMIT: 4,
    }))

    const { handleWebhook } = await import('./stripe')

    const sub = {
      metadata: { firebaseUid: 'spPOB23XOdYbzrj8C2ngSOeah7N2', product: 'solo' },
      status: 'active',
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      trial_end: null,
    }
    const customer = {
      metadata: { firebaseUid: 'spPOB23XOdYbzrj8C2ngSOeah7N2' },
      email: 'jgarciaraso@yahoo.es',
    }

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/subscriptions/sub_123')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sub) })
      }
      if (url.includes('/customers/cus_V6fBUSrOyCZZg8')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(customer) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    ;(globalThis as any).fetch = fetchMock

    const payload = JSON.stringify({
      id: 'evt_001',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_V6fBUSrOyCZZg8',
          subscription: 'sub_123',
          status: 'active',
          metadata: {},
          customer_details: { email: 'jgarciaraso@yahoo.es' },
        },
      },
    })

    const timestamp = Math.floor(Date.now() / 1000)
    const signedPayload = `${timestamp}.${payload}`
    const signature = await signStripePayload('whsec', signedPayload)

    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
  })

  it('invoice.payment_succeeded activa premium cuando subscription está activa', async () => {
    vi.mock('./firestore', () => ({
      claimWebhookEvent: vi.fn().mockResolvedValue('claimed'),
      markWebhookEventProcessed: vi.fn().mockResolvedValue(undefined),
      readSubscriptionRecord: vi.fn().mockResolvedValue(null),
      upsertSubscriptionAndPlan: vi.fn().mockResolvedValue(undefined),
      writeSubscriptionCustomerId: vi.fn().mockResolvedValue(undefined),
      readSubscriptionCustomerId: vi.fn().mockResolvedValue(undefined),
    }))

    vi.mock('./grupetaPack', () => ({
      activateGrupetaPack: vi.fn().mockResolvedValue(undefined),
      deactivateGrupetaPack: vi.fn().mockResolvedValue(undefined),
      GRUPETA_SEAT_LIMIT: 4,
    }))

    const { handleWebhook } = await import('./stripe')

    const sub = {
      metadata: { firebaseUid: 'spPOB23XOdYbzrj8C2ngSOeah7N2', product: 'solo' },
      status: 'active',
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      trial_end: null,
    }
    const customer = {
      metadata: { firebaseUid: 'spPOB23XOdYbzrj8C2ngSOeah7N2' },
      email: 'jgarciaraso@yahoo.es',
    }

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/subscriptions/sub_123')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sub) })
      }
      if (url.includes('/customers/cus_V6fBUSrOyCZZg8')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(customer) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    ;(globalThis as any).fetch = fetchMock

    const payload = JSON.stringify({
      id: 'evt_inv_001',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_123',
          customer: 'cus_V6fBUSrOyCZZg8',
          subscription: 'sub_123',
          status: 'paid',
          metadata: {},
          customer_details: { email: 'jgarciaraso@yahoo.es' },
        },
      },
    })

    const timestamp = Math.floor(Date.now() / 1000)
    const signedPayload = `${timestamp}.${payload}`
    const signature = await signStripePayload('whsec', signedPayload)

    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
  })

  it('devuelve 400 cuando falta firebaseUid', async () => {
    vi.mock('./firestore', () => ({
      claimWebhookEvent: vi.fn().mockResolvedValue('claimed'),
      markWebhookEventProcessed: vi.fn().mockResolvedValue(undefined),
      readSubscriptionRecord: vi.fn().mockResolvedValue(null),
      upsertSubscriptionAndPlan: vi.fn().mockResolvedValue(undefined),
      writeSubscriptionCustomerId: vi.fn().mockResolvedValue(undefined),
      readSubscriptionCustomerId: vi.fn().mockResolvedValue(undefined),
    }))

    vi.mock('./grupetaPack', () => ({
      activateGrupetaPack: vi.fn().mockResolvedValue(undefined),
      deactivateGrupetaPack: vi.fn().mockResolvedValue(undefined),
      GRUPETA_SEAT_LIMIT: 4,
    }))

    const { handleWebhook } = await import('./stripe')

    const payload = JSON.stringify({
      id: 'evt_no_uid',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_no_uid',
          subscription: 'sub_123',
          status: 'active',
          metadata: {},
          customer_details: { email: 'no@test.com' },
        },
      },
    })

    const timestamp = Math.floor(Date.now() / 1000)
    const signedPayload = `${timestamp}.${payload}`
    const signature = await signStripePayload('whsec', signedPayload)

    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body).toEqual({ error: 'missing firebaseUid' })
  })
})

describe('findCustomerByFirebaseUid', () => {
  it('returns customer id when metadata matches', async () => {
    const { findCustomerByFirebaseUid } = await import('./stripe')
    const customer = { id: 'cus_match', metadata: { firebaseUid: 'uid_123' } }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [customer] }) })
    ;(globalThis as any).fetch = fetchMock

    const env = { STRIPE_SECRET_KEY: 'sk_test' } as any
    const result = await findCustomerByFirebaseUid(env, 'uid_123')
    expect(result).toBe('cus_match')
  })

  it('returns undefined when no customer matches', async () => {
    const { findCustomerByFirebaseUid } = await import('./stripe')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) })
    ;(globalThis as any).fetch = fetchMock

    const env = { STRIPE_SECRET_KEY: 'sk_test' } as any
    const result = await findCustomerByFirebaseUid(env, 'uid_nope')
    expect(result).toBeUndefined()
  })

  it('returns undefined when Stripe request fails', async () => {
    const { findCustomerByFirebaseUid } = await import('./stripe')
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    ;(globalThis as any).fetch = fetchMock

    const env = { STRIPE_SECRET_KEY: 'sk_test' } as any
    const result = await findCustomerByFirebaseUid(env, 'uid_123')
    expect(result).toBeUndefined()
  })
})
