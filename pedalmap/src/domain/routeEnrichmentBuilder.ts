import type { LatLng, RouteGeometry } from '@/domain/types'
import type { WaterPoint } from '@/domain/routeEnricher'
import { cumulativeDistances, distanceToSegment, deduplicateByProximity, sortAlongRoute, limitResults, closestPointOnSegment, haversineMeters } from '@/lib/routeGeometry'

export interface RawWaterSource {
  id: string
  position: LatLng
  name?: string | null
  address?: string | null
  access?: string | null
  drinkingWater?: string | null
  description?: string | null
  website?: string | null
  phone?: string | null
}

export interface BuildWaterPointsOptions {
  geometry: RouteGeometry
  sources: RawWaterSource[]
  maxVisible?: number
  maxDetourMeters?: number
  minSeparationMeters?: number
}

const DEFAULT_MAX_VISIBLE = 10
const DEFAULT_MAX_DETOUR = 500
const DEFAULT_MIN_SEPARATION = 80

export function buildWaterPointsAlongRoute(opts: BuildWaterPointsOptions): {
  recommended: WaterPoint[]
  all: WaterPoint[]
} {
  const { geometry, sources, maxVisible, maxDetourMeters, minSeparationMeters } = opts
  if (!geometry.coordinates.length || !sources.length) {
    return { recommended: [], all: [] }
  }

  const coords = geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
  const cum = cumulativeDistances(coords)

  const projected = sources
    .map((src) => {
      const proj = projectSource(src.position, coords, cum)
      if (!proj) return null
      return {
        id: src.id,
        position: src.position,
        name: src.name ?? undefined,
        distanceAlongRouteMeters: proj.distanceAlongRouteMeters,
        detourMeters: proj.detourMeters,
        address: src.address,
        access: src.access,
        drinkingWater: src.drinkingWater,
        description: src.description,
        website: src.website,
        phone: src.phone,
      } as WaterPoint
    })
    .filter((wp): wp is WaterPoint => wp !== null && (wp.detourMeters ?? 0) <= (maxDetourMeters ?? DEFAULT_MAX_DETOUR))

  const deduped = deduplicateByProximity(projected, minSeparationMeters ?? DEFAULT_MIN_SEPARATION, (wp) => wp.position)
  const sorted = sortAlongRoute(deduped)
  const all = limitResults(sorted, 200)
  const recommended = selectDistributedWaterPoints(all, maxVisible ?? DEFAULT_MAX_VISIBLE)

  return { recommended, all }
}

export function selectDistributedWaterPoints(candidates: WaterPoint[], maxVisible: number): WaterPoint[] {
  if (!candidates.length || maxVisible <= 0) return []
  if (candidates.length <= maxVisible) return candidates

  const routeLength = candidates[candidates.length - 1].distanceAlongRouteMeters ?? 0
  if (routeLength <= 0) return limitResults(candidates, maxVisible)

  const binCount = Math.min(maxVisible, Math.max(1, Math.floor(routeLength / 5000)))
  const binSize = routeLength / binCount
  const bins: WaterPoint[][] = Array.from({ length: binCount }, () => [])

  for (const pt of candidates) {
    const dist = pt.distanceAlongRouteMeters ?? 0
    const binIndex = Math.min(binCount - 1, Math.floor(dist / binSize))
    bins[binIndex].push(pt)
  }

  const selected: WaterPoint[] = []
  for (const bin of bins) {
    if (bin.length === 0) continue
    const best = bin.reduce((a, b) => (a.detourMeters ?? Infinity) <= (b.detourMeters ?? Infinity) ? a : b)
    selected.push(best)
  }

  if (selected.length < maxVisible) {
    const used = new Set(selected.map((s) => s.id))
    const remaining = candidates.filter((c) => !used.has(c.id))
    const filler = limitResults(remaining, maxVisible - selected.length)
    selected.push(...filler)
  }

  return limitResults(selected, maxVisible)
}

function projectSource(
  poi: LatLng,
  coords: LatLng[],
  cum: number[],
): { distanceAlongRouteMeters: number; detourMeters: number } | null {
  let bestDist = Infinity
  let bestAlong = 0
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1]
    const b = coords[i]
    const d = distanceToSegment(poi, a, b)
    if (d < bestDist) {
      bestDist = d
      const projected = closestPointOnSegment(poi, a, b)
      bestAlong = cum[i - 1] + haversineMeters(a, projected)
    }
  }
  if (!Number.isFinite(bestDist) || bestDist > 500) return null
  return { distanceAlongRouteMeters: bestAlong, detourMeters: bestDist }
}
