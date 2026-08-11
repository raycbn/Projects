import { describe, expect, it } from 'vitest'
import { applyPremiumAllowlist, isAllowlistedPremiumEmail } from './premiumAllowlist'

describe('premiumAllowlist', () => {
  it('no longer grants premium from client email lists (server sync only)', () => {
    expect(isAllowlistedPremiumEmail('premium@pedalmap.es')).toBe(false)
    expect(isAllowlistedPremiumEmail('other@gmail.com')).toBe(false)
  })

  it('does not mutate plan client-side', () => {
    const profile = applyPremiumAllowlist({
      email: 'premium@pedalmap.es',
      plan: 'free' as const,
    })
    expect(profile.plan).toBe('free')
  })
})
