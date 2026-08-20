import type {
  BikeType,
  RouteAlternative,
  RouteDraft,
  RoutePreference,
  RouteStats,
} from '@/domain/types'
import type { RouteEnrichment } from '@/domain/routeEnricher'

export type PedalScoreFactorId =
  | 'distance'
  | 'elevation'
  | 'surface'
  | 'preferences'
  | 'bikeFit'
  | 'weather'
  | 'wind'
  | 'water'
  | 'poi'
  | 'safety'
  | 'popularity'
  | 'direction'
  | 'timeOfDay'

/** Centralized weights. Change here — do not scatter magic numbers in UI. */
export const PEDAL_SCORE_WEIGHTS: Record<PedalScoreFactorId, number> = {
  distance: 25,
  elevation: 20,
  surface: 25,
  preferences: 20,
  bikeFit: 10,
  weather: 0,
  wind: 0,
  water: 15,
  poi: 0,
  safety: 0,
  popularity: 0,
  direction: 0,
  timeOfDay: 0,
}

export const PEDAL_SCORE_FACTOR_LABELS: Record<PedalScoreFactorId, string> = {
  distance: 'Distancia',
  elevation: 'Desnivel',
  surface: 'Superficie',
  preferences: 'Preferencias',
  bikeFit: 'Adecuación',
  weather: 'Meteorología',
  wind: 'Viento',
  water: 'Agua',
  poi: 'POI',
  safety: 'Seguridad',
  popularity: 'Popularidad',
  direction: 'Sentido',
  timeOfDay: 'Horario',
}

export const BIKE_LABEL: Record<BikeType, string> = {
  road: 'carretera',
  mtb: 'MTB',
  gravel: 'gravel',
  urban: 'urbana',
  ebike: 'e-bike',
}

export const MAX_RIDE_OPTIONS = 3

export interface PedalScoreCohort {
  minDistanceMeters: number
  maxDistanceMeters: number
  minElevationGainMeters: number
  maxElevationGainMeters: number
  minDurationSeconds: number
  maxDurationSeconds: number
}

export interface PedalScoreInput {
  stats: RouteStats
  bikeType: BikeType
  preferences: RoutePreference[]
  targetDistanceMeters?: number
  targetElevationGainMeters?: number
  cohort?: PedalScoreCohort
  surfaceEdges?: RouteAlternative['surfaceEdges']
  enrichment?: RouteEnrichment
}

export interface PedalScoreBreakdownItem {
  id: PedalScoreFactorId
  label: string
  points: number
  maxPoints: number
  available: boolean
  detail: string
}

export interface PedalScore {
  total: number
  breakdown: PedalScoreBreakdownItem[]
  explanation: string
}

export interface PedalScoreContext {
  bikeType: BikeType
  preferences: RoutePreference[]
  targetDistanceMeters?: number
  targetElevationGainMeters?: number
  enrichment?: RouteEnrichment
}

export interface RankedRideOption {
  optionId: string
  label: string
  stats: RouteStats
  score: PedalScore
  recommended: boolean
}

export function pedalScoreContextFromDraft(
  draft: Pick<
    RouteDraft,
    'bikeType' | 'preferences' | 'circularDistanceMeters' | 'targetElevationGainMeters'
  >,
): PedalScoreContext {
  return {
    bikeType: draft.bikeType,
    preferences: draft.preferences,
    targetDistanceMeters:
      draft.circularDistanceMeters && draft.circularDistanceMeters > 0
        ? draft.circularDistanceMeters
        : undefined,
    targetElevationGainMeters:
      draft.targetElevationGainMeters && draft.targetElevationGainMeters > 0
        ? draft.targetElevationGainMeters
        : undefined,
  }
}
