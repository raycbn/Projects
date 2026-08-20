import { describe, expect, it } from 'vitest'
import type { RouteGeometry } from '@/domain/types'
import { buildWaterPointsAlongRoute } from '@/domain/routeEnrichmentBuilder'

const straight: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [-3.7, 40.4],
    [-3.69, 40.41],
    [-3.68, 40.42],
    [-3.67, 40.41],
    [-3.66, 40.4],
  ] as [number, number][],
}

describe('buildWaterPointsAlongRoute', () => {
  it('returns empty for empty geometry or sources', () => {
    expect(buildWaterPointsAlongRoute({ geometry: straight, sources: [] })).toEqual([])
    expect(buildWaterPointsAlongRoute({ geometry: { type: 'LineString', coordinates: [] }, sources: [{ id: 'x', position: { lat: 0, lng: 0 } }] })).toEqual([])
  })

  it('projects nearby sources and assigns distanceAlongRouteMeters', () => {
    const sources = [
      { id: 'w1', position: { lat: 40.4005, lng: -3.6995 } },
      { id: 'w2', position: { lat: 40.4105, lng: -3.6895 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result).toHaveLength(2)
    expect(typeof result[0].distanceAlongRouteMeters).toBe('number')
    expect(result[0].distanceAlongRouteMeters!).toBeGreaterThanOrEqual(0)
    expect(result[0].distanceAlongRouteMeters!).toBeLessThan(result[1].distanceAlongRouteMeters!)
  })

  it('filters out sources too far from route', () => {
    const sources = [
      { id: 'far', position: { lat: 41, lng: -3 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result).toEqual([])
  })

  it('deduplicates nearby sources', () => {
    const sources = [
      { id: 'w1', position: { lat: 40.4005, lng: -3.6995 } },
      { id: 'w2', position: { lat: 40.40051, lng: -3.69951 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources, minSeparationMeters: 50 })
    expect(result.length).toBeLessThanOrEqual(1)
  })

  it('limits results to maxVisible', () => {
    const sources = Array.from({ length: 20 }, (_, i) => ({
      id: `w${i}`,
      position: { lat: 40.4 + i * 0.001, lng: -3.7 + i * 0.001 },
    }))
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources, maxVisible: 5 })
    expect(result).toHaveLength(5)
  })

  it('sorts along route direction', () => {
    const sources = [
      { id: 'end', position: { lat: 40.42, lng: -3.68 } },
      { id: 'start', position: { lat: 40.4005, lng: -3.6995 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result[0].id).toBe('start')
    expect(result[1].id).toBe('end')
  })

  it('respects maxDetourMeters', () => {
    const sources = [
      { id: 'far', position: { lat: 40.5, lng: -3.6 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources, maxDetourMeters: 100 })
    expect(result).toEqual([])
  })
})
