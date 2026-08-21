import { describe, expect, it } from 'vitest'
import {
  buildBbox,
  cumulativeDistances,
  deduplicateByProximity,
  distanceToSegment,
  haversineMeters,
  limitResults,
  pointAtDistance,
  projectPoiAlongRoute,
  sortAlongRoute,
  closestPointOnSegment,
} from '@/lib/routeGeometry'

describe('routeGeometry', () => {
  const coords = [
    { lat: 40.4, lng: -3.7 },
    { lat: 40.41, lng: -3.69 },
    { lat: 40.42, lng: -3.68 },
    { lat: 40.41, lng: -3.67 },
    { lat: 40.4, lng: -3.66 },
  ]

  describe('cumulativeDistances', () => {
    it('returns 0 for first point', () => {
      const cum = cumulativeDistances(coords)
      expect(cum[0]).toBe(0)
    })

    it('accumulates distances', () => {
      const cum = cumulativeDistances(coords)
      expect(cum.length).toBe(coords.length)
      expect(cum[cum.length - 1]).toBeGreaterThan(0)
    })
  })

  describe('pointAtDistance', () => {
    it('returns null for empty or single-point routes', () => {
      expect(pointAtDistance([{ lat: 0, lng: 0 }], [0], 0)).toBeNull()
      expect(pointAtDistance([], [], 0)).toBeNull()
    })

    it('returns start for target 0', () => {
      const cum = cumulativeDistances(coords)
      const p = pointAtDistance(coords, cum, 0)
      expect(p).not.toBeNull()
      expect(p!.position.lat).toBeCloseTo(coords[0].lat, 5)
      expect(p!.position.lng).toBeCloseTo(coords[0].lng, 5)
    })

    it('clamps beyond total distance', () => {
      const cum = cumulativeDistances(coords)
      const total = cum[cum.length - 1] ?? 0
      const p = pointAtDistance(coords, cum, total + 1000)
      expect(p).not.toBeNull()
      expect(p!.index).toBeGreaterThanOrEqual(0)
    })
  })

  describe('distanceToSegment', () => {
    it('returns small distance for point near segment', () => {
      const a = { lat: 40.4, lng: -3.7 }
      const b = { lat: 40.41, lng: -3.69 }
      const p = { lat: 40.405, lng: -3.695 }
      const d = distanceToSegment(p, a, b)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThan(500)
    })

    it('returns distance to closest endpoint for far point', () => {
      const a = { lat: 40.4, lng: -3.7 }
      const b = { lat: 40.41, lng: -3.69 }
      const p = { lat: 41, lng: -3 }
      const d = distanceToSegment(p, a, b)
      expect(d).toBeGreaterThan(5000)
    })
  })

  describe('projectPoiAlongRoute', () => {
    it('returns null when POI is too far from route', () => {
      const cum = cumulativeDistances(coords)
      const far = { lat: 41, lng: -3 }
      const result = projectPoiAlongRoute(far, coords, cum)
      expect(result).toBeNull()
    })

    it('returns distance and detour for POI near route', () => {
      const cum = cumulativeDistances(coords)
      const near = { lat: 40.4005, lng: -3.7005 }
      const result = projectPoiAlongRoute(near, coords, cum)
      expect(result).not.toBeNull()
      expect(typeof result!.distanceAlongRouteMeters).toBe('number')
      expect(result!.detourMeters).toBeGreaterThanOrEqual(0)
    })
  })

  describe('closestPointOnSegment', () => {
    it('returns a point on the segment', () => {
      const a = { lat: 40.4, lng: -3.7 }
      const b = { lat: 40.41, lng: -3.69 }
      const p = { lat: 40.405, lng: -3.695 }
      const projected = closestPointOnSegment(p, a, b)
      expect(projected.lat).toBeGreaterThanOrEqual(Math.min(a.lat, b.lat))
      expect(projected.lat).toBeLessThanOrEqual(Math.max(a.lat, b.lat))
      expect(projected.lng).toBeGreaterThanOrEqual(Math.min(a.lng, b.lng))
      expect(projected.lng).toBeLessThanOrEqual(Math.max(a.lng, b.lng))
    })

    it('clamps to endpoints for far points', () => {
      const a = { lat: 40.4, lng: -3.7 }
      const b = { lat: 40.41, lng: -3.69 }
      const p = { lat: 40.39, lng: -3.71 }
      const projected = closestPointOnSegment(p, a, b)
      expect(haversineMeters(projected, a)).toBeLessThan(haversineMeters(projected, b))
    })
  })

  describe('buildBbox', () => {
    it('returns null for empty input', () => {
      expect(buildBbox([])).toBeNull()
    })

    it('returns padded bbox', () => {
      const bbox = buildBbox(coords)
      expect(bbox).not.toBeNull()
      expect(bbox![0]).toBeLessThan(40.4)
      expect(bbox![2]).toBeGreaterThan(40.42)
    })
  })

  describe('deduplicateByProximity', () => {
    it('removes nearby duplicates', () => {
      const items = [
        { lat: 40.4, lng: -3.7 },
        { lat: 40.40001, lng: -3.70001 },
        { lat: 41, lng: -3 },
      ]
      const out = deduplicateByProximity(items, 50)
      expect(out.length).toBeLessThan(items.length)
    })

    it('keeps far apart items', () => {
      const items = [
        { lat: 40.4, lng: -3.7 },
        { lat: 41, lng: -3 },
      ]
      const out = deduplicateByProximity(items, 50)
      expect(out.length).toBe(2)
    })
  })

  describe('sortAlongRoute', () => {
    it('sorts by distanceAlongRouteMeters', () => {
      const items = [
        { id: 'a', distanceAlongRouteMeters: 100 },
        { id: 'b', distanceAlongRouteMeters: 50 },
        { id: 'c', distanceAlongRouteMeters: 200 },
      ]
      const sorted = sortAlongRoute(items)
      expect(sorted.map((i) => i.id)).toEqual(['b', 'a', 'c'])
    })

    it('puts items without distance at the end', () => {
      const items = [
        { id: 'a', distanceAlongRouteMeters: 100 },
        { id: 'b' },
      ]
      const sorted = sortAlongRoute(items)
      expect(sorted[0].id).toBe('a')
    })
  })

  describe('limitResults', () => {
    it('limits to max', () => {
      const items = [1, 2, 3, 4, 5]
      expect(limitResults(items, 3)).toHaveLength(3)
    })

    it('returns all when under max', () => {
      expect(limitResults([1, 2], 5)).toHaveLength(2)
    })
  })
})
