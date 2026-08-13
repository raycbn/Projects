import { describe, expect, it } from 'vitest'
import {
  applyPreferenceToggle,
  canCreateRoute,
  canEnableWindAlertOnRoute,
  canExportGpx,
  canSaveRoute,
  canUseAdvancedCircular,
  clampPreferencesForPlan,
  freeCircularRemaining,
  freeGpxRemaining,
  isFreeRoutingToggle,
  maxActivePreferences,
  windAlertRouteLimit,
  windAlertRoutesRemaining,
} from '@/services/EntitlementService'
import type { UserProfile } from '@/domain/types'
import { computeActivityStats } from '@/services/ActivityRepository'
import { FREE_LIMITS, FREE_TRIALS } from '@/domain/types'
import { isoWeekKey, utcMonthKey } from '@/lib/freemium'

function profile(partial: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'u1',
    email: 'a@b.com',
    displayName: 'A',
    photoURL: null,
    plan: 'free',
    bikePreferences: { bikeType: 'road', preferences: [] },
    usage: { routesCreatedThisMonth: 0, routesSaved: 0, monthKey: utcMonthKey() },
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('entitlements', () => {
  it('allows guest creates up to Free monthly budget', () => {
    expect(canCreateRoute(null, 0).ok).toBe(true)
    expect(canCreateRoute(null, 3).ok).toBe(true)
    expect(canCreateRoute(null, FREE_LIMITS.maxRoutesCreatedPerMonth).ok).toBe(false)
  })

  it('blocks free save limit', () => {
    expect(
      canSaveRoute(
        profile({ usage: { routesCreatedThisMonth: 0, routesSaved: 5, monthKey: utcMonthKey() } }),
      ).ok,
    ).toBe(false)
  })

  it('allows free weekly GPX trial then blocks', () => {
    const fresh = profile()
    expect(canExportGpx(fresh)).toBe(true)
    expect(freeGpxRemaining(fresh)).toBe(FREE_TRIALS.gpxPerWeek)
    const used = profile({
      usage: {
        routesCreatedThisMonth: 0,
        routesSaved: 0,
        monthKey: utcMonthKey(),
        freeGpxWeekKey: isoWeekKey(),
        freeGpxUsedThisWeek: 1,
      },
    })
    expect(canExportGpx(used)).toBe(false)
    expect(canExportGpx(profile({ plan: 'premium' }))).toBe(true)
  })

  it('allows one free Objetivo per month', () => {
    expect(canUseAdvancedCircular(null)).toBe(true)
    expect(canUseAdvancedCircular(profile())).toBe(true)
    expect(freeCircularRemaining(profile())).toBe(FREE_TRIALS.circularPerMonth)
    const used = profile({
      usage: {
        routesCreatedThisMonth: 1,
        routesSaved: 0,
        monthKey: utcMonthKey(),
        freeCircularUsedThisMonth: 1,
      },
    })
    expect(canUseAdvancedCircular(used)).toBe(false)
    expect(canUseAdvancedCircular(profile({ plan: 'premium' }))).toBe(true)
  })

  it('allows multi-select preferences with free cap of 2', () => {
    expect(FREE_LIMITS.maxActivePreferences).toBe(2)
    expect(maxActivePreferences(profile({ plan: 'free' }))).toBe(2)
    expect(maxActivePreferences(profile({ plan: 'premium' }))).toBe(Number.POSITIVE_INFINITY)

    const first = applyPreferenceToggle([], 'prefer_shorter', profile({ plan: 'free' }))
    expect(first.ok).toBe(true)
    const second = applyPreferenceToggle(first.next, 'avoid_traffic', profile({ plan: 'free' }))
    expect(second.ok).toBe(true)
    expect(second.next).toHaveLength(2)
    const third = applyPreferenceToggle(second.next, 'prefer_secondary_roads', profile({ plan: 'free' }))
    expect(third.ok).toBe(false)
    if (!third.ok) expect(third.reason).toBe('filter_limit')

    const premium = applyPreferenceToggle(second.next, 'prefer_secondary_roads', profile({ plan: 'premium' }))
    expect(premium.ok).toBe(true)
    if (premium.ok) expect(premium.next).toHaveLength(3)
  })

  it('never counts prefer_bike_lanes / prefer_less_elevation against the Free filter cap', () => {
    expect(isFreeRoutingToggle('prefer_bike_lanes')).toBe(true)
    expect(isFreeRoutingToggle('prefer_less_elevation')).toBe(true)
    expect(isFreeRoutingToggle('avoid_traffic')).toBe(false)

    const free = profile({ plan: 'free' })
    let prefs: import('@/domain/types').RoutePreference[] = []
    for (const id of ['prefer_bike_lanes', 'prefer_less_elevation', 'prefer_shorter', 'avoid_traffic'] as const) {
      const result = applyPreferenceToggle(prefs, id, free)
      expect(result.ok, id).toBe(true)
      if (result.ok) prefs = result.next
    }
    // Both free toggles + 2 counted (Free cap) all stayed active — the two free
    // toggles never consumed a slot.
    expect(prefs).toEqual(['prefer_bike_lanes', 'prefer_less_elevation', 'prefer_shorter', 'avoid_traffic'])

    const overLimit = applyPreferenceToggle(prefs, 'prefer_secondary_roads', free)
    expect(overLimit.ok).toBe(false)
    if (!overLimit.ok) expect(overLimit.reason).toBe('filter_limit')
  })

  it('clamps preferences for free plan', () => {
    const filtered = clampPreferencesForPlan(
      ['prefer_shorter', 'avoid_primary_roads', 'prefer_unpaved'],
      profile({ plan: 'free' }),
    )
    expect(filtered).toHaveLength(2)
  })

  it('clamps counted preferences but always keeps free routing toggles', () => {
    const filtered = clampPreferencesForPlan(
      ['prefer_bike_lanes', 'prefer_shorter', 'avoid_primary_roads', 'prefer_unpaved', 'prefer_less_elevation'],
      profile({ plan: 'free' }),
    )
    expect(filtered).toContain('prefer_bike_lanes')
    expect(filtered).toContain('prefer_less_elevation')
    expect(filtered.filter((id) => !isFreeRoutingToggle(id))).toHaveLength(2)
  })

  it('limits Free wind-alert routes and requires master switch', () => {
    const free = profile({ notifications: { windAlertsEnabled: true } })
    expect(windAlertRouteLimit(free)).toBe(FREE_TRIALS.windAlertRoutes)
    expect(windAlertRouteLimit(profile({ plan: 'premium' }))).toBe(Number.POSITIVE_INFINITY)

    const routes = [
      { id: 'r1', windAlertEnabled: true },
      { id: 'r2', windAlertEnabled: false },
    ]
    expect(windAlertRoutesRemaining(free, routes)).toBe(0)
    expect(canEnableWindAlertOnRoute(free, routes, 'r2').ok).toBe(false)
    expect(canEnableWindAlertOnRoute(free, routes, 'r2').reason).toBe('alert_route_limit')
    expect(canEnableWindAlertOnRoute(free, routes, 'r1').ok).toBe(true)

    const off = profile({ notifications: { windAlertsEnabled: false } })
    expect(canEnableWindAlertOnRoute(off, [{ id: 'r1' }], 'r1').reason).toBe('alerts_off')

    const premium = profile({
      plan: 'premium',
      notifications: { windAlertsEnabled: true },
    })
    expect(canEnableWindAlertOnRoute(premium, routes, 'r2').ok).toBe(true)
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

  it('keeps distance and elevation at 0 with a single GPS point', () => {
    const startedAt = '2026-08-10T10:00:00.000Z'
    const stats = computeActivityStats(
      [
        {
          position: { lat: 40.4, lng: -3.7 },
          elevationMeters: 100,
          recordedAt: startedAt,
        },
      ],
      startedAt,
      '2026-08-10T10:05:00.000Z',
      { durationSeconds: 120 },
    )
    expect(stats.distanceMeters).toBe(0)
    expect(stats.elevationGainMeters).toBe(0)
    expect(stats.durationSeconds).toBe(120)
  })

  it('honors pause-aware durationSeconds override', () => {
    const startedAt = '2026-08-10T10:00:00.000Z'
    const finishedAt = '2026-08-10T11:00:00.000Z'
    const stats = computeActivityStats(
      [
        {
          position: { lat: 40.4, lng: -3.7 },
          elevationMeters: 100,
          recordedAt: startedAt,
        },
        {
          position: { lat: 40.405, lng: -3.7 },
          elevationMeters: 110,
          recordedAt: '2026-08-10T10:20:00.000Z',
        },
      ],
      startedAt,
      finishedAt,
      { durationSeconds: 1800 },
    )
    expect(stats.durationSeconds).toBe(1800)
    expect(stats.distanceMeters).toBeGreaterThan(400)
  })
})
