import { describe, expect, it } from 'vitest'
import { computePedalScore, recommendRide, rankRideOptions } from '@/domain/pedalScore'
import { PEDAL_SCORE_WEIGHTS } from '@/domain/pedalScoreTypes'
import type { RouteAlternative, RouteDraft, RouteStats } from '@/domain/types'

function stats(partial: Partial<RouteStats> = {}): RouteStats {
  return {
    distanceMeters: 40000,
    elevationGainMeters: 500,
    elevationLossMeters: 480,
    estimatedDurationSeconds: 7200,
    difficulty: 'moderate',
    surfaceStats: {
      pavedPercent: 85,
      unpavedPercent: 15,
      suitability: { score: 90, label: 'excelente', notes: [], bikeType: 'road' },
    },
    ...partial,
  }
}

function alt(partial: Partial<RouteAlternative> = {}): RouteAlternative {
  return {
    id: 'opt-1',
    label: 'Opción 1',
    rank: 1,
    geometry: { type: 'LineString', coordinates: [[-3.7, 40.4], [-3.69, 40.41]] },
    elevationProfile: [],
    stats: stats(),
    surfaceEdges: [],
    ...partial,
  }
}

describe('PedalScore', () => {
  it('scores 0-100 with breakdown and explanation', () => {
    const score = computePedalScore({
      stats: stats({ distanceMeters: 39000, elevationGainMeters: 480 }),
      bikeType: 'road',
      preferences: ['prefer_shorter', 'avoid_unpaved'],
      targetDistanceMeters: 40000,
      targetElevationGainMeters: 500,
    })
    expect(score.total).toBeGreaterThanOrEqual(0)
    expect(score.total).toBeLessThanOrEqual(100)
    expect(score.breakdown.length).toBeGreaterThan(0)
    expect(score.explanation).toBeTruthy()
    expect(score.breakdown.every((b) => b.maxPoints > 0)).toBe(true)
    expect(score.breakdown.every((b) => b.available)).toBe(true)
  })

  it('prefers closer distance target when elevation absent', () => {
    const score = computePedalScore({
      stats: stats({ distanceMeters: 39000 }),
      bikeType: 'road',
      preferences: [],
      targetDistanceMeters: 40000,
    })
    const distFactor = score.breakdown.find((b) => b.id === 'distance')
    expect(distFactor).toBeTruthy()
    expect(distFactor!.points).toBeGreaterThan(0)
    expect(score.explanation).toContain('distancia objetivo')
  })

  it('prefers closer elevation target when distance absent', () => {
    const score = computePedalScore({
      stats: stats({ elevationGainMeters: 480 }),
      bikeType: 'road',
      preferences: [],
      targetElevationGainMeters: 500,
    })
    const elevFactor = score.breakdown.find((b) => b.id === 'elevation')
    expect(elevFactor).toBeTruthy()
    expect(elevFactor!.points).toBeGreaterThan(0)
    expect(score.explanation.length).toBeGreaterThan(0)
  })

  it('surface factor is available when surface data exists', () => {
    const score = computePedalScore({
      stats: stats(),
      bikeType: 'road',
      preferences: [],
    })
    const surfFactor = score.breakdown.find((b) => b.id === 'surface')
    expect(surfFactor).toBeTruthy()
    expect(surfFactor!.available).toBe(true)
  })

  it('surface factor unavailable when no surface data (excluded from final breakdown)', () => {
    const score = computePedalScore({
      stats: stats({ surfaceStats: undefined }),
      bikeType: 'road',
      preferences: [],
    })
    const surfFactor = score.breakdown.find((b) => b.id === 'surface')
    // when unavailable, factor is filtered out of final breakdown
    expect(surfFactor).toBeFalsy()
  })

  it('gives preferences weight when prefs exist and have data', () => {
    const score = computePedalScore({
      stats: stats({ distanceMeters: 38000 }),
      bikeType: 'road',
      preferences: ['prefer_shorter'],
      cohort: {
        minDistanceMeters: 35000,
        maxDistanceMeters: 45000,
        minElevationGainMeters: 400,
        maxElevationGainMeters: 600,
        minDurationSeconds: 6000,
        maxDurationSeconds: 9000,
      },
    })
    const prefFactor = score.breakdown.find((b) => b.id === 'preferences')
    expect(prefFactor).toBeTruthy()
    expect(prefFactor!.available).toBe(true)
  })

  it('bikeFit uses suitability when present', () => {
    const score = computePedalScore({
      stats: stats({ surfaceStats: { suitability: { score: 92, label: 'excelente', notes: [], bikeType: 'road' } } }),
      bikeType: 'road',
      preferences: [],
    })
    const fit = score.breakdown.find((b) => b.id === 'bikeFit')
    expect(fit).toBeTruthy()
    expect(fit!.available).toBe(true)
    expect(fit!.points).toBeGreaterThan(0)
  })

  it('deferred factors with weight 0 do not appear in breakdown (filtered by maxPoints > 0)', () => {
    const score = computePedalScore({ stats: stats(), bikeType: 'road', preferences: [] })
    const deferredIds = Object.entries(PEDAL_SCORE_WEIGHTS)
      .filter(([, w]) => w === 0)
      .map(([id]) => id)
    const present = score.breakdown.filter((b) => deferredIds.includes(b.id))
    expect(present.length).toBe(0)
  })
})

describe('rankRideOptions / recommendRide', () => {
  it('ranks by score then distance and marks first as recommended', () => {
    const options = [
      alt({ id: 'opt-1', stats: stats({ distanceMeters: 45000 }) }),
      alt({ id: 'opt-2', stats: stats({ distanceMeters: 40000 }) }),
      alt({ id: 'opt-3', stats: stats({ distanceMeters: 38000 }) }),
    ]
    const context = { bikeType: 'road' as const, preferences: [], targetDistanceMeters: 40000 }
    const ranked = rankRideOptions(options, context)
    expect(ranked.length).toBe(3)
    expect(ranked[0].recommended).toBe(true)
    expect(ranked[1].recommended).toBe(false)
    expect(ranked[2].recommended).toBe(false)
    expect(ranked[0].optionId).toBe('opt-2')
  })

  it('recommendRide returns ranked and recommendedId', () => {
    const draft: RouteDraft = {
      title: 'Test',
      type: 'a_to_b',
      bikeType: 'road',
      preferences: [],
      waypoints: [],
      geometry: { type: 'LineString', coordinates: [] },
      elevationProfile: [],
      stats: stats(),
      routeOptions: [
        alt({ id: 'opt-1', stats: stats({ distanceMeters: 42000 }) }),
        alt({ id: 'opt-2', stats: stats({ distanceMeters: 39000 }) }),
      ],
      selectedOptionId: 'opt-1',
      circularDistanceMeters: 40000,
    }
    const { ranked, recommendedId } = recommendRide(draft)
    expect(ranked.length).toBe(2)
    expect(recommendedId).toBe('opt-2')
    expect(ranked.find((r) => r.optionId === recommendedId)?.recommended).toBe(true)
  })

  it('explanation cites concrete data when recommended', () => {
    const options = [
      alt({ id: 'opt-1', stats: stats({ distanceMeters: 45000 }) }),
      alt({ id: 'opt-2', stats: stats({ distanceMeters: 39000 }) }),
    ]
    const context = { bikeType: 'road' as const, preferences: [], targetDistanceMeters: 40000 }
    const ranked = rankRideOptions(options, context)
    const rec = ranked.find((r) => r.recommended)!
    expect(rec.score.explanation).toContain('39 km')
  })
})
