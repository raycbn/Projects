import { describe, expect, it } from 'vitest'
import { canCreateRoute, canExportGpx, canSaveRoute } from '@/services/EntitlementService'
import type { UserProfile } from '@/domain/types'

function profile(partial: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'u1',
    email: 'a@b.com',
    displayName: 'A',
    photoURL: null,
    plan: 'free',
    bikePreferences: { bikeType: 'road', preferences: [] },
    usage: { routesCreatedThisMonth: 0, routesSaved: 0, monthKey: '2026-08' },
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('entitlements', () => {
  it('allows limited guest creates', () => {
    expect(canCreateRoute(null, 0).ok).toBe(true)
    expect(canCreateRoute(null, 3).ok).toBe(false)
  })

  it('blocks free save limit', () => {
    expect(canSaveRoute(profile({ usage: { routesCreatedThisMonth: 0, routesSaved: 5, monthKey: '2026-08' } })).ok).toBe(false)
  })

  it('allows premium gpx export only', () => {
    expect(canExportGpx(profile({ plan: 'free' }))).toBe(false)
    expect(canExportGpx(profile({ plan: 'premium' }))).toBe(true)
  })
})
