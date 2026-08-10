import { describe, expect, it } from 'vitest'
import { nearestPointOnRoute, offRouteThresholdMeters, routeProgress } from './bikeCompare'

describe('nearestPointOnRoute (segments)', () => {
  it('measures distance to the line, not only vertices', () => {
    // Horizontal segment ~111 m east at equator-ish (use Madrid-ish lat)
    const coords: [number, number][] = [
      [-3.7, 40.4],
      [-3.698, 40.4],
    ]
    // Midpoint, ~50 m north of the segment
    const midLng = (-3.7 + -3.698) / 2
    const pos = { lng: midLng, lat: 40.4 + 50 / 111_320 }
    const near = nearestPointOnRoute(pos, coords)
    expect(near.distanceMeters).toBeGreaterThan(40)
    expect(near.distanceMeters).toBeLessThan(70)
  })

  it('reports near-zero when standing on the track', () => {
    const coords: [number, number][] = [
      [-3.7, 40.4],
      [-3.698, 40.4],
    ]
    const midLng = (-3.7 + -3.698) / 2
    const near = nearestPointOnRoute({ lng: midLng, lat: 40.4 }, coords)
    expect(near.distanceMeters).toBeLessThan(2)
  })
})

describe('routeProgress', () => {
  it('is ~0.5 at the midpoint of a two-point route', () => {
    const coords: [number, number][] = [
      [-3.7, 40.4],
      [-3.698, 40.4],
    ]
    const midLng = (-3.7 + -3.698) / 2
    expect(routeProgress({ lng: midLng, lat: 40.4 }, coords)).toBeGreaterThan(0.4)
    expect(routeProgress({ lng: midLng, lat: 40.4 }, coords)).toBeLessThan(0.6)
  })
})

describe('offRouteThresholdMeters', () => {
  it('stays lenient for typical phone accuracy', () => {
    expect(offRouteThresholdMeters(35)).toBeGreaterThanOrEqual(135)
    expect(offRouteThresholdMeters(35)).toBeGreaterThan(70)
    expect(offRouteThresholdMeters(5)).toBe(160)
  })
})
