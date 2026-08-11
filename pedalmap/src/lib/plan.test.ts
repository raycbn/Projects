import { describe, expect, it } from 'vitest'
import { isPremiumUser } from '@/lib/plan'

describe('isPremiumUser', () => {
  it('is true only for premium plan', () => {
    expect(isPremiumUser({ plan: 'premium' })).toBe(true)
    expect(isPremiumUser({ plan: 'free' })).toBe(false)
    expect(isPremiumUser(null)).toBe(false)
    expect(isPremiumUser(undefined)).toBe(false)
  })
})
