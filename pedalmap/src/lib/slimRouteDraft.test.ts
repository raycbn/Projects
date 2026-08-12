import { describe, expect, it } from 'vitest'
import { slimDraftKeepOptions } from '@/lib/slimRouteDraft'
import type { RouteDraft } from '@/domain/types'

function draftWithOptions(nCoords: number): RouteDraft {
  const coords = Array.from(
    { length: nCoords },
    (_, i) => [-3.7 + i * 0.0001, 40.4] as [number, number],
  )
  const stats = {
    distanceMeters: 10000,
    elevationGainMeters: 100,
    elevationLossMeters: 90,
    estimatedDurationSeconds: 1800,
    difficulty: 'moderate' as const,
  }
  const opt = (id: string, label: string, rank: number) => ({
    id,
    label,
    rank,
    geometry: { type: 'LineString' as const, coordinates: coords },
    elevationProfile: coords.map((_, i) => ({ distanceMeters: i * 10, elevationMeters: 600 })),
    stats,
  })
  return {
    title: 'Test',
    type: 'a_to_b',
    bikeType: 'road',
    preferences: [],
    waypoints: [],
    geometry: { type: 'LineString', coordinates: coords },
    elevationProfile: coords.map((_, i) => ({ distanceMeters: i * 10, elevationMeters: 600 })),
    stats,
    selectedOptionId: 'opt-1',
    routeOptions: [opt('opt-1', 'Opción 1', 1), opt('opt-2', 'Opción 2', 2), opt('opt-3', 'Opción 3', 3)],
  }
}

describe('slimDraftKeepOptions', () => {
  it('keeps three opciones while shrinking geometries', () => {
    const slim = slimDraftKeepOptions(draftWithOptions(5000))
    expect(slim.routeOptions).toHaveLength(3)
    expect(slim.geometry.coordinates.length).toBeLessThanOrEqual(2500)
    expect(slim.routeOptions![0].geometry.coordinates.length).toBeLessThanOrEqual(1800)
    expect(slim.routeOptions![1].geometry.coordinates.length).toBeLessThanOrEqual(900)
  })
})
