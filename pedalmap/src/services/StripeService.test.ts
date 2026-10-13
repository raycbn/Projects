import { afterEach, describe, expect, it, vi } from 'vitest'
import { StripeService } from './StripeService'

vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
  isFirebaseConfigured: () => true,
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('StripeService hosted checkout configuration', () => {
  it('does not require Stripe.js publishable key for Worker-hosted Checkout', () => {
    vi.stubEnv('VITE_STRIPE_ENABLED', 'true')
    vi.stubEnv('VITE_PEDALMAP_API_URL', 'https://pedalmap-api.broken-dietician.workers.dev')
    vi.stubEnv('VITE_ROUTING_PROXY_URL', '')
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', '')

    expect(new StripeService().isConfigured()).toBe(true)
  })

  it('keeps hosted Checkout disabled when its explicit feature flag is off', () => {
    vi.stubEnv('VITE_STRIPE_ENABLED', 'false')
    vi.stubEnv('VITE_PEDALMAP_API_URL', 'https://pedalmap-api.broken-dietician.workers.dev')
    vi.stubEnv('VITE_ROUTING_PROXY_URL', '')

    expect(new StripeService().isConfigured()).toBe(false)
  })
})
