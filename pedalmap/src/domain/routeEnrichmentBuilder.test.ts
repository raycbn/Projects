import { describe, expect, it } from 'vitest'
import type { RouteGeometry } from '@/domain/types'
import { buildWaterPointsAlongRoute } from '@/domain/routeEnrichmentBuilder'
import { cumulativeDistances, pointAtDistance } from '@/lib/routeGeometry'

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

  it('assigns distanceAlongRouteMeters > 0 for source on first segment but not at start', () => {
    const sources = [
      { id: 'start', position: { lat: 40.4005, lng: -3.7005 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result).toHaveLength(1)
    expect(result[0].distanceAlongRouteMeters).toBeGreaterThan(0)
  })

  it('does not assign 0m to two sources on different segments', () => {
    const sources = [
      { id: 'seg1', position: { lat: 40.4005, lng: -3.7005 } },
      { id: 'seg2', position: { lat: 40.4105, lng: -3.6895 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result).toHaveLength(2)
    const zeros = result.filter((wp) => (wp.distanceAlongRouteMeters ?? 0) === 0)
    expect(zeros.length).toBeLessThan(2)
  })

  it('assigns distance near midpoint for source near route middle', () => {
    const cum = cumulativeDistances(straight.coordinates.map(([lng, lat]) => ({ lat, lng })))
    const total = cum[cum.length - 1] ?? 0
    const mid = pointAtDistance(straight.coordinates.map(([lng, lat]) => ({ lat, lng })), cum, total / 2)
    if (!mid) return
    const sources = [{ id: 'mid', position: mid.position }]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result).toHaveLength(1)
    expect(result[0].distanceAlongRouteMeters).toBeGreaterThan(total * 0.25)
    expect(result[0].distanceAlongRouteMeters).toBeLessThan(total * 0.75)
  })
})
