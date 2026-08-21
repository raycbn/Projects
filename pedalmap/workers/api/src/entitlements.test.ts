import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resolveEffectivePlan } from './entitlements'
import * as firestore from './firestore'
import * as stripe from './stripe'
import * as premiumAllowlist from './premiumAllowlist'
import * as grupetaPack from './grupetaPack'
import type { Env } from './types'

const mockEnv = (): Env => ({
  ORS_API_KEY: '',
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: '',
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'sa@test',
    private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    project_id: 'test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'test',
  STRIPE_PRICE_MONTHLY: 'price_month',
  STRIPE_PRICE_YEARLY: 'price_year',
  STRIPE_PRICE_GRUPETA_MONTHLY: 'price_g_month',
  STRIPE_PRICE_GRUPETA_YEARLY: 'price_g_year',
  APP_URL: 'https://pedalmap.es',
  ALLOWED_ORIGINS: '',
  PREMIUM_ALLOWLIST: '',
  RECONCILE_OPS_TOKEN: 'secret-token',
})

describe('resolveEffectivePlan fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.resetAllMocks()
    vi.spyOn(firestore, 'writeUserPlan').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'upsertSubscriptionAndPlan').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'readUserEntitlements').mockResolvedValue(null)
  })

  it('firestore activo -> premium', async () => {
    vi.spyOn(firestore, 'readSubscriptionRecord').mockResolvedValue({ status: 'active', soloStatus: 'active', soloSubscriptionId: 'sub_123' })
    vi.spyOn(firestore, 'readSubscriptionCustomerId').mockResolvedValue(undefined)
    vi.spyOn(stripe, 'findCustomerByFirebaseUid').mockResolvedValue(undefined)
    vi.spyOn(stripe, 'listCustomerSubscriptions').mockResolvedValue([])
    vi.spyOn(premiumAllowlist, 'isAllowlistedPremiumEmail').mockReturnValue(false)
    vi.spyOn(grupetaPack, 'grantPremiumFromGrupetaSeat').mockResolvedValue(false)
    vi.spyOn(firestore, 'readSeatIndex').mockResolvedValue(null)

    const result = await resolveEffectivePlan(mockEnv(), { uid: 'uid_123', emailVerified: true, isAnonymous: false })
    expect(result.plan).toBe('premium')
  })

  it('firestore vacio + stripe activo via fallback -> premium', async () => {
    vi.spyOn(firestore, 'readSubscriptionRecord').mockResolvedValue(null)
    vi.spyOn(firestore, 'readSubscriptionCustomerId').mockResolvedValue(undefined)
    vi.spyOn(stripe, 'findCustomerByFirebaseUid').mockResolvedValue('cus_123')
    vi.spyOn(stripe, 'listCustomerSubscriptions').mockResolvedValue([{ status: 'active', product: 'solo', id: 'sub_123', hasTrialed: false }])
    vi.spyOn(premiumAllowlist, 'isAllowlistedPremiumEmail').mockReturnValue(false)
    vi.spyOn(grupetaPack, 'grantPremiumFromGrupetaSeat').mockResolvedValue(false)
    vi.spyOn(firestore, 'readSeatIndex').mockResolvedValue(null)

    const result = await resolveEffectivePlan(mockEnv(), { uid: 'uid_123', emailVerified: true, isAnonymous: false })
    expect(result.plan).toBe('premium')
  })

  it('firestore vacio + stripe customer no recuperable -> free', async () => {
    vi.spyOn(firestore, 'readSubscriptionRecord').mockResolvedValue(null)
    vi.spyOn(firestore, 'readSubscriptionCustomerId').mockResolvedValue(undefined)
    vi.spyOn(stripe, 'findCustomerByFirebaseUid').mockResolvedValue(undefined)
    vi.spyOn(stripe, 'listCustomerSubscriptions').mockResolvedValue([])
    vi.spyOn(premiumAllowlist, 'isAllowlistedPremiumEmail').mockReturnValue(false)
    vi.spyOn(grupetaPack, 'grantPremiumFromGrupetaSeat').mockResolvedValue(false)
    vi.spyOn(firestore, 'readSeatIndex').mockResolvedValue(null)

    const result = await resolveEffectivePlan(mockEnv(), { uid: 'uid_123', emailVerified: true, isAnonymous: false })
    expect(result.plan).toBe('free')
  })

  it('stripe cancelado -> free', async () => {
    vi.spyOn(firestore, 'readSubscriptionRecord').mockResolvedValue(null)
    vi.spyOn(firestore, 'readSubscriptionCustomerId').mockResolvedValue(undefined)
    vi.spyOn(stripe, 'findCustomerByFirebaseUid').mockResolvedValue('cus_123')
    vi.spyOn(stripe, 'listCustomerSubscriptions').mockResolvedValue([{ status: 'canceled', product: 'solo', id: 'sub_123', hasTrialed: false }])
    vi.spyOn(premiumAllowlist, 'isAllowlistedPremiumEmail').mockReturnValue(false)
    vi.spyOn(grupetaPack, 'grantPremiumFromGrupetaSeat').mockResolvedValue(false)
    vi.spyOn(firestore, 'readSeatIndex').mockResolvedValue(null)

    const result = await resolveEffectivePlan(mockEnv(), { uid: 'uid_123', emailVerified: true, isAnonymous: false })
    expect(result.plan).toBe('free')
  })
})
