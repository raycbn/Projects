import { describe, expect, it } from 'vitest'
import { applyPremiumAllowlist, isAllowlistedPremiumEmail } from './premiumAllowlist'

describe('premiumAllowlist', () => {
  it('matches configured emails case-insensitively', () => {
    expect(isAllowlistedPremiumEmail('RayVF2002@gmail.com')).toBe(true)
    expect(isAllowlistedPremiumEmail('raymel.vb@gmail.com')).toBe(true)
    expect(isAllowlistedPremiumEmail('other@gmail.com')).toBe(false)
  })

  it('upgrades free profiles on the allowlist', () => {
    const profile = applyPremiumAllowlist({
      uid: 'u1',
      email: 'rayvf2002@gmail.com',
      displayName: 'Ray',
      photoURL: null,
      plan: 'free',
      createdAt: 1,
      updatedAt: 1,
    })
    expect(profile.plan).toBe('premium')
  })
})
