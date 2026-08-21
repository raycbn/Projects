import { describe, expect, it } from 'vitest'
import { applySelectedOption, ensureRouteOptions, rankRouteOptions } from './routeOptions'
import type { RouteStats } from '@/domain/types'

function stats(
  distanceMeters: number,
  score: number,
  cycle?: { cycleNetworkPercent?: number; cycleInfraPercent?: number },
): RouteStats {
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
      ...cycle,
    },
  }
}

function candidate(
  distanceMeters: number,
  score: number,
  lngOffset = 0,
  cycle?: { cycleNetworkPercent?: number; cycleInfraPercent?: number },
) {
  return {
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [-3.7 + lngOffset, 40.4],
        [-3.69 + lngOffset, 40.41],
      ] as [number, number][],
    },
    elevationProfile: [],
    stats: stats(distanceMeters, score, cycle),
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

  it('breaks near-ties in surface fit using cycle network / infra share', () => {
    const bundle = rankRouteOptions([
      candidate(11500, 80, 0, { cycleNetworkPercent: 0, cycleInfraPercent: 5 }),
      candidate(11000, 80.3, 0.01, { cycleNetworkPercent: 60, cycleInfraPercent: 40 }),
    ])
    // Suitability scores are within the 0.5 near-tie band — cycle share decides.
    expect(bundle.active.stats.surfaceStats?.cycleNetworkPercent).toBe(60)
  })

  it('never lets cycle network share override a clearly better surface fit', () => {
    const bundle = rankRouteOptions([
      candidate(11000, 40, 0, { cycleNetworkPercent: 100, cycleInfraPercent: 100 }),
      candidate(12000, 90, 0.01, { cycleNetworkPercent: 0, cycleInfraPercent: 0 }),
    ])
    expect(bundle.active.stats.surfaceStats?.suitability?.score).toBe(90)
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

  it('preserves within_tolerance over closest for objective routes', () => {
    const bundle = rankRouteOptions([
      { ...candidate(58000, 95, 0), objectiveMatch: 'closest' },
      { ...candidate(55000, 70, 0.01), objectiveMatch: 'within_tolerance' },
    ])
    expect(bundle.routeOptions[0].stats.distanceMeters).toBe(55000)
    expect(bundle.routeOptions[0].objectiveMatch).toBe('within_tolerance')
    expect(bundle.routeOptions[1].objectiveMatch).toBe('closest')
  })

  it('ranks two within_tolerance candidates by existing surface/cycle logic', () => {
    const bundle = rankRouteOptions([
      { ...candidate(55000, 60, 0), objectiveMatch: 'within_tolerance' },
      { ...candidate(54000, 90, 0.01), objectiveMatch: 'within_tolerance' },
    ])
    expect(bundle.routeOptions[0].stats.surfaceStats?.suitability?.score).toBe(90)
    expect(bundle.routeOptions[0].objectiveMatch).toBe('within_tolerance')
    expect(bundle.routeOptions[1].objectiveMatch).toBe('within_tolerance')
  })

  it('ranks two closest candidates by existing surface/cycle logic', () => {
    const bundle = rankRouteOptions([
      { ...candidate(58000, 60, 0), objectiveMatch: 'closest' },
      { ...candidate(57000, 90, 0.01), objectiveMatch: 'closest' },
    ])
    expect(bundle.routeOptions[0].stats.surfaceStats?.suitability?.score).toBe(90)
    expect(bundle.routeOptions[0].objectiveMatch).toBe('closest')
    expect(bundle.routeOptions[1].objectiveMatch).toBe('closest')
  })

  it('falls back to existing ranking when no objective tags are present', () => {
    const bundle = rankRouteOptions([
      candidate(12000, 55, 0),
      candidate(11000, 90, 0.01),
      candidate(13000, 70, 0.02),
    ])
    expect(bundle.routeOptions.map((o) => o.id)).toEqual(['opt-1', 'opt-2', 'opt-3'])
    expect(bundle.routeOptions[0].stats.surfaceStats?.suitability?.score).toBe(90)
  })
})

describe('applySelectedOption', () => {
  it('copies objective metadata from selected option to draft', () => {
    const bundle = rankRouteOptions([
      { ...candidate(58000, 95, 0), objectiveMatch: 'closest' as const, objectiveDistanceError: 0.08, objectiveElevationError: 0.45, objectiveElevationGainMeters: 420 },
      { ...candidate(55000, 70, 0.01), objectiveMatch: 'within_tolerance' as const, objectiveDistanceError: 0.04, objectiveElevationError: 0.24, objectiveElevationGainMeters: 380 },
    ])
    const draft = {
      title: 'Circular',
      geometry: bundle.routeOptions[0].geometry,
      elevationProfile: [],
      stats: bundle.routeOptions[0].stats,
      instructions: [],
      routeOptions: bundle.routeOptions,
      selectedOptionId: bundle.selectedOptionId,
      objectiveMatch: undefined,
      objectiveDistanceError: undefined,
      objectiveElevationError: undefined,
      objectiveElevationGainMeters: undefined,
    }
    const next = applySelectedOption(draft, 'opt-1')
    expect(next.objectiveMatch).toBe('within_tolerance')
    expect(next.objectiveDistanceError).toBeCloseTo(0.04)
    expect(next.objectiveElevationError).toBeCloseTo(0.24)
    expect(next.objectiveElevationGainMeters).toBe(380)
  })

  it('switches objective metadata when selecting a different option', () => {
    const bundle = rankRouteOptions([
      { ...candidate(58000, 95, 0), objectiveMatch: 'closest' as const, objectiveDistanceError: 0.08, objectiveElevationError: 0.45, objectiveElevationGainMeters: 420 },
      { ...candidate(55000, 70, 0.01), objectiveMatch: 'within_tolerance' as const, objectiveDistanceError: 0.04, objectiveElevationError: 0.24, objectiveElevationGainMeters: 380 },
    ])
    const draft = {
      title: 'Circular',
      geometry: bundle.routeOptions[0].geometry,
      elevationProfile: [],
      stats: bundle.routeOptions[0].stats,
      instructions: [],
      routeOptions: bundle.routeOptions,
      selectedOptionId: bundle.selectedOptionId,
      objectiveMatch: 'within_tolerance' as const,
      objectiveDistanceError: 0.04,
      objectiveElevationError: 0.24,
      objectiveElevationGainMeters: 380,
    }
    const next = applySelectedOption(draft, 'opt-2')
    expect(next.objectiveMatch).toBe('closest')
    expect(next.objectiveDistanceError).toBeCloseTo(0.08)
    expect(next.objectiveElevationError).toBeCloseTo(0.45)
    expect(next.objectiveElevationGainMeters).toBe(420)
  })

  it('leaves objective fields undefined when option has none', () => {
    const bundle = rankRouteOptions([candidate(10000, 50), candidate(9000, 80)])
    const draft = {
      title: 'A → B',
      geometry: bundle.active.geometry,
      elevationProfile: bundle.active.elevationProfile,
      stats: bundle.active.stats,
      instructions: bundle.active.instructions,
      routeOptions: bundle.routeOptions,
      selectedOptionId: bundle.selectedOptionId,
      objectiveMatch: undefined,
      objectiveDistanceError: undefined,
      objectiveElevationError: undefined,
      objectiveElevationGainMeters: undefined,
    }
    const next = applySelectedOption(draft, 'opt-2')
    expect(next.objectiveMatch).toBeUndefined()
    expect(next.objectiveDistanceError).toBeUndefined()
    expect(next.objectiveElevationError).toBeUndefined()
    expect(next.objectiveElevationGainMeters).toBeUndefined()
  })
})

describe('ensureRouteOptions', () => {
  it('rebuilds routeOptions from legacy alternatives', () => {
    const bundle = rankRouteOptions([candidate(10000, 50), candidate(9000, 80)])
    const draft = {
      title: 'A → B',
      geometry: bundle.active.geometry,
      elevationProfile: bundle.active.elevationProfile,
      stats: bundle.active.stats,
      instructions: bundle.active.instructions,
      alternatives: bundle.routeOptions.filter((o) => o.id !== bundle.selectedOptionId),
    }
    const next = ensureRouteOptions(draft)
    expect(next.routeOptions?.length).toBeGreaterThan(1)
    expect(next.selectedOptionId).toBeTruthy()
  })
})
