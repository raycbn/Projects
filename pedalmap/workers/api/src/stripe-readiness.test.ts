import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleStripeReadiness } from './stripe'
import type { Env } from './types'

const originalFetch = globalThis.fetch

const liveEnv = {
  STRIPE_SECRET_KEY: 'sk_live_readiness_test_secret',
  STRIPE_PRICE_MONTHLY: 'price_solo_month',
  STRIPE_PRICE_YEARLY: 'price_solo_year',
  STRIPE_PRICE_GRUPETA_MONTHLY: 'price_group_month',
  STRIPE_PRICE_GRUPETA_YEARLY: 'price_group_year',
} as Env

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('read-only Stripe readiness', () => {
  it('validates every configured product price is active and in live mode', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const id = url.split('/').pop() || ''
      return new Response(JSON.stringify({ id, active: true, livemode: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const response = await handleStripeReadiness(liveEnv)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      mode: 'live',
      secretConfigured: true,
      prices: [
        { name: 'soloMonthly', valid: true },
        { name: 'soloYearly', valid: true },
        { name: 'grupetaMonthly', valid: true },
        { name: 'grupetaYearly', valid: true },
      ],
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('fails closed for a test-mode Stripe key without making API calls', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const response = await handleStripeReadiness({
      ...liveEnv,
      STRIPE_SECRET_KEY: 'sk_test_readiness_test_secret',
    } as Env)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      mode: 'test',
      secretConfigured: true,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails when Stripe accepts the request but a configured price is inactive or not live', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const id = String(input).split('/').pop() || ''
      return new Response(
        JSON.stringify({ id, active: id !== 'price_group_year', livemode: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof globalThis.fetch

    const response = await handleStripeReadiness(liveEnv)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      mode: 'live',
      prices: expect.arrayContaining([{ name: 'grupetaYearly', valid: false }]),
    })
  })
})
