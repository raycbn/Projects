import type { BikeType, LatLng, RouteDraft, RoutePreference, RouteType, Waypoint } from '@/domain/types'
import { routeService } from '@/services/RouteService'

export type BikeCompareRow = {
  bikeType: BikeType
  label: string
  draft: RouteDraft
  score: number
  distanceMeters: number
  elevationGainMeters: number
  pavedPercent: number
  unpavedPercent: number
}

const COMPARE_SET: Array<{ bikeType: BikeType; label: string }> = [
  { bikeType: 'road', label: 'Carretera' },
  { bikeType: 'gravel', label: 'Gravel' },
  { bikeType: 'mtb', label: 'MTB' },
]

/**
 * Same A→B (or current mode) calculated for road / gravel / MTB in parallel.
 */
export async function compareBikesForWaypoints(input: {
  waypoints: Waypoint[]
  preferences: RoutePreference[]
  routeType: RouteType
  circularDistanceMeters?: number
  targetElevationGainMeters?: number
}): Promise<BikeCompareRow[]> {
  const results = await Promise.all(
    COMPARE_SET.map(async ({ bikeType, label }) => {
      const draft = await routeService.calculate({
        waypoints: input.waypoints,
        bikeType,
        preferences: input.preferences,
        routeType: input.routeType,
        circularDistanceMeters: input.circularDistanceMeters,
        targetElevationGainMeters: input.targetElevationGainMeters,
        wantAlternatives: false,
        title: `${label} · comparación`,
      })
      return {
        bikeType,
        label,
        draft,
        score: draft.stats.surfaceStats?.suitability?.score ?? 0,
        distanceMeters: draft.stats.distanceMeters,
        elevationGainMeters: draft.stats.elevationGainMeters,
        pavedPercent: draft.stats.surfaceStats?.pavedPercent ?? 0,
        unpavedPercent: draft.stats.surfaceStats?.unpavedPercent ?? 0,
      }
    }),
  )
  return results.sort((a, b) => b.score - a.score)
}

export function nearestPointOnRoute(
  position: LatLng,
  coordinates: [number, number][],
): { distanceMeters: number; index: number; point: LatLng } {
  let best = Number.POSITIVE_INFINITY
  let bestIndex = 0
  let bestPoint: LatLng = position
  for (let i = 0; i < coordinates.length; i += 1) {
    const [lng, lat] = coordinates[i]
    const d = haversine(position, { lat, lng })
    if (d < best) {
      best = d
      bestIndex = i
      bestPoint = { lat, lng }
    }
  }
  return { distanceMeters: best, index: bestIndex, point: bestPoint }
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Progress 0..1 along the polyline from nearest vertex. */
export function routeProgress(position: LatLng, coordinates: [number, number][]): number {
  if (coordinates.length < 2) return 0
  const near = nearestPointOnRoute(position, coordinates)
  let before = 0
  let total = 0
  for (let i = 1; i < coordinates.length; i += 1) {
    const a = { lat: coordinates[i - 1][1], lng: coordinates[i - 1][0] }
    const b = { lat: coordinates[i][1], lng: coordinates[i][0] }
    const seg = haversine(a, b)
    if (i <= near.index) before += seg
    total += seg
  }
  return total > 0 ? Math.min(1, before / total) : 0
}
