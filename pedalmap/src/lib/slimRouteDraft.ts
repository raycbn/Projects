import type { RouteAlternative, RouteDraft, RouteGeometry } from '@/domain/types'

/** Evenly downsample a LineString so storage/handoff stays under quota. */
export function downsampleGeometry(
  geometry: RouteGeometry | undefined,
  maxPoints: number,
): RouteGeometry {
  const coords = geometry?.coordinates ?? []
  if (coords.length <= maxPoints) {
    return { type: 'LineString', coordinates: coords }
  }
  const out: [number, number][] = []
  const step = (coords.length - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.min(coords.length - 1, Math.round(i * step))
    out.push(coords[idx]!)
  }
  return { type: 'LineString', coordinates: out }
}

function slimOption(opt: RouteAlternative, maxGeom: number): RouteAlternative {
  return {
    ...opt,
    geometry: downsampleGeometry(opt.geometry, maxGeom),
    elevationProfile: (opt.elevationProfile ?? []).filter((_, i) => i % 4 === 0),
    instructions: (opt.instructions ?? []).slice(0, 12),
    surfaceEdges: (opt.surfaceEdges ?? []).slice(0, 60),
  }
}

/**
 * Keep 2–3 ranked opciones usable after localStorage / sessionStorage quota
 * pressure. Prefer losing elevation detail over dropping alternate geometries.
 */
export function slimDraftKeepOptions(draft: RouteDraft): RouteDraft {
  const selected = draft.selectedOptionId
  const routeOptions = draft.routeOptions?.map((opt) => {
    const keepDense = opt.id === selected || opt.id === draft.routeOptions?.[0]?.id
    return slimOption(opt, keepDense ? 1800 : 900)
  })
  const alternatives = draft.alternatives?.map((opt) => slimOption(opt, 900))
  return {
    ...draft,
    geometry: downsampleGeometry(draft.geometry, 2500),
    elevationProfile: (draft.elevationProfile ?? []).filter((_, i) => i % 2 === 0),
    instructions: (draft.instructions ?? []).slice(0, 80),
    surfaceEdges: (draft.surfaceEdges ?? []).slice(0, 200),
    routeOptions,
    alternatives,
  }
}
