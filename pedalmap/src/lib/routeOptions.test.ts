import { describe, expect, it } from 'vitest'
import { applySelectedOption, rankRouteOptions } from './routeOptions'
import type { RouteStats } from '@/domain/types'

function stats(distanceMeters: number, score: number): RouteStats {
  return {
    distanceMeters,
    elevationGainMeters: 100,
    elevationLossMeters: 80,
    estimatedDurationSeconds: 3600,
    difficulty: 'moderate',
    surfaceStats: {
      pavedPercent: 50,
      unpavedPercent: 50,
      suitability: {
        score,
        label: score >= 80 ? 'excelente' : score >= 60 ? 'buena' : 'aceptable',
        notes: [],
        bikeType: 'road',
      },
    },
  }
}

function candidate(distanceMeters: number, score: number, lngOffset = 0) {
  return {
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [-3.7 + lngOffset, 40.4],
        [-3.69 + lngOffset, 40.41],
      ] as [number, number][],
    },
    elevationProfile: [],
    stats: stats(distanceMeters, score),
    instructions: [`Go ${distanceMeters}`],
  }
}

describe('rankRouteOptions', () => {
  it('ranks by surface score and indexes Opción 1..N', () => {
    const bundle = rankRouteOptions([
      candidate(12000, 55, 0),
      candidate(11000, 90, 0.01),
      candidate(13000, 70, 0.02),
    ])
    expect(bundle.routeOptions).toHaveLength(3)
    expect(bundle.routeOptions.map((o) => o.id)).toEqual(['opt-1', 'opt-2', 'opt-3'])
    expect(bundle.routeOptions[0].stats.surfaceStats?.suitability?.score).toBe(90)
    expect(bundle.selectedOptionId).toBe('opt-1')
    expect(bundle.active.stats.distanceMeters).toBe(11000)
  })

  it('keeps all options when applying a selection', () => {
    const bundle = rankRouteOptions([candidate(10000, 50), candidate(9000, 80)])
    const draft = {
      title: 'A → B',
      geometry: bundle.active.geometry,
      elevationProfile: bundle.active.elevationProfile,
      stats: bundle.active.stats,
      instructions: bundle.active.instructions,
      routeOptions: bundle.routeOptions,
      selectedOptionId: bundle.selectedOptionId,
    }
    const next = applySelectedOption(draft, 'opt-2')
    expect(next.selectedOptionId).toBe('opt-2')
    expect(next.stats.distanceMeters).toBe(10000)
    expect(next.routeOptions).toHaveLength(2)
    expect(next.title).toContain('Opción 2')
  })
})
