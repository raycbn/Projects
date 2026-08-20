import { describe, expect, it } from 'vitest'
import { evaluatePlan, type EvaluatePlanInput } from './entitlementRules'

const baseInput: EvaluatePlanInput = {
  allowlisted: false,
  sub: null,
  customerId: undefined,
  stripeSubs: [],
  email: null,
  emailVerified: false,
  hasGrupetaSeat: false,
  annualTrialUsed: false,
}

describe('evaluatePlan', () => {
  it('firestore activo → premium', () => {
    const result = evaluatePlan({
      ...baseInput,
      sub: {
        status: 'active',
        soloStatus: 'active',
        soloSubscriptionId: 'sub_solo_123',
        plan: 'premium',
      },
    })
    expect(result.plan).toBe('premium')
    expect(result.shouldUpsert).toBe(false)
    expect(result.shouldWritePlan).toBe(false)
    expect(result.product).toBe('solo')
  })

  it('firestore vacío + stripe activo → premium + shouldUpsert', () => {
    const result = evaluatePlan({
      ...baseInput,
      customerId: 'cus_123',
      stripeSubs: [
        { status: 'active', product: 'solo', id: 'sub_123', hasTrialed: false },
      ],
    })
    expect(result.plan).toBe('premium')
    expect(result.shouldUpsert).toBe(true)
    expect(result.shouldWritePlan).toBe(true)
    expect(result.product).toBe('solo')
    expect(result.stripeSubscriptionId).toBe('sub_123')
  })

  it('firestore + stripe sin suscripción de pago → free', () => {
    const result = evaluatePlan({
      ...baseInput,
      sub: { status: 'canceled' },
      customerId: 'cus_123',
      stripeSubs: [
        { status: 'canceled', product: 'solo', id: 'sub_123', hasTrialed: false },
      ],
    })
    expect(result.plan).toBe('free')
    expect(result.shouldUpsert).toBe(false)
    expect(result.shouldWritePlan).toBe(true)
  })

  it('usuario free sin customer → free', () => {
    const result = evaluatePlan({
      ...baseInput,
      sub: null,
      customerId: undefined,
      stripeSubs: [],
    })
    expect(result.plan).toBe('free')
    expect(result.shouldUpsert).toBe(false)
    expect(result.shouldWritePlan).toBe(true)
  })
})
