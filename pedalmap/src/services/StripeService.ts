import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import { track } from '@/lib/analytics'

export type CheckoutInterval = 'month' | 'year'

function apiBase(): string {
  const url =
    import.meta.env.VITE_PEDALMAP_API_URL ||
    import.meta.env.VITE_ROUTING_PROXY_URL ||
    ''
  return typeof url === 'string' ? url.replace(/\/+$/, '') : ''
}

async function authHeader(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('Debes iniciar sesión')
  const token = await user.getIdToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Stripe via Cloudflare Worker (free tier) — no Firebase Blaze / Functions.
 */
export class StripeService {
  isConfigured(): boolean {
    return (
      isFirebaseConfigured() &&
      String(import.meta.env.VITE_STRIPE_ENABLED || '').toLowerCase() === 'true' &&
      Boolean(apiBase()) &&
      Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
    )
  }

  async startCheckout(interval: CheckoutInterval = 'month'): Promise<{ url: string }> {
    if (!this.isConfigured()) {
      throw new Error('Stripe aún no está activado (Worker API + VITE_STRIPE_ENABLED)')
    }
    track('premium_clicked', { source: 'stripe_checkout', interval })
    const response = await fetch(`${apiBase()}/stripe/checkout`, {
      method: 'POST',
      headers: await authHeader(),
      body: JSON.stringify({ interval }),
    })
    const data = (await response.json()) as { url?: string; error?: string }
    if (!response.ok || !data.url) {
      throw new Error(data.error || 'Checkout sin URL')
    }
    return { url: data.url }
  }

  async openCustomerPortal(): Promise<{ url: string }> {
    if (!this.isConfigured()) {
      throw new Error('Stripe aún no está activado (Worker API + VITE_STRIPE_ENABLED)')
    }
    const response = await fetch(`${apiBase()}/stripe/portal`, {
      method: 'POST',
      headers: await authHeader(),
      body: '{}',
    })
    const data = (await response.json()) as { url?: string; error?: string }
    if (!response.ok || !data.url) {
      throw new Error(data.error || 'Portal sin URL')
    }
    return { url: data.url }
  }
}

export const stripeService = new StripeService()
