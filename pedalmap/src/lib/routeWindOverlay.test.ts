import { describe, expect, it } from 'vitest'
import type { LineString } from 'geojson'
import { buildRouteWindOverlay } from '@/lib/routeWindOverlay'

describe('buildRouteWindOverlay', () => {
  const geometry = {
    type: 'LineString' as const,
    coordinates: [
      [-3.7, 40.4],
      [-3.69, 40.41],
      [-3.68, 40.42],
      [-3.67, 40.41],
      [-3.66, 40.4],
    ] as [number, number][],
  }

  it('returns empty without wind selection', () => {
    const fc = buildRouteWindOverlay(geometry, { routeType: 'a_to_b' })
    expect(fc.features).toHaveLength(0)
  })

  it('builds ida/vuelta segments for circular', () => {
    const fc = buildRouteWindOverlay(geometry, {
      routeType: 'circular',
      sampleCount: 10,
      window: {
        startHour: '2026-08-10T07:00',
        endHour: '2026-08-10T10:00',
        score: 80,
        label: 'buena',
        windSpeedKmh: 22,
        windDirectionDeg: 90,
        windDirLabel: 'E',
        relative: 'cara',
        temperatureC: 18,
        precipitationMm: 0,
        notes: [],
      },
    })
    const segments = fc.features.filter((f) => f.properties?.kind === 'segment')
    const arrows = fc.features.filter((f) => f.properties?.kind === 'arrow')
    expect(segments.length).toBeGreaterThan(0)
    expect(arrows.length).toBeGreaterThan(0)
    expect(segments.some((f) => f.properties?.leg === 'ida')).toBe(true)
    expect(segments.some((f) => f.properties?.leg === 'vuelta')).toBe(true)
    expect(typeof arrows[0]?.properties?.windTowardDeg).toBe('number')
  })

  it('keeps wind segments on the route polyline (no straight chords)', () => {
    // Hook-shaped route: a chord from start→end would skip the corner vertex.
    const hooked = {
      type: 'LineString' as const,
      coordinates: [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0.02, 0.01],
      ] as [number, number][],
    }
    const fc = buildRouteWindOverlay(hooked, {
      routeType: 'a_to_b',
      sampleCount: 2,
      hour: {
        time: '2026-08-10T09:00',
        temperatureC: 20,
        precipitationMm: 0,
        windSpeedKmh: 18,
        windDirectionDeg: 180,
        windGustsKmh: 22,
      },
    })
    const segments = fc.features.filter((f) => f.properties?.kind === 'segment')
    expect(segments.length).toBeGreaterThan(0)
    for (const seg of segments) {
      expect(seg.geometry.type).toBe('LineString')
      const coords = (seg.geometry as LineString).coordinates
      expect(coords.length).toBeGreaterThanOrEqual(2)
    }
    const allCoords = segments.flatMap((s) => (s.geometry as LineString).coordinates)
    const hasCorner = allCoords.some(
      ([lng, lat]) => Math.abs(lng - 0.01) < 1e-9 && Math.abs(lat - 0.01) < 1e-9,
    )
    expect(hasCorner).toBe(true)
    expect(fc.features.every((f) => f.properties?.kind !== 'barb')).toBe(true)
    expect(fc.features.every((f) => f.properties?.kind !== 'arrowhead')).toBe(true)
  })

  it('places an arrow when relative wind color changes along the route', () => {
    // Eastbound then northbound: with wind from west, cola → lateral (color change).
    const turn = {
      type: 'LineString' as const,
      coordinates: [
        [0, 0],
        [0.02, 0],
        [0.04, 0],
        [0.04, 0.02],
        [0.04, 0.04],
      ] as [number, number][],
    }
    const fc = buildRouteWindOverlay(turn, {
      routeType: 'a_to_b',
      sampleCount: 20,
      hour: {
        time: '2026-08-10T09:00',
        temperatureC: 20,
        precipitationMm: 0,
        windSpeedKmh: 20,
        windDirectionDeg: 270,
        windGustsKmh: 24,
      },
    })
    const arrows = fc.features.filter((f) => f.properties?.kind === 'arrow')
    expect(arrows.length).toBeGreaterThan(3)
    expect(arrows.some((f) => f.properties?.atColorChange === true)).toBe(true)
    const kinds = new Set(arrows.map((f) => String(f.properties?.relative)))
    expect(kinds.size).toBeGreaterThan(1)
  })
})
