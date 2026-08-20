import { describe, expect, it } from 'vitest'
import type { RouteGeometry } from '@/domain/types'
import type { WaterPoint } from '@/domain/routeEnricher'
import { buildRouteWaterOverlay } from '@/lib/routeWaterOverlay'

const geometry: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [-3.7, 40.4],
    [-3.69, 40.41],
    [-3.68, 40.42],
  ] as [number, number][],
}

describe('buildRouteWaterOverlay', () => {
  it('returns empty FeatureCollection for empty inputs', () => {
    expect(buildRouteWaterOverlay(geometry, [])).toEqual({ type: 'FeatureCollection', features: [] })
    expect(buildRouteWaterOverlay({ type: 'LineString', coordinates: [] }, [])).toEqual({ type: 'FeatureCollection', features: [] })
  })

  it('filters points without distanceAlongRouteMeters', () => {
    const points: WaterPoint[] = [
      { id: 'w1', position: { lat: 40.4, lng: -3.7 } },
      { id: 'w2', position: { lat: 40.41, lng: -3.69 }, distanceAlongRouteMeters: 1000 },
    ]
    const fc = buildRouteWaterOverlay(geometry, points)
    expect(fc.features).toHaveLength(1)
    expect(fc.features[0].properties?.id).toBe('w2')
  })

  it('sorts features by distance along route', () => {
    const points: WaterPoint[] = [
      { id: 'w2', position: { lat: 40.42, lng: -3.68 }, distanceAlongRouteMeters: 3000 },
      { id: 'w1', position: { lat: 40.4, lng: -3.7 }, distanceAlongRouteMeters: 1000 },
    ]
    const fc = buildRouteWaterOverlay(geometry, points)
    expect(fc.features).toHaveLength(2)
    expect(fc.features[0].properties?.id).toBe('w1')
    expect(fc.features[1].properties?.id).toBe('w2')
  })

  it('limits to maxVisible', () => {
    const points: WaterPoint[] = Array.from({ length: 20 }, (_, i) => ({
      id: `w${i}`,
      position: { lat: 40.4 + i * 0.001, lng: -3.7 + i * 0.001 },
      distanceAlongRouteMeters: i * 100,
    }))
    const fc = buildRouteWaterOverlay(geometry, points, { maxVisible: 5 })
    expect(fc.features).toHaveLength(5)
  })

  it('assigns order and rounded properties', () => {
    const points: WaterPoint[] = [
      { id: 'w1', position: { lat: 40.4, lng: -3.7 }, distanceAlongRouteMeters: 1234.5, detourMeters: 67.8 },
    ]
    const fc = buildRouteWaterOverlay(geometry, points)
    expect(fc.features[0].properties?.order).toBe(1)
    expect(fc.features[0].properties?.distanceAlongRouteMeters).toBe(1235)
    expect(fc.features[0].properties?.detourMeters).toBe(68)
  })
})
