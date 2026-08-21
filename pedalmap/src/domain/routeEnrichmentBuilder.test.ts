import { describe, expect, it } from 'vitest'
import type { RouteGeometry } from '@/domain/types'
import { buildWaterPointsAlongRoute, selectDistributedWaterPoints } from '@/domain/routeEnrichmentBuilder'
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
    expect(buildWaterPointsAlongRoute({ geometry: straight, sources: [] })).toEqual({ recommended: [], all: [] })
    expect(buildWaterPointsAlongRoute({ geometry: { type: 'LineString', coordinates: [] }, sources: [{ id: 'x', position: { lat: 0, lng: 0 } }] })).toEqual({ recommended: [], all: [] })
  })

  it('projects nearby sources and assigns distanceAlongRouteMeters', () => {
    const sources = [
      { id: 'w1', position: { lat: 40.4005, lng: -3.6995 } },
      { id: 'w2', position: { lat: 40.4105, lng: -3.6895 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result.all).toHaveLength(2)
    expect(typeof result.all[0].distanceAlongRouteMeters).toBe('number')
    expect(result.all[0].distanceAlongRouteMeters!).toBeGreaterThanOrEqual(0)
    expect(result.all[0].distanceAlongRouteMeters!).toBeLessThan(result.all[1].distanceAlongRouteMeters!)
  })

  it('filters out sources too far from route', () => {
    const sources = [
      { id: 'far', position: { lat: 41, lng: -3 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result.all).toEqual([])
  })

  it('deduplicates nearby sources', () => {
    const sources = [
      { id: 'w1', position: { lat: 40.4005, lng: -3.6995 } },
      { id: 'w2', position: { lat: 40.40051, lng: -3.69951 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources, minSeparationMeters: 50 })
    expect(result.all.length).toBeLessThanOrEqual(1)
  })

  it('limits results to maxVisible', () => {
    const sources = Array.from({ length: 20 }, (_, i) => ({
      id: `w${i}`,
      position: { lat: 40.4 + i * 0.001, lng: -3.7 + i * 0.001 },
    }))
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources, maxVisible: 5 })
    expect(result.recommended).toHaveLength(5)
  })

  it('sorts along route direction', () => {
    const sources = [
      { id: 'end', position: { lat: 40.42, lng: -3.68 } },
      { id: 'start', position: { lat: 40.4005, lng: -3.6995 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result.all[0].id).toBe('start')
    expect(result.all[1].id).toBe('end')
  })

  it('respects maxDetourMeters', () => {
    const sources = [
      { id: 'far', position: { lat: 40.5, lng: -3.6 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources, maxDetourMeters: 100 })
    expect(result.all).toEqual([])
  })

  it('assigns distanceAlongRouteMeters > 0 for source on first segment but not at start', () => {
    const sources = [
      { id: 'start', position: { lat: 40.4005, lng: -3.7005 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result.all).toHaveLength(1)
    expect(result.all[0].distanceAlongRouteMeters).toBeGreaterThan(0)
  })

  it('does not assign 0m to two sources on different segments', () => {
    const sources = [
      { id: 'seg1', position: { lat: 40.4005, lng: -3.7005 } },
      { id: 'seg2', position: { lat: 40.4105, lng: -3.6895 } },
    ]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result.all).toHaveLength(2)
    const zeros = result.all.filter((wp) => (wp.distanceAlongRouteMeters ?? 0) === 0)
    expect(zeros.length).toBeLessThan(2)
  })

  it('assigns distance near midpoint for source near route middle', () => {
    const cum = cumulativeDistances(straight.coordinates.map(([lng, lat]) => ({ lat, lng })))
    const total = cum[cum.length - 1] ?? 0
    const mid = pointAtDistance(straight.coordinates.map(([lng, lat]) => ({ lat, lng })), cum, total / 2)
    if (!mid) return
    const sources = [{ id: 'mid', position: mid.position }]
    const result = buildWaterPointsAlongRoute({ geometry: straight, sources })
    expect(result.all).toHaveLength(1)
    expect(result.all[0].distanceAlongRouteMeters).toBeGreaterThan(total * 0.25)
    expect(result.all[0].distanceAlongRouteMeters).toBeLessThan(total * 0.75)
  })
})

describe('selectDistributedWaterPoints', () => {
  it('returns all when count <= maxVisible', () => {
    const points = [
      { id: 'a', position: { lat: 40.4, lng: -3.7 }, distanceAlongRouteMeters: 100, detourMeters: 50 },
      { id: 'b', position: { lat: 40.41, lng: -3.69 }, distanceAlongRouteMeters: 200, detourMeters: 60 },
    ]
    expect(selectDistributedWaterPoints(points, 10)).toHaveLength(2)
  })

  it('distributes points across bins', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      position: { lat: 40.4 + i * 0.001, lng: -3.7 + i * 0.001 },
      distanceAlongRouteMeters: i * 500,
      detourMeters: 50 + i,
    }))
    const selected = selectDistributedWaterPoints(points, 5)
    expect(selected).toHaveLength(5)
    const distances = selected.map((p) => p.distanceAlongRouteMeters!).filter((d): d is number => d != null)
    const maxGap = Math.max(...distances.slice(1).map((d, i) => d - distances[i]))
    expect(maxGap).toBeLessThan(5000)
  })

  it('prefers lower detour within each bin', () => {
    const points = [
      { id: 'a', position: { lat: 40.4, lng: -3.7 }, distanceAlongRouteMeters: 100, detourMeters: 50 },
      { id: 'b', position: { lat: 40.401, lng: -3.699 }, distanceAlongRouteMeters: 150, detourMeters: 20 },
    ]
    const selected = selectDistributedWaterPoints(points, 1)
    expect(selected[0].id).toBe('b')
  })

  it('returns empty for empty input', () => {
    expect(selectDistributedWaterPoints([], 10)).toHaveLength(0)
  })

  it('fills remaining slots when bins have few points', () => {
    const points = [
      { id: 'a', position: { lat: 40.4, lng: -3.7 }, distanceAlongRouteMeters: 100, detourMeters: 50 },
      { id: 'b', position: { lat: 40.41, lng: -3.69 }, distanceAlongRouteMeters: 5000, detourMeters: 60 },
    ]
    const selected = selectDistributedWaterPoints(points, 5)
    expect(selected).toHaveLength(2)
  })
})
