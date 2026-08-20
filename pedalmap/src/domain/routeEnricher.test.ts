import { describe, expect, it } from 'vitest'
import {
  attachRouteEnrichment,
  emptyRouteEnrichment,
  longestDryStretchMeters,
} from '@/domain/routeEnricher'
import type { RouteStats } from '@/domain/types'

const stats: RouteStats = {
  distanceMeters: 20000,
  elevationGainMeters: 200,
  elevationLossMeters: 200,
  estimatedDurationSeconds: 3600,
  difficulty: 'easy',
  surfaceStats: { pavedPercent: 100, unpavedPercent: 0 },
}

describe('routeEnricher', () => {
  it('empty enrichment has no water points', () => {
    expect(emptyRouteEnrichment().waterPoints).toBeUndefined()
    expect(longestDryStretchMeters(20000, undefined)).toBeUndefined()
  })

  it('longest dry stretch is full route when no water points', () => {
    expect(longestDryStretchMeters(20000, [])).toBeUndefined()
  })

  it('longest dry stretch accounts for known points along route', () => {
    const water = [
      { id: 'w1', position: { lat: 40.4, lng: -3.7 }, distanceAlongRouteMeters: 5000 },
      { id: 'w2', position: { lat: 40.41, lng: -3.69 }, distanceAlongRouteMeters: 15000 },
    ]
    expect(longestDryStretchMeters(20000, water)).toBe(10000) // between 5000 and 15000
  })

  it('longest dry stretch respects endpoints', () => {
    const water = [{ id: 'w1', position: { lat: 40.4, lng: -3.7 }, distanceAlongRouteMeters: 8000 }]
    expect(longestDryStretchMeters(20000, water)).toBe(12000) // 20000 - 8000
  })

  it('attachRouteEnrichment keeps route shape', () => {
    const enriched = attachRouteEnrichment(stats)
    expect(enriched.enrichment).toBeDefined()
    expect((enriched as RouteStats).distanceMeters).toBe(20000)
  })
})
