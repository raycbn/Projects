import { describe, expect, it } from 'vitest'
import {
  FREE_SELECTABLE_ROUTE_OPTIONS,
  isRouteOptionPremiumLocked,
} from './routeOptionAccess'
import type { RouteAlternative, RouteStats } from '@/domain/types'

const stats: RouteStats = {
  distanceMeters: 10000,
  elevationGainMeters: 100,
  elevationLossMeters: 80,
  estimatedDurationSeconds: 3600,
  difficulty: 'moderate',
}

function opt(rank: number): RouteAlternative {
  return {
    id: `opt-${rank}`,
    label: `Opción ${rank}`,
    rank,
    geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
    elevationProfile: [],
    stats,
  }
}

describe('routeOptionAccess', () => {
  it('keeps top Free options unlocked', () => {
    expect(FREE_SELECTABLE_ROUTE_OPTIONS).toBe(2)
    expect(isRouteOptionPremiumLocked(opt(1), false)).toBe(false)
    expect(isRouteOptionPremiumLocked(opt(2), false)).toBe(false)
  })

  it('locks 3rd option for Free and unlocks for Premium', () => {
    expect(isRouteOptionPremiumLocked(opt(3), false)).toBe(true)
    expect(isRouteOptionPremiumLocked(opt(3), true)).toBe(false)
  })
})
