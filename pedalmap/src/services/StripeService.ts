import { httpsCallable } from 'firebase/functions'
import { getFirebaseFunctions, isFirebaseConfigured } from '@/lib/firebase'
import { track } from '@/lib/analytics'

export type CheckoutInterval = 'month' | 'year'

export class StripeService {
  isConfigured(): boolean {
    return (
      isFirebaseConfigured() &&
      String(import.meta.env.VITE_STRIPE_ENABLED || '').toLowerCase() === 'true'
    )
  }

  /**
   * Starts Stripe Checkout via Cloud Function.
   * Requires Blaze + deployed `createCheckoutSession` + Stripe secrets.
   */
  async startCheckout(interval: CheckoutInterval = 'month'): Promise<{ url: string }> {
    if (!this.isConfigured()) {
      throw new Error('Stripe aún no está activado en este entorno')
    }
    track('premium_clicked', { source: 'stripe_checkout', interval })
    const callable = httpsCallable<{ interval: CheckoutInterval }, { url: string }>(
      getFirebaseFunctions(),
      'createCheckoutSession',
    )
    const result = await callable({ interval })
    if (!result.data?.url) throw new Error('Checkout sin URL')
    return result.data
  }

  async openCustomerPortal(): Promise<{ url: string }> {
    if (!this.isConfigured()) {
      throw new Error('Stripe aún no está activado en este entorno')
    }
    const callable = httpsCallable<Record<string, never>, { url: string }>(
      getFirebaseFunctions(),
      'createCustomerPortalSession',
    )
    const result = await callable({})
    if (!result.data?.url) throw new Error('Portal sin URL')
    return result.data
  }
}

export const stripeService = new StripeService()
