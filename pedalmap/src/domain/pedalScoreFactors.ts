import type { RouteAlternative, RoutePreference, RouteStats } from '@/domain/types'
import { longestDryStretchMeters } from '@/domain/routeEnricher'
import {
  BIKE_LABEL,
  PEDAL_SCORE_WEIGHTS,
  type PedalScoreBreakdownItem,
  type PedalScoreInput,
} from '@/domain/pedalScoreTypes'
import {
  clamp,
  closenessScore,
  formatKm,
  formatMinutes,
  pedalScoreItem,
  relativeBetter,
  signedPercent,
  surfaceFitFromPaved,
  unavailableFactor,
} from '@/domain/pedalScoreHelpers'

export function scoreDistance(input: PedalScoreInput): PedalScoreBreakdownItem {
  const maxPoints = PEDAL_SCORE_WEIGHTS.distance
  const target = input.targetDistanceMeters
  const actual = input.stats.distanceMeters
  if (!target || !(target > 0) || !Number.isFinite(actual)) {
    return unavailableFactor('distance', maxPoints, 'Sin distancia objetivo en esta salida.')
  }
  const points = Math.round(closenessScore(actual, target, 0.4) * maxPoints)
  return pedalScoreItem(
    'distance',
    clamp(points, 0, maxPoints),
    maxPoints,
    true,
    `Objetivo ${formatKm(target)}, ruta ${formatKm(actual)} (${signedPercent(actual, target)}).`,
  )
}

export function scoreElevation(input: PedalScoreInput): PedalScoreBreakdownItem {
  const maxPoints = PEDAL_SCORE_WEIGHTS.elevation
  const target = input.targetElevationGainMeters
  const actual = input.stats.elevationGainMeters
  if (!target || !(target > 0) || !Number.isFinite(actual)) {
    return unavailableFactor('elevation', maxPoints, 'Sin desnivel objetivo en esta salida.')
  }
  const points = Math.round(closenessScore(actual, target, 0.5) * maxPoints)
  return pedalScoreItem(
    'elevation',
    clamp(points, 0, maxPoints),
    maxPoints,
    true,
    `Objetivo ${Math.round(target)} m, ruta ${Math.round(actual)} m (${signedPercent(actual, target)}).`,
  )
}

export function scoreSurface(input: PedalScoreInput): PedalScoreBreakdownItem {
  const maxPoints = PEDAL_SCORE_WEIGHTS.surface
  const surface = input.stats.surfaceStats
  const suitability = surface?.suitability?.score
  if (typeof suitability === 'number' && Number.isFinite(suitability)) {
    const points = Math.round((clamp(suitability, 0, 100) / 100) * maxPoints)
    const paved = surface?.pavedPercent
    const extra = typeof paved === 'number' ? ` Pavimento ${Math.round(paved)}%.` : ''
    return pedalScoreItem(
      'surface',
      points,
      maxPoints,
      true,
      `Idoneidad de superficie ${Math.round(suitability)}/100 para ${BIKE_LABEL[input.bikeType]}.${extra}`,
    )
  }
  if (typeof surface?.pavedPercent === 'number') {
    const paved = clamp(surface.pavedPercent, 0, 100)
    const unpaved = clamp(surface.unpavedPercent ?? 100 - paved, 0, 100)
    const points = Math.round(surfaceFitFromPaved(input.bikeType, paved, unpaved) * maxPoints)
    return pedalScoreItem(
      'surface',
      points,
      maxPoints,
      true,
      `Pavimento ${Math.round(paved)}% · sin asfaltar ${Math.round(unpaved)}% (${BIKE_LABEL[input.bikeType]}).`,
    )
  }
  return unavailableFactor('surface', maxPoints, 'Esta ruta no incluye datos de superficie.')
}
export function scorePreferences(input: PedalScoreInput): PedalScoreBreakdownItem {
  const maxPoints = PEDAL_SCORE_WEIGHTS.preferences
  if (!input.preferences.length) {
    return unavailableFactor('preferences', maxPoints, 'No hay preferencias activas.')
  }
  const parts: Array<{ ok: number; detail: string }> = []
  for (const pref of input.preferences) {
    const scored = scoreOnePreference(pref, input)
    if (scored) parts.push(scored)
  }
  if (!parts.length) {
    return unavailableFactor(
      'preferences',
      maxPoints,
      'Las preferencias activas no se pueden evaluar con los datos de esta ruta.',
    )
  }
  const avg = parts.reduce((sum, p) => sum + p.ok, 0) / parts.length
  return pedalScoreItem(
    'preferences',
    clamp(Math.round(avg * maxPoints), 0, maxPoints),
    maxPoints,
    true,
    parts.map((p) => p.detail).join(' '),
  )
}

export function scoreBikeFit(input: PedalScoreInput): PedalScoreBreakdownItem {
  const maxPoints = PEDAL_SCORE_WEIGHTS.bikeFit
  const suitability = input.stats.surfaceStats?.suitability
  if (suitability && suitability.bikeType === input.bikeType && Number.isFinite(suitability.score)) {
    const points = Math.round((clamp(suitability.score, 0, 100) / 100) * maxPoints)
    return pedalScoreItem(
      'bikeFit',
      points,
      maxPoints,
      true,
      `Perfil ${BIKE_LABEL[input.bikeType]} · ${suitability.label.replace('_', ' ')} (${Math.round(suitability.score)}).`,
    )
  }
  if (typeof input.stats.surfaceStats?.pavedPercent === 'number') {
    const paved = clamp(input.stats.surfaceStats.pavedPercent, 0, 100)
    const unpaved = clamp(input.stats.surfaceStats.unpavedPercent ?? 100 - paved, 0, 100)
    const points = Math.round(surfaceFitFromPaved(input.bikeType, paved, unpaved) * maxPoints)
    return pedalScoreItem(
      'bikeFit',
      points,
      maxPoints,
      true,
      `Ajuste estimado para ${BIKE_LABEL[input.bikeType]} según pavimento ${Math.round(paved)}%.`,
    )
  }
  return unavailableFactor('bikeFit', maxPoints, 'No hay datos de idoneidad para este tipo de bici.')
}

export function scoreWater(input: PedalScoreInput): PedalScoreBreakdownItem {
  const maxPoints = PEDAL_SCORE_WEIGHTS.water
  const points = input.enrichment?.waterPoints
  const dry = longestDryStretchMeters(input.stats.distanceMeters, points)
  if (!points?.length || dry === undefined) {
    return unavailableFactor('water', maxPoints, 'Sin puntos de agua conocidos en esta ruta.')
  }
  const ratio = clamp(1 - dry / Math.max(input.stats.distanceMeters, 1), 0, 1)
  return pedalScoreItem(
    'water',
    Math.round(ratio * maxPoints),
    maxPoints,
    true,
    `${points.length} puntos de agua · tramo seco máx. ${Math.round(dry / 1000)} km.`,
  )
}

export function scoreDeferred(
  id: 'weather' | 'wind' | 'poi' | 'safety' | 'popularity' | 'direction' | 'timeOfDay',
  detail: string,
): PedalScoreBreakdownItem {
  return unavailableFactor(id, PEDAL_SCORE_WEIGHTS[id], detail)
}

function scoreOnePreference(
  pref: RoutePreference,
  input: PedalScoreInput,
): { ok: number; detail: string } | null {
  const { stats, cohort } = input
  switch (pref) {
    case 'prefer_shorter': {
      const ok = relativeBetter(stats.distanceMeters, cohort?.minDistanceMeters, cohort?.maxDistanceMeters, true)
      return ok === null ? null : { ok, detail: `Menor distancia: ${formatKm(stats.distanceMeters)}.` }
    }
    case 'prefer_faster': {
      const ok = relativeBetter(
        stats.estimatedDurationSeconds,
        cohort?.minDurationSeconds,
        cohort?.maxDurationSeconds,
        true,
      )
      return ok === null ? null : { ok, detail: `Más rápida: ${formatMinutes(stats.estimatedDurationSeconds)}.` }
    }
    case 'prefer_less_elevation': {
      const ok = relativeBetter(
        stats.elevationGainMeters,
        cohort?.minElevationGainMeters,
        cohort?.maxElevationGainMeters,
        true,
      )
      return ok === null ? null : { ok, detail: `Menor desnivel: ${Math.round(stats.elevationGainMeters)} m.` }
    }
    case 'avoid_unpaved': {
      const paved = stats.surfaceStats?.pavedPercent
      if (typeof paved !== 'number') return null
      return { ok: clamp(paved, 0, 100) / 100, detail: `Evitar sin asfaltar: pavimento ${Math.round(paved)}%.` }
    }
    case 'prefer_unpaved': {
      const unpaved = stats.surfaceStats?.unpavedPercent
      if (typeof unpaved !== 'number') return null
      return { ok: clamp(unpaved, 0, 100) / 100, detail: `Priorizar caminos: ${Math.round(unpaved)}% sin asfaltar.` }
    }
    case 'prefer_bike_lanes': {
      const share = cyclewayPercent(stats, input.surfaceEdges)
      if (share === undefined) return null
      return { ok: clamp(share / 25, 0, 1), detail: `Carril bici ≈ ${Math.round(share)}% del trazado.` }
    }
    case 'prefer_secondary_roads': {
      const share = wayPercent(stats, isSecondaryWay)
      if (share === undefined) return null
      return { ok: clamp(share / 50, 0, 1), detail: `Vías secundarias ≈ ${Math.round(share)}%.` }
    }
    case 'avoid_primary_roads': {
      const share = wayPercent(stats, isPrimaryWay)
      if (share === undefined) return null
      return { ok: clamp(1 - share / 40, 0, 1), detail: `Vías principales ≈ ${Math.round(share)}%.` }
    }
    case 'avoid_traffic': {
      const share = wayPercent(stats, (row) => isPrimaryWay(row) || isFerry(row))
      if (share === undefined) return null
      return { ok: clamp(1 - share / 40, 0, 1), detail: `Tráfico / ferry ≈ ${Math.round(share)}%.` }
    }
    default:
      return null
  }
}

function cyclewayPercent(
  stats: RouteStats,
  edges?: RouteAlternative['surfaceEdges'],
): number | undefined {
  const fromWays = wayPercent(stats, (row) => row.value === 6 || /bici|cycleway/i.test(row.type))
  if (fromWays !== undefined) return fromWays
  if (!edges?.length) return undefined
  let cycle = 0
  let total = 0
  for (const edge of edges) {
    const meters = Math.max(0, (edge.length ?? 0) * 1000)
    if (meters <= 0) continue
    total += meters
    const use = (edge.use ?? '').toLowerCase()
    const lane = (edge.cycle_lane ?? '').toLowerCase()
    if (use === 'cycleway' || (lane && lane !== 'none' && lane !== 'no')) cycle += meters
  }
  return total > 0 ? (cycle / total) * 100 : undefined
}

function wayPercent(
  stats: RouteStats,
  match: (row: { type: string; distanceMeters: number; value?: number }) => boolean,
): number | undefined {
  const ways = stats.surfaceStats?.waytypes
  if (!ways?.length) return undefined
  const total = ways.reduce((sum, row) => sum + row.distanceMeters, 0)
  if (total <= 0) return undefined
  return (ways.filter(match).reduce((sum, row) => sum + row.distanceMeters, 0) / total) * 100
}

function isPrimaryWay(row: { type: string; value?: number }): boolean {
  return row.value === 1 || /principal|motorway|trunk|primary/i.test(row.type)
}

function isSecondaryWay(row: { type: string; value?: number }): boolean {
  return row.value === 2 || row.value === 3 || /secundari|street|calle|carretera/i.test(row.type)
}

function isFerry(row: { type: string; value?: number }): boolean {
  return row.value === 9 || /ferry/i.test(row.type)
}
