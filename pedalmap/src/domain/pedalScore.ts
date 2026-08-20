import type { RouteAlternative, RouteDraft } from '@/domain/types'
import { emptyRouteEnrichment } from '@/domain/routeEnricher'
import {
  BIKE_LABEL,
  MAX_RIDE_OPTIONS,
  type PedalScore,
  type PedalScoreBreakdownItem,
  type PedalScoreContext,
  type PedalScoreFactorId,
  type PedalScoreInput,
  type RankedRideOption,
  pedalScoreContextFromDraft,
} from '@/domain/pedalScoreTypes'
import { buildCohort, clamp, collectRideOptions, formatKm, formatMinutes } from '@/domain/pedalScoreHelpers'
import {
  scoreBikeFit,
  scoreDeferred,
  scoreDistance,
  scoreElevation,
  scorePreferences,
  scoreSurface,
  scoreWater,
} from '@/domain/pedalScoreFactors'

export type {
  PedalScore,
  PedalScoreBreakdownItem,
  PedalScoreContext,
  PedalScoreFactorId,
  PedalScoreInput,
  RankedRideOption,
} from '@/domain/pedalScoreTypes'
export { PEDAL_SCORE_FACTOR_LABELS, PEDAL_SCORE_WEIGHTS } from '@/domain/pedalScoreTypes'
export { collectRideOptions, pedalScoreContextFromDraft }

export function computePedalScore(input: PedalScoreInput): PedalScore {
  const enrichment = input.enrichment ?? emptyRouteEnrichment()
  const withEnrichment = { ...input, enrichment }
  const scored = [
    scoreDistance(withEnrichment),
    scoreElevation(withEnrichment),
    scoreSurface(withEnrichment),
    scorePreferences(withEnrichment),
    scoreBikeFit(withEnrichment),
    scoreWater(withEnrichment),
    scoreDeferred('weather', 'Sin meteorología en el score.'),
    scoreDeferred('wind', 'Sin viento en el score.'),
    scoreDeferred('poi', 'Sin POI en el score.'),
    scoreDeferred('safety', 'Seguridad aún no ponderada.'),
    scoreDeferred('popularity', 'Popularidad aún no ponderada.'),
    scoreDeferred('direction', 'Sentido óptimo aún no ponderado.'),
    scoreDeferred('timeOfDay', 'Horario aún no ponderado.'),
  ]
  const breakdown = scored.filter((item) => item.maxPoints > 0)
  const available = breakdown.filter((item) => item.available)
  const rawMax = available.reduce((sum, item) => sum + item.maxPoints, 0)
  const rawGot = available.reduce((sum, item) => sum + item.points, 0)
  const total = rawMax > 0 ? clamp(Math.round((rawGot / rawMax) * 100), 0, 100) : 0
  return {
    total,
    breakdown: available,
    explanation: explainScore(input, available),
  }
}

export function rankRideOptions(
  options: RouteAlternative[],
  context: PedalScoreContext,
): RankedRideOption[] {
  const limited = options.slice(0, MAX_RIDE_OPTIONS)
  if (!limited.length) return []
  const cohort = buildCohort(limited.map((o) => o.stats))
  const ranked = limited
    .map((option) => ({
      optionId: option.id,
      label: option.label,
      stats: option.stats,
      score: computePedalScore({
        stats: option.stats,
        bikeType: context.bikeType,
        preferences: context.preferences,
        targetDistanceMeters: context.targetDistanceMeters,
        targetElevationGainMeters: context.targetElevationGainMeters,
        cohort,
        surfaceEdges: option.surfaceEdges,
        enrichment: context.enrichment,
      }),
      recommended: false,
    }))
    .sort((a, b) => {
      const diff = b.score.total - a.score.total
      if (diff !== 0) return diff
      return a.stats.distanceMeters - b.stats.distanceMeters
    })

  if (ranked[0]) ranked[0].recommended = true
  return ranked.map((row) => ({
    ...row,
    score: { ...row.score, explanation: explainRecommendation(row, ranked, context) },
  }))
}

export function recommendRide(draft: RouteDraft): {
  ranked: RankedRideOption[]
  recommendedId: string | undefined
} {
  const ranked = rankRideOptions(collectRideOptions(draft), pedalScoreContextFromDraft(draft))
  return { ranked, recommendedId: ranked.find((r) => r.recommended)?.optionId }
}

function explainScore(input: PedalScoreInput, available: PedalScoreBreakdownItem[]): string {
  if (!available.length) return 'No hay datos suficientes para puntuar esta ruta.'
  const best = [...available].sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints)[0]
  if (best.id === 'distance' && input.targetDistanceMeters) {
    return `Se acerca a tu distancia objetivo (${formatKm(input.stats.distanceMeters)} vs ${formatKm(input.targetDistanceMeters)}).`
  }
  if (best.id === 'elevation' && input.targetElevationGainMeters) {
    return `Se acerca a tu desnivel objetivo (${Math.round(input.stats.elevationGainMeters)} m vs ${Math.round(input.targetElevationGainMeters)} m).`
  }
  if (best.id === 'surface') return `La superficie encaja con tu bici ${BIKE_LABEL[input.bikeType]}.`
  if (best.id === 'preferences') return best.detail
  if (best.id === 'bikeFit') return `Es adecuada para ${BIKE_LABEL[input.bikeType]}.`
  return `${best.label}: ${best.detail}`
}

function explainRecommendation(
  row: RankedRideOption,
  all: RankedRideOption[],
  context: PedalScoreContext,
): string {
  const others = all.filter((r) => r.optionId !== row.optionId)
  if (!row.recommended || !others.length) return row.score.explanation

  let bestFactor: PedalScoreFactorId | null = null
  let bestDelta = -Infinity
  for (const item of row.score.breakdown) {
    const otherMax = Math.max(
      0,
      ...others.map((o) => o.score.breakdown.find((b) => b.id === item.id)?.points ?? 0),
    )
    const delta = item.points - otherMax
    if (delta > bestDelta) {
      bestDelta = delta
      bestFactor = item.id
    }
  }

  if (bestFactor === 'distance' && context.targetDistanceMeters) {
    return `Es la opción que mejor se ajusta a tu salida y se acerca más a tu distancia objetivo (${formatKm(row.stats.distanceMeters)} vs ${formatKm(context.targetDistanceMeters)}).`
  }
  if (bestFactor === 'elevation' && context.targetElevationGainMeters) {
    return `Es la que mejor cumple tu desnivel objetivo (${Math.round(row.stats.elevationGainMeters)} m vs ${Math.round(context.targetElevationGainMeters)} m).`
  }
  if (bestFactor === 'elevation' || context.preferences.includes('prefer_less_elevation')) {
    const minElev = Math.min(row.stats.elevationGainMeters, ...others.map((o) => o.stats.elevationGainMeters))
    if (row.stats.elevationGainMeters === minElev) {
      return `Es la de menor desnivel (+${Math.round(row.stats.elevationGainMeters)} m).`
    }
  }
  if (bestFactor === 'surface') {
    const paved = row.stats.surfaceStats?.pavedPercent
    const suit = row.stats.surfaceStats?.suitability?.score
    if (typeof paved === 'number') {
      return `Tiene mejor superficie para ${BIKE_LABEL[context.bikeType]} (${Math.round(paved)}% pavimento).`
    }
    if (typeof suit === 'number') {
      return `Tiene mejor superficie para ${BIKE_LABEL[context.bikeType]} (idoneidad ${Math.round(suit)}).`
    }
  }
  if (bestFactor === 'preferences' && context.preferences.length) {
    return `Cumple mejor tus preferencias.`
  }
  if (bestFactor === 'bikeFit') {
    return `Es la más adecuada para ${BIKE_LABEL[context.bikeType]}.`
  }
  if (context.preferences.includes('prefer_faster')) {
    const minDur = Math.min(
      row.stats.estimatedDurationSeconds,
      ...others.map((o) => o.stats.estimatedDurationSeconds),
    )
    if (row.stats.estimatedDurationSeconds === minDur) {
      return `Es la más rápida (${formatMinutes(row.stats.estimatedDurationSeconds)}).`
    }
  }
  if (context.targetDistanceMeters) {
    return 'Es la opción que mejor se ajusta a tu salida y se acerca más a tu distancia objetivo.'
  }
  return `Es la que mejor encaja con cómo quieres salir (PedalScore ${row.score.total}/100).`
}
