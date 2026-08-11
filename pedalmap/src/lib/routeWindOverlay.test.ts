import { describe, expect, it } from 'vitest'
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
      const coords = (seg.geometry as { coordinates: [number, number][] }).coordinates
      expect(coords.length).toBeGreaterThanOrEqual(2)
    }
    // Full overlay should include the corner when covering the whole hook.
    const allCoords = segments.flatMap(
      (s) => (s.geometry as { coordinates: [number, number][] }).coordinates,
    )
    const hasCorner = allCoords.some(
      ([lng, lat]) => Math.abs(lng - 0.01) < 1e-9 && Math.abs(lat - 0.01) < 1e-9,
    )
    expect(hasCorner).toBe(true)

    const arrows = fc.features.filter((f) => f.properties?.kind === 'arrow')
    for (const a of arrows) {
      expect(a.geometry.type).toBe('Point')
    }
    // No off-route wind sticks.
    expect(fc.features.every((f) => f.properties?.kind !== 'barb')).toBe(true)
    expect(fc.features.every((f) => f.properties?.kind !== 'arrowhead')).toBe(true)
  })
})
