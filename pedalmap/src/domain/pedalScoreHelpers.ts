import type { BikeType, RouteAlternative, RouteDraft, RouteStats } from '@/domain/types'
import {
  MAX_RIDE_OPTIONS,
  PEDAL_SCORE_FACTOR_LABELS,
  type PedalScoreBreakdownItem,
  type PedalScoreCohort,
  type PedalScoreFactorId,
} from '@/domain/pedalScoreTypes'

export function collectRideOptions(draft: RouteDraft, max = MAX_RIDE_OPTIONS): RouteAlternative[] {
  if (draft.routeOptions && draft.routeOptions.length > 0) {
    return draft.routeOptions.slice(0, max)
  }
  const primary: RouteAlternative = {
    id: draft.selectedOptionId ?? 'opt-1',
    label: 'Opción 1',
    rank: 1,
    geometry: draft.geometry,
    elevationProfile: draft.elevationProfile,
    stats: draft.stats,
    instructions: draft.instructions,
    surfaceEdges: draft.surfaceEdges,
  }
  return [primary, ...(draft.alternatives ?? [])].slice(0, max)
}

export function buildCohort(statsList: RouteStats[]): PedalScoreCohort | undefined {
  if (statsList.length < 2) return undefined
  return {
    minDistanceMeters: Math.min(...statsList.map((s) => s.distanceMeters)),
    maxDistanceMeters: Math.max(...statsList.map((s) => s.distanceMeters)),
    minElevationGainMeters: Math.min(...statsList.map((s) => s.elevationGainMeters)),
    maxElevationGainMeters: Math.max(...statsList.map((s) => s.elevationGainMeters)),
    minDurationSeconds: Math.min(...statsList.map((s) => s.estimatedDurationSeconds)),
    maxDurationSeconds: Math.max(...statsList.map((s) => s.estimatedDurationSeconds)),
  }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function closenessScore(actual: number, target: number, failAt: number): number {
  const err = Math.abs(actual - target) / Math.max(target, 1)
  return clamp(1 - err / failAt, 0, 1)
}

export function formatKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  const km = meters / 1000
  const digits = km >= 10 ? 0 : 1
  return `${km.toFixed(digits).replace('.', ',')} km`
}

export function formatMinutes(seconds: number): string {
  const m = Math.max(0, Math.round(seconds / 60))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${(m % 60).toString().padStart(2, '0')} min`
}

export function signedPercent(actual: number, target: number): string {
  const pct = Math.round(((actual - target) / Math.max(target, 1)) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

export function pedalScoreItem(
  id: PedalScoreFactorId,
  points: number,
  maxPoints: number,
  available: boolean,
  detail: string,
): PedalScoreBreakdownItem {
  return { id, label: PEDAL_SCORE_FACTOR_LABELS[id], points, maxPoints, available, detail }
}

export function unavailableFactor(
  id: PedalScoreFactorId,
  maxPoints: number,
  detail: string,
): PedalScoreBreakdownItem {
  return pedalScoreItem(id, 0, maxPoints, false, detail)
}

export function surfaceFitFromPaved(bikeType: BikeType, paved: number, unpaved: number): number {
  if (bikeType === 'mtb') return clamp(unpaved, 0, 100) / 100
  if (bikeType === 'gravel') return clamp(1 - Math.abs(unpaved - 55) / 55, 0, 1)
  return clamp(paved, 0, 100) / 100
}

export function relativeBetter(
  value: number,
  min: number | undefined,
  max: number | undefined,
  lowerIsBetter: boolean,
): number | null {
  if (min === undefined || max === undefined) return null
  if (max === min) return 1
  const t = (value - min) / (max - min)
  return lowerIsBetter ? clamp(1 - t, 0, 1) : clamp(t, 0, 1)
}
