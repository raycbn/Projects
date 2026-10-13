import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from 'vitest'

const stripeMocks = vi.hoisted(() => ({
  firebaseAuth: {
    verifyFirebaseIdToken: vi.fn(),
  },
  firestore: {
    claimWebhookEvent: vi.fn(),
    markWebhookEventProcessed: vi.fn(),
    claimCheckoutLock: vi.fn(),
    finalizeCheckoutLock: vi.fn(),
    releaseCheckoutLock: vi.fn(),
    readSubscriptionRecord: vi.fn(),
    upsertSubscriptionAndPlan: vi.fn(),
    writeSubscriptionCustomerId: vi.fn(),
    readSubscriptionCustomerId: vi.fn(),
  },
  grupetaPack: {
    activateGrupetaPack: vi.fn(),
    deactivateGrupetaPack: vi.fn(),
    GRUPETA_SEAT_LIMIT: 4,
  },
}))

vi.mock('./firebaseAuth', () => stripeMocks.firebaseAuth)
vi.mock('./firestore', () => stripeMocks.firestore)
vi.mock('./grupetaPack', () => stripeMocks.grupetaPack)

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
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        metadata: { firebaseUid: 'uid_1', product: 'solo' },
        status: 'active',
        trial_end: null,
        items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      }),
    })
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

    stripeMocks.firestore.claimWebhookEvent.mockResolvedValue('claimed')
    stripeMocks.firestore.markWebhookEventProcessed.mockResolvedValue(undefined)
    stripeMocks.firestore.readSubscriptionRecord.mockResolvedValue(null)
    stripeMocks.firestore.upsertSubscriptionAndPlan.mockResolvedValue(undefined)
    stripeMocks.firestore.writeSubscriptionCustomerId.mockResolvedValue(undefined)
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue(undefined)
    stripeMocks.firestore.releaseCheckoutLock.mockResolvedValue(undefined)
    stripeMocks.grupetaPack.activateGrupetaPack.mockResolvedValue(undefined)
    stripeMocks.grupetaPack.deactivateGrupetaPack.mockResolvedValue(undefined)

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

  it('rejects missing and invalid webhook signatures before claiming the event', async () => {
    const { handleWebhook } = await import('./stripe')
    const payload = JSON.stringify({
      id: 'evt_invalid_signature',
      type: 'customer.created',
      data: { object: { id: 'cus_untrusted' } },
    })

    const missingSignature = await handleWebhook(
      new Request('http://localhost/stripe/webhook', {
        method: 'POST',
        body: payload,
      }),
      baseEnv,
    )
    expect(missingSignature.status).toBe(400)
    expect(await missingSignature.json()).toEqual({ error: 'Invalid signature' })

    const timestamp = Math.floor(Date.now() / 1000)
    const invalidSignature = await handleWebhook(
      new Request('http://localhost/stripe/webhook', {
        method: 'POST',
        headers: { 'Stripe-Signature': `t=${timestamp},v1=${'0'.repeat(64)}` },
        body: payload,
      }),
      baseEnv,
    )
    expect(invalidSignature.status).toBe(400)
    expect(await invalidSignature.json()).toEqual({ error: 'Invalid signature' })
    expect(stripeMocks.firestore.claimWebhookEvent).not.toHaveBeenCalled()
    expect(stripeMocks.firestore.markWebhookEventProcessed).not.toHaveBeenCalled()
  })

  it('fails closed when the webhook secret is not configured', async () => {
    const { handleWebhook } = await import('./stripe')
    const payload = JSON.stringify({
      id: 'evt_no_webhook_secret',
      type: 'customer.created',
      data: { object: { id: 'cus_untrusted' } },
    })

    const res = await handleWebhook(
      new Request('http://localhost/stripe/webhook', {
        method: 'POST',
        body: payload,
      }),
      { ...baseEnv, STRIPE_WEBHOOK_SECRET: '' },
    )

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Webhook secret not configured' })
    expect(stripeMocks.firestore.claimWebhookEvent).not.toHaveBeenCalled()
    expect(stripeMocks.firestore.markWebhookEventProcessed).not.toHaveBeenCalled()
  })

  it('does not mark a webhook completed when subscription persistence fails', async () => {
    const { handleWebhook } = await import('./stripe')
    const uid = 'uid_retryable_webhook'
    const subscription = {
      metadata: { firebaseUid: uid, product: 'solo' },
      status: 'active',
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      trial_end: null,
    }
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(subscription),
    })
    stripeMocks.firestore.upsertSubscriptionAndPlan.mockRejectedValueOnce(
      new Error('temporary Firestore failure'),
    )

    const payload = JSON.stringify({
      id: 'evt_retryable_after_failure',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_retryable',
          customer: 'cus_retryable',
          subscription: 'sub_retryable',
          status: 'active',
          metadata: {},
          customer_details: { email: 'owner@example.test' },
        },
      },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signStripePayload('whsec', `${timestamp}.${payload}`)
    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Webhook handler failed' })
    expect(stripeMocks.firestore.upsertSubscriptionAndPlan).toHaveBeenCalledWith(
      baseEnv,
      expect.objectContaining({ uid, plan: 'premium' }),
    )
    expect(stripeMocks.firestore.markWebhookEventProcessed).not.toHaveBeenCalled()
  })

  it('customer.subscription.created activa premium para el caso real', async () => {
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

  it('marks intentionally ignored Stripe event types as completed before acknowledging them', async () => {
    const { handleWebhook } = await import('./stripe')
    const payload = JSON.stringify({
      id: 'evt_ignored_type',
      type: 'customer.created',
      data: { object: { id: 'cus_ignored' } },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signStripePayload('whsec', `${timestamp}.${payload}`)
    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, ignored: true })
    expect(stripeMocks.firestore.markWebhookEventProcessed).toHaveBeenCalledWith(baseEnv, 'evt_ignored_type')
  })

  it('uses subscription status, then releases the matching checkout lock after persistence', async () => {
    const { handleWebhook } = await import('./stripe')
    const uid = 'uid_checkout_complete'
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/subscriptions/sub_checkout_complete')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            metadata: { firebaseUid: uid, product: 'solo' },
            status: 'active',
            trial_end: null,
            items: { data: [{ price: { recurring: { interval: 'month' } } }] },
          }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
    }) as typeof globalThis.fetch

    const payload = JSON.stringify({
      id: 'evt_checkout_completed',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_checkout_completed',
          customer: 'cus_checkout_complete',
          subscription: 'sub_checkout_complete',
          status: 'complete',
          metadata: { firebaseUid: uid, product: 'solo' },
        },
      },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signStripePayload('whsec', `${timestamp}.${payload}`)
    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)
    expect(res.status).toBe(200)
    expect(stripeMocks.firestore.upsertSubscriptionAndPlan).toHaveBeenCalledWith(
      baseEnv,
      expect.objectContaining({ uid, plan: 'premium', status: 'active', soloStatus: 'active' }),
    )
    expect(stripeMocks.firestore.releaseCheckoutLock).toHaveBeenCalledWith(
      baseEnv,
      uid,
      { sessionId: 'cs_checkout_completed' },
    )
    expect(stripeMocks.firestore.upsertSubscriptionAndPlan.mock.invocationCallOrder[0]).toBeLessThan(
      stripeMocks.firestore.releaseCheckoutLock.mock.invocationCallOrder[0],
    )
    expect(stripeMocks.firestore.markWebhookEventProcessed.mock.invocationCallOrder[0]).toBeGreaterThan(
      stripeMocks.firestore.releaseCheckoutLock.mock.invocationCallOrder[0],
    )
  })

  it('returns 503 when an event is still processing so Stripe retries instead of losing it', async () => {
    stripeMocks.firestore.claimWebhookEvent.mockResolvedValue('in_progress')
    const { handleWebhook } = await import('./stripe')
    const payload = JSON.stringify({
      id: 'evt_still_processing',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_still_processing',
          customer: 'cus_still_processing',
          status: 'active',
          metadata: { firebaseUid: 'uid_retry_test', product: 'solo' },
        },
      },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signStripePayload('whsec', `${timestamp}.${payload}`)
    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: 'Webhook event is still being processed',
      code: 'webhook_in_progress',
    })
    expect(stripeMocks.firestore.upsertSubscriptionAndPlan).not.toHaveBeenCalled()
    expect(stripeMocks.firestore.markWebhookEventProcessed).not.toHaveBeenCalled()
  })

  it('uses the current Stripe subscription state when an update webhook is out of order', async () => {
    const { handleWebhook } = await import('./stripe')
    const uid = 'uid_out_of_order'
    const currentSubscription = {
      metadata: { firebaseUid: uid, product: 'solo' },
      status: 'active',
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      trial_end: null,
    }
    ;(globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/subscriptions/sub_out_of_order')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(currentSubscription) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const payload = JSON.stringify({
      id: 'evt_stale_subscription_update',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_out_of_order',
          customer: 'cus_out_of_order',
          status: 'canceled',
          metadata: { firebaseUid: uid, product: 'solo' },
        },
      },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signStripePayload('whsec', `${timestamp}.${payload}`)
    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)
    expect(res.status).toBe(200)
    expect(stripeMocks.firestore.upsertSubscriptionAndPlan).toHaveBeenCalledWith(
      baseEnv,
      expect.objectContaining({
        uid,
        plan: 'premium',
        status: 'active',
        soloStatus: 'active',
      }),
    )
  })

  it('invoice.payment_succeeded activa premium cuando subscription está activa', async () => {
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
    const firestore = await import('./firestore')
    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(firestore.upsertSubscriptionAndPlan).toHaveBeenCalledTimes(1)
    expect(firestore.upsertSubscriptionAndPlan).toHaveBeenCalledWith(
      baseEnv,
      expect.objectContaining({
        uid: 'spPOB23XOdYbzrj8C2ngSOeah7N2',
        plan: 'premium',
        status: 'active',
        product: 'solo',
        soloStatus: 'active',
      }),
    )
  })

  it('infers Grupeta from the stored subscription id when an invoice omits product metadata', async () => {
    const uid = 'uid_invoice_group'
    stripeMocks.firestore.readSubscriptionRecord.mockResolvedValue({
      soloSubscriptionId: 'sub_solo',
      soloStatus: 'canceled',
      grupetaSubscriptionId: 'sub_group',
      grupetaStatus: 'active',
      annualTrialUsed: false,
    })
    const { handleWebhook } = await import('./stripe')
    ;(globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/subscriptions/sub_group')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            metadata: { firebaseUid: uid },
            status: 'active',
            items: { data: [{ price: { recurring: { interval: 'year' } } }] },
            trial_end: null,
          }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const payload = JSON.stringify({
      id: 'evt_invoice_group',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_group',
          customer: 'cus_invoice_group',
          status: 'paid',
          parent: { subscription_details: { subscription: { id: 'sub_group' } } },
          metadata: {},
          customer_details: { email: 'owner@example.invalid' },
        },
      },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signStripePayload('whsec', `${timestamp}.${payload}`)
    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)
    expect(res.status).toBe(200)
    expect(stripeMocks.firestore.upsertSubscriptionAndPlan).toHaveBeenCalledTimes(1)
    expect(stripeMocks.firestore.upsertSubscriptionAndPlan).toHaveBeenCalledWith(
      baseEnv,
      expect.objectContaining({
        uid,
        plan: 'premium',
        status: 'active',
        product: 'grupeta',
        stripeSubscriptionId: 'sub_group',
        soloSubscriptionId: 'sub_solo',
        soloStatus: 'canceled',
        grupetaSubscriptionId: 'sub_group',
        grupetaStatus: 'active',
      }),
    )
    expect(stripeMocks.grupetaPack.activateGrupetaPack).toHaveBeenCalledTimes(1)
    expect(stripeMocks.grupetaPack.deactivateGrupetaPack).not.toHaveBeenCalled()
  })

  it('ignores a delayed deletion for an older subscription ID', async () => {
    const { handleWebhook } = await import('./stripe')
    const uid = 'uid_newer_subscription'
    stripeMocks.firestore.readSubscriptionRecord.mockResolvedValue({
      soloSubscriptionId: 'sub_newer',
      soloStatus: 'active',
      grupetaSubscriptionId: undefined,
      grupetaStatus: undefined,
      annualTrialUsed: true,
    })
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/subscriptions/sub_older')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            metadata: { firebaseUid: uid, product: 'solo' },
            status: 'canceled',
            items: { data: [{ price: { recurring: { interval: 'month' } } }] },
            trial_end: null,
          }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
    }) as typeof globalThis.fetch

    const payload = JSON.stringify({
      id: 'evt_old_subscription_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_older',
          customer: 'cus_older',
          status: 'canceled',
          metadata: { firebaseUid: uid, product: 'solo' },
        },
      },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signStripePayload('whsec', `${timestamp}.${payload}`)
    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, ignored: true, staleSubscription: true })
    expect(stripeMocks.firestore.upsertSubscriptionAndPlan).not.toHaveBeenCalled()
    expect(stripeMocks.firestore.markWebhookEventProcessed).toHaveBeenCalledWith(
      baseEnv,
      'evt_old_subscription_deleted',
    )
  })

  it('procesa customer.subscription.deleted y persiste la revocación de Premium', async () => {
    const { handleWebhook } = await import('./stripe')
    const firestore = await import('./firestore')
    const uid = 'uid_deleted_test'
    const sub = {
      metadata: { firebaseUid: uid, product: 'solo' },
      status: 'canceled',
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      trial_end: null,
    }

    ;(globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/subscriptions/sub_deleted')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sub) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const payload = JSON.stringify({
      id: 'evt_subscription_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_deleted',
          customer: 'cus_deleted_test',
          status: 'canceled',
          metadata: { firebaseUid: uid, product: 'solo' },
        },
      },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signStripePayload('whsec', `${timestamp}.${payload}`)
    const request = new Request('http://localhost/stripe/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })

    const res = await handleWebhook(request, baseEnv)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(firestore.upsertSubscriptionAndPlan).toHaveBeenCalledTimes(1)
    expect(firestore.upsertSubscriptionAndPlan).toHaveBeenCalledWith(
      baseEnv,
      expect.objectContaining({
        uid,
        plan: 'free',
        status: 'canceled',
        product: 'solo',
        soloStatus: 'canceled',
      }),
    )
    expect(firestore.markWebhookEventProcessed).toHaveBeenCalledWith(baseEnv, 'evt_subscription_deleted')
  })

  it('devuelve 400 cuando falta firebaseUid', async () => {
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
    expect(stripeMocks.firestore.markWebhookEventProcessed).toHaveBeenCalledWith(baseEnv, 'evt_no_uid')
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

  it('fails closed when Stripe customer search fails', async () => {
    const { findCustomerByFirebaseUid } = await import('./stripe')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'temporarily unavailable' }),
    })
    ;(globalThis as any).fetch = fetchMock

    const env = { STRIPE_SECRET_KEY: 'sk_test' } as any
    await expect(findCustomerByFirebaseUid(env, 'uid_123')).rejects.toThrow(
      'Stripe customer lookup failed',
    )
  })
})

describe('Checkout and billing portal lifecycle', () => {
  const checkoutEnv = {
    STRIPE_SECRET_KEY: 'sk_test',
    FIREBASE_PROJECT_ID: 'test',
    APP_URL: 'https://pedalmap.es',
    STRIPE_PRICE_MONTHLY: 'price_solo_month',
    STRIPE_PRICE_YEARLY: 'price_solo_year',
    STRIPE_PRICE_GRUPETA_MONTHLY: 'price_group_month',
    STRIPE_PRICE_GRUPETA_YEARLY: 'price_group_year',
  } as any
  const identity = {
    uid: 'uid_checkout_test',
    email: 'buyer@example.invalid',
    emailVerified: true,
    isAnonymous: false,
  }
  const originalFetch = globalThis.fetch

  const stripeResponse = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as Response

  const checkoutRequest = (payload: Record<string, unknown>) =>
    new Request('https://pedalmap.test/stripe/checkout', {
      method: 'POST',
      headers: { Authorization: 'Bearer unit-test-firebase-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
    stripeMocks.firebaseAuth.verifyFirebaseIdToken.mockResolvedValue(identity)
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue(null)
    stripeMocks.firestore.writeSubscriptionCustomerId.mockResolvedValue(undefined)
    stripeMocks.firestore.readSubscriptionRecord.mockResolvedValue(null)
    stripeMocks.firestore.claimCheckoutLock.mockResolvedValue({ kind: 'claimed', lockToken: 'lock-test-token' })
    stripeMocks.firestore.finalizeCheckoutLock.mockResolvedValue(undefined)
    stripeMocks.firestore.releaseCheckoutLock.mockResolvedValue(undefined)
    globalThis.fetch = vi.fn(async () => stripeResponse({ data: [] })) as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('grants the annual trial once and uses stable Stripe idempotency keys', async () => {
    const { handleCheckout } = await import('./stripe')
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/customers/search?query=')) return stripeResponse({ data: [] })
      if (url.endsWith('/customers') && init?.method === 'POST') return stripeResponse({ id: 'cus_new' })
      if (url.includes('/subscriptions?customer=')) return stripeResponse({ data: [] })
      if (url.endsWith('/checkout/sessions') && init?.method === 'POST') {
        return stripeResponse({
          id: 'cs_annual_trial',
          status: 'open',
          url: 'https://checkout.stripe.com/cs_annual_trial',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        })
      }
      return stripeResponse({})
    }) as typeof globalThis.fetch

    const res = await handleCheckout(checkoutRequest({ interval: 'year', product: 'solo' }), checkoutEnv)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      url: 'https://checkout.stripe.com/cs_annual_trial',
      product: 'solo',
      interval: 'year',
      trial: true,
    })

    const customerCreate = requests.find(({ url, init }) => url.endsWith('/customers') && init?.method === 'POST')
    const sessionCreate = requests.find(({ url, init }) => url.endsWith('/checkout/sessions') && init?.method === 'POST')
    expect(customerCreate?.init?.headers).toMatchObject({
      'Idempotency-Key': 'pedalmap-customer-uid_checkout_test',
    })
    expect(sessionCreate?.init?.headers).toMatchObject({
      'Idempotency-Key': 'pedalmap-checkout-uid_checkout_test-solo-year',
    })
    const sessionParams = new URLSearchParams(String(sessionCreate?.init?.body ?? ''))
    expect(sessionParams.get('subscription_data[trial_period_days]')).toBe('7')
    expect(stripeMocks.firestore.writeSubscriptionCustomerId).toHaveBeenCalledWith(
      checkoutEnv,
      identity.uid,
      'cus_new',
    )
    expect(stripeMocks.firestore.finalizeCheckoutLock).toHaveBeenCalledWith(
      checkoutEnv,
      identity.uid,
      'lock-test-token',
      expect.objectContaining({
        product: 'solo',
        interval: 'year',
        sessionId: 'cs_annual_trial',
        checkoutUrl: 'https://checkout.stripe.com/cs_annual_trial',
        trial: true,
      }),
    )
  })

  it('does not offer the annual trial again when the stored account flag is set', async () => {
    const { handleCheckout } = await import('./stripe')
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue('cus_existing')
    stripeMocks.firestore.readSubscriptionRecord.mockResolvedValue({ annualTrialUsed: true })
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/subscriptions?customer=')) return stripeResponse({ data: [] })
      if (url.endsWith('/checkout/sessions') && init?.method === 'POST') {
        return stripeResponse({
          id: 'cs_no_trial',
          status: 'open',
          url: 'https://checkout.stripe.com/cs_no_trial',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        })
      }
      return stripeResponse({})
    }) as typeof globalThis.fetch

    const res = await handleCheckout(checkoutRequest({ interval: 'year', product: 'solo' }), checkoutEnv)
    expect(res.status).toBe(200)
    expect((await res.json() as { trial: boolean }).trial).toBe(false)
    const sessionCreate = requests.find(({ url, init }) => url.endsWith('/checkout/sessions') && init?.method === 'POST')
    const sessionParams = new URLSearchParams(String(sessionCreate?.init?.body ?? ''))
    expect(sessionParams.has('subscription_data[trial_period_days]')).toBe(false)
  })

  it('reuses an existing open Checkout Session for the same product and interval', async () => {
    const { handleCheckout } = await import('./stripe')
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue('cus_existing')
    stripeMocks.firestore.claimCheckoutLock.mockResolvedValue({
      kind: 'existing_session',
      sessionId: 'cs_existing',
      checkoutUrl: 'https://checkout.stripe.com/cs_existing',
      product: 'solo',
      interval: 'year',
      trial: true,
      updateTime: 'lock-v1',
    })
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/subscriptions?customer=')) return stripeResponse({ data: [] })
      if (url.endsWith('/checkout/sessions/cs_existing')) {
        return stripeResponse({ status: 'open', url: 'https://checkout.stripe.com/cs_existing' })
      }
      return stripeResponse({})
    }) as typeof globalThis.fetch

    const res = await handleCheckout(checkoutRequest({ interval: 'year', product: 'solo' }), checkoutEnv)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      url: 'https://checkout.stripe.com/cs_existing',
      product: 'solo',
      interval: 'year',
      trial: true,
      reused: true,
    })
    expect(requests.some(({ url, init }) => url.endsWith('/checkout/sessions') && init?.method === 'POST')).toBe(false)
  })

  it('expires the old open session before switching to another product/interval', async () => {
    const { handleCheckout } = await import('./stripe')
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue('cus_existing')
    stripeMocks.firestore.claimCheckoutLock
      .mockResolvedValueOnce({
        kind: 'existing_session',
        sessionId: 'cs_existing',
        checkoutUrl: 'https://checkout.stripe.com/cs_existing',
        product: 'solo',
        interval: 'year',
        trial: true,
        updateTime: 'lock-v1',
      })
      .mockResolvedValueOnce({ kind: 'claimed', lockToken: 'lock-switch-token' })

    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/subscriptions?customer=')) return stripeResponse({ data: [] })
      if (url.endsWith('/checkout/sessions/cs_existing')) {
        return stripeResponse({ status: 'open', url: 'https://checkout.stripe.com/cs_existing' })
      }
      if (url.endsWith('/checkout/sessions/cs_existing/expire') && init?.method === 'POST') {
        return stripeResponse({ id: 'cs_existing', status: 'expired' })
      }
      if (url.endsWith('/checkout/sessions') && init?.method === 'POST') {
        return stripeResponse({
          id: 'cs_group_switch',
          status: 'open',
          url: 'https://checkout.stripe.com/cs_group_switch',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        })
      }
      return stripeResponse({})
    }) as typeof globalThis.fetch

    const res = await handleCheckout(checkoutRequest({ interval: 'month', product: 'grupeta' }), checkoutEnv)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      url: 'https://checkout.stripe.com/cs_group_switch',
      product: 'grupeta',
      interval: 'month',
      trial: false,
    })
    expect(requests.some(({ url, init }) => url.endsWith('/checkout/sessions/cs_existing/expire') && init?.method === 'POST')).toBe(true)
    expect(stripeMocks.firestore.releaseCheckoutLock).toHaveBeenCalledWith(
      checkoutEnv,
      identity.uid,
      { sessionId: 'cs_existing' },
    )
    expect(stripeMocks.firestore.finalizeCheckoutLock).toHaveBeenCalledWith(
      checkoutEnv,
      identity.uid,
      'lock-switch-token',
      expect.objectContaining({ sessionId: 'cs_group_switch', product: 'grupeta', interval: 'month' }),
    )
  })

  it('rejects a second request while another checkout is being created', async () => {
    const { handleCheckout } = await import('./stripe')
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue('cus_existing')
    stripeMocks.firestore.claimCheckoutLock.mockResolvedValue({ kind: 'in_progress' })
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/subscriptions?customer=')) return stripeResponse({ data: [] })
      return stripeResponse({})
    }) as typeof globalThis.fetch

    const res = await handleCheckout(checkoutRequest({ interval: 'month', product: 'solo' }), checkoutEnv)

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'checkout_in_progress' })
    expect(requests.some(({ url, init }) => url.endsWith('/checkout/sessions') && init?.method === 'POST')).toBe(false)
  })

  it('blocks checkout when Stripe reports an existing paying subscription', async () => {
    const { handleCheckout } = await import('./stripe')
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue('cus_active')
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/subscriptions?customer=')) {
        return stripeResponse({ data: [{ id: 'sub_active', status: 'active', metadata: { product: 'solo' } }] })
      }
      return stripeResponse({})
    }) as typeof globalThis.fetch

    const res = await handleCheckout(checkoutRequest({ interval: 'month', product: 'grupeta' }), checkoutEnv)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'already_subscribed' })
    expect(requests.some(({ url }) => url.endsWith('/checkout/sessions'))).toBe(false)
  })

  it('paginates all Stripe subscriptions before allowing a new checkout', async () => {
    const { handleCheckout } = await import('./stripe')
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue('cus_paged')
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `sub_page_${index}`,
      status: 'canceled',
      trial_end: null,
      metadata: { product: 'solo' },
    }))
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/subscriptions?customer=') && url.includes('starting_after=')) {
        return stripeResponse({
          data: [{ id: 'sub_active_on_page_2', status: 'active', trial_end: null, metadata: { product: 'grupeta' } }],
          has_more: false,
        })
      }
      if (url.includes('/subscriptions?customer=')) {
        return stripeResponse({ data: firstPage, has_more: true })
      }
      return stripeResponse({})
    }) as typeof globalThis.fetch

    const res = await handleCheckout(checkoutRequest({ interval: 'month', product: 'solo' }), checkoutEnv)

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'already_subscribed' })
    expect(requests.some(({ url }) => url.includes('starting_after=sub_page_99'))).toBe(true)
    expect(stripeMocks.firestore.claimCheckoutLock).not.toHaveBeenCalled()
    expect(requests.some(({ url, init }) => url.endsWith('/checkout/sessions') && init?.method === 'POST')).toBe(false)
  })

  it('does not create another checkout session when Stripe subscription lookup is unavailable', async () => {
    const { handleCheckout } = await import('./stripe')
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue('cus_existing')
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/subscriptions?customer=')) {
        return stripeResponse({ error: 'temporarily unavailable' }, 503)
      }
      return stripeResponse({})
    }) as typeof globalThis.fetch

    await expect(
      handleCheckout(checkoutRequest({ interval: 'month', product: 'solo' }), checkoutEnv),
    ).rejects.toThrow('Stripe subscription lookup failed')
    expect(requests.some(({ url }) => url.endsWith('/checkout/sessions'))).toBe(false)
  })

  it('recovers a missing Firestore customer pointer when opening the billing portal', async () => {
    const { handlePortal } = await import('./stripe')
    stripeMocks.firestore.readSubscriptionCustomerId.mockResolvedValue(null)
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/customers/search?query=')) {
        return stripeResponse({ data: [{ id: 'cus_recovered' }] })
      }
      if (url.endsWith('/billing_portal/sessions') && init?.method === 'POST') {
        return stripeResponse({ url: 'https://billing.stripe.com/session_test' })
      }
      return stripeResponse({})
    }) as typeof globalThis.fetch

    const req = new Request('https://pedalmap.test/stripe/portal', {
      method: 'POST',
      headers: { Authorization: 'Bearer unit-test-firebase-token' },
    })
    const res = await handlePortal(req, checkoutEnv)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://billing.stripe.com/session_test' })
    expect(stripeMocks.firestore.writeSubscriptionCustomerId).toHaveBeenCalledWith(
      checkoutEnv,
      identity.uid,
      'cus_recovered',
    )
  })
})
