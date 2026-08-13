import type { ElevationPoint, RouteAlternative, RouteGeometry, RouteStats } from '@/domain/types'

type SurfaceEdges = NonNullable<RouteAlternative['surfaceEdges']>

export type RouteOptionCandidate = {
  geometry: RouteGeometry
  elevationProfile: ElevationPoint[]
  stats: RouteStats
  instructions?: string[]
  surfaceEdges?: SurfaceEdges
}

export type RankedRouteBundle = {
  active: RouteOptionCandidate
  routeOptions: RouteAlternative[]
  selectedOptionId: string
}

function scoreOf(stats: RouteStats): number {
  return stats.surfaceStats?.suitability?.score ?? 0
}

/**
 * Free public-data stand-in for Strava's RouteMaster "athlete popularity"
 * signal: OSM signed cycle networks (icn/ncn/rcn/lcn) + cycleways/lanes.
 * Only used as a tie-breaker among alternatives with near-identical surface
 * fit — never strong enough to override a genuinely better surface match.
 */
function cycleFitOf(stats: RouteStats): number {
  const s = stats.surfaceStats
  if (!s) return 0
  const network = Math.max(0, Math.min(100, s.cycleNetworkPercent ?? 0))
  const infra = Math.max(0, Math.min(100, s.cycleInfraPercent ?? 0))
  return network * 0.6 + infra * 0.4
}

/**
 * Build a stable, ranked list of route options (Opción 1..N).
 * Active geometry is the best surface fit; among near-ties, prefer more
 * cycle infrastructure; final tie-break is the shortest distance.
 */
export function rankRouteOptions(candidates: RouteOptionCandidate[]): RankedRouteBundle {
  if (!candidates.length) {
    throw new Error('rankRouteOptions requires at least one candidate')
  }

  const sorted = [...candidates].sort((a, b) => {
    const scoreDiff = scoreOf(b.stats) - scoreOf(a.stats)
    if (Math.abs(scoreDiff) > 0.5) return scoreDiff
    const cycleDiff = cycleFitOf(b.stats) - cycleFitOf(a.stats)
    if (Math.abs(cycleDiff) > 3) return cycleDiff
    return a.stats.distanceMeters - b.stats.distanceMeters
  })

  const routeOptions: RouteAlternative[] = sorted.map((c, index) => ({
    id: `opt-${index + 1}`,
    label: `Opción ${index + 1}`,
    rank: index + 1,
    geometry: c.geometry,
    elevationProfile: c.elevationProfile,
    stats: c.stats,
    instructions: c.instructions?.filter(Boolean).slice(0, 40),
    surfaceEdges: c.surfaceEdges,
  }))

  const selected = routeOptions[0]
  return {
    active: {
      geometry: selected.geometry,
      elevationProfile: selected.elevationProfile,
      stats: selected.stats,
      instructions: selected.instructions,
      surfaceEdges: selected.surfaceEdges,
    },
    routeOptions,
    selectedOptionId: selected.id,
  }
}

/** Swap the active draft fields to a ranked option without losing the full list. */
export function applySelectedOption<
  T extends {
    geometry: RouteGeometry
    elevationProfile: ElevationPoint[]
    stats: RouteStats
    instructions?: string[]
    surfaceEdges?: SurfaceEdges
    routeOptions?: RouteAlternative[]
    selectedOptionId?: string
    title: string
  },
>(draft: T, optionId: string): T {
  const options = draft.routeOptions
  if (!options?.length) return draft
  const selected = options.find((o) => o.id === optionId)
  if (!selected) return draft
  const baseTitle = draft.title.replace(/\s·\sOpción\s+\d+$/i, '')
  return {
    ...draft,
    geometry: selected.geometry,
    elevationProfile: selected.elevationProfile,
    stats: selected.stats,
    instructions: selected.instructions ?? draft.instructions,
    surfaceEdges: selected.surfaceEdges ?? draft.surfaceEdges,
    selectedOptionId: selected.id,
    title: `${baseTitle} · ${selected.label}`,
  }
}

/**
 * Rebuild `routeOptions` from legacy `alternatives` when the ranked list is missing
 * (older handoffs / lean cloud drafts).
 */
export function ensureRouteOptions<
  T extends {
    geometry: RouteGeometry
    elevationProfile: ElevationPoint[]
    stats: RouteStats
    instructions?: string[]
    surfaceEdges?: SurfaceEdges
    routeOptions?: RouteAlternative[]
    selectedOptionId?: string
    alternatives?: RouteAlternative[]
  },
>(
  draft: T,
): T & { routeOptions?: RouteAlternative[]; selectedOptionId?: string } {
  if ((draft.routeOptions?.length ?? 0) > 1) return draft
  const legacy = draft.alternatives
  if (!legacy?.length) return draft
  const ranked = rankRouteOptions([
    {
      geometry: draft.geometry,
      elevationProfile: draft.elevationProfile,
      stats: draft.stats,
      instructions: draft.instructions,
      surfaceEdges: draft.surfaceEdges,
    },
    ...legacy.map((alt) => ({
      geometry: alt.geometry,
      elevationProfile: alt.elevationProfile,
      stats: alt.stats,
      instructions: alt.instructions,
      surfaceEdges: alt.surfaceEdges,
    })),
  ])
  return {
    ...draft,
    routeOptions: ranked.routeOptions,
    selectedOptionId: draft.selectedOptionId ?? ranked.selectedOptionId,
  }
}
