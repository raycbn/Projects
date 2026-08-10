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
 * Build a stable, ranked list of route options (Opción 1..N).
 * Active geometry is the best surface fit (or the shortest if tied).
 */
export function rankRouteOptions(candidates: RouteOptionCandidate[]): RankedRouteBundle {
  if (!candidates.length) {
    throw new Error('rankRouteOptions requires at least one candidate')
  }

  const sorted = [...candidates].sort((a, b) => {
    const scoreDiff = scoreOf(b.stats) - scoreOf(a.stats)
    if (Math.abs(scoreDiff) > 0.5) return scoreDiff
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
