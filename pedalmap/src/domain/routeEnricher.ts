import type { ElevationPoint, LatLng, RouteGeometry, RouteStats } from '@/domain/types'
import type { RouteWeatherTimeline } from '@/domain/routeWeatherTimeline'

/**
 * Future-facing enrichment attached to a calculated route.
 * v1 does not invent datasets — slots stay empty until real sources exist.
 */
export interface WaterPoint {
  id: string
  position: LatLng
  name?: string
  /** Metres along the route geometry, when known. */
  distanceAlongRouteMeters?: number
  /** Extra metres to leave the route and reach the point. */
  detourMeters?: number
  address?: string | null
  access?: string | null
  drinkingWater?: string | null
  description?: string | null
  website?: string | null
  phone?: string | null
}

export interface RoutePoi {
  id: string
  position: LatLng
  name?: string
  category?: string
  distanceAlongRouteMeters?: number
  detourMeters?: number
}

export interface RouteEnrichment {
  waterPoints?: WaterPoint[]
  poi?: RoutePoi[]
  weather?: RouteWeatherTimeline
  wind?: unknown
  safety?: unknown
  climbs?: unknown
  services?: unknown
  incidents?: unknown
}

export interface EnrichedRouteView {
  geometry: RouteGeometry
  stats: RouteStats
  elevationProfile: ElevationPoint[]
  enrichment: RouteEnrichment
}

export function emptyRouteEnrichment(): RouteEnrichment {
  return {}
}

export function attachRouteEnrichment<T extends object>(
  route: T,
  enrichment: RouteEnrichment = emptyRouteEnrichment(),
): T & { enrichment: RouteEnrichment } {
  return { ...route, enrichment }
}

/**
 * Longest stretch without a known water point.
 * Returns undefined when there is no water dataset — never invents points.
 */
export function longestDryStretchMeters(
  routeDistanceMeters: number,
  waterPoints: WaterPoint[] | undefined,
): number | undefined {
  if (!waterPoints?.length || !(routeDistanceMeters > 0)) return undefined
  const along = waterPoints
    .map((p) => p.distanceAlongRouteMeters)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b)
  if (!along.length) return undefined

  let longest = along[0]
  for (let i = 1; i < along.length; i += 1) {
    longest = Math.max(longest, along[i] - along[i - 1])
  }
  longest = Math.max(longest, routeDistanceMeters - along[along.length - 1])
  return longest
}
