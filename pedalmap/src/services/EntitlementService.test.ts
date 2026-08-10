import { describe, expect, it } from 'vitest'
import {
  canCreateRoute,
  canExportGpx,
  canSaveRoute,
  canUseAdvancedCircular,
  filterPreferencesForPlan,
} from '@/services/EntitlementService'
import type { UserProfile } from '@/domain/types'
import { computeActivityStats } from '@/services/ActivityRepository'

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
    expect(
      canSaveRoute(
        profile({ usage: { routesCreatedThisMonth: 0, routesSaved: 5, monthKey: '2026-08' } }),
      ).ok,
    ).toBe(false)
  })

  it('allows premium gpx export only', () => {
    expect(canExportGpx(profile({ plan: 'free' }))).toBe(false)
    expect(canExportGpx(profile({ plan: 'premium' }))).toBe(true)
  })

  it('gates advanced circular for free signed-in users', () => {
    expect(canUseAdvancedCircular(profile({ plan: 'free' }))).toBe(false)
    expect(canUseAdvancedCircular(profile({ plan: 'premium' }))).toBe(true)
  })

  it('filters premium preferences for free plan', () => {
    const filtered = filterPreferencesForPlan(
      ['prefer_shorter', 'avoid_primary_roads', 'prefer_unpaved'],
      profile({ plan: 'free' }),
    )
    expect(filtered).toEqual(['prefer_shorter'])
  })
})

describe('activity stats', () => {
  it('computes distance and cycling elevation gain from a track', () => {
    const startedAt = '2026-08-10T10:00:00.000Z'
    const finishedAt = '2026-08-10T11:00:00.000Z'
    const stats = computeActivityStats(
      [
        {
          position: { lat: 40.4, lng: -3.7 },
          elevationMeters: 600,
          recordedAt: startedAt,
        },
        {
          position: { lat: 40.41, lng: -3.7 },
          elevationMeters: 650,
          recordedAt: '2026-08-10T10:30:00.000Z',
        },
        {
          position: { lat: 40.42, lng: -3.7 },
          elevationMeters: 620,
          recordedAt: finishedAt,
        },
      ],
      startedAt,
      finishedAt,
    )
    expect(stats.distanceMeters).toBeGreaterThan(1000)
    expect(stats.durationSeconds).toBe(3600)
    expect(stats.elevationGainMeters).toBeGreaterThanOrEqual(40)
  })
})
