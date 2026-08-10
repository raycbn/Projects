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
    const barbs = fc.features.filter((f) => f.properties?.kind === 'barb')
    const heads = fc.features.filter((f) => f.properties?.kind === 'arrowhead')
    expect(segments.length).toBeGreaterThan(0)
    expect(arrows.length).toBeGreaterThan(0)
    expect(barbs.length).toBe(arrows.length)
    expect(heads.length).toBe(arrows.length)
    expect(segments.some((f) => f.properties?.leg === 'ida')).toBe(true)
    expect(segments.some((f) => f.properties?.leg === 'vuelta')).toBe(true)
    expect(typeof arrows[0]?.properties?.windTowardDeg).toBe('number')
    expect(barbs[0]?.geometry.type).toBe('LineString')
    expect(heads[0]?.geometry.type).toBe('LineString')
    expect((heads[0]?.geometry as { coordinates: unknown[] }).coordinates).toHaveLength(3)
  })
})
