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

/** Closest point on segment AB to P, in local meters projection. */
function closestOnSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; t: number } {
  const ax = a.lng
  const ay = a.lat
  const bx = b.lng
  const by = b.lat
  const px = p.lng
  const py = p.lat
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 <= 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return {
    t,
    point: { lng: ax + t * dx, lat: ay + t * dy },
  }
}

/**
 * Distance to the polyline (segment projection), not only vertices.
 * `index` is the segment start vertex (or last vertex if empty).
 */
export function nearestPointOnRoute(
  position: LatLng,
  coordinates: [number, number][],
): { distanceMeters: number; index: number; point: LatLng } {
  if (coordinates.length === 0) {
    return { distanceMeters: Number.POSITIVE_INFINITY, index: 0, point: position }
  }
  if (coordinates.length === 1) {
    const point = { lat: coordinates[0][1], lng: coordinates[0][0] }
    return { distanceMeters: haversine(position, point), index: 0, point }
  }

  let best = Number.POSITIVE_INFINITY
  let bestIndex = 0
  let bestPoint: LatLng = position
  for (let i = 1; i < coordinates.length; i += 1) {
    const a = { lat: coordinates[i - 1][1], lng: coordinates[i - 1][0] }
    const b = { lat: coordinates[i][1], lng: coordinates[i][0] }
    const { point } = closestOnSegment(position, a, b)
    const d = haversine(position, point)
    if (d < best) {
      best = d
      bestIndex = i - 1
      bestPoint = point
    }
  }
  return { distanceMeters: best, index: bestIndex, point: bestPoint }
}

/** Progress 0..1 along the polyline toward the nearest point on a segment. */
export function routeProgress(position: LatLng, coordinates: [number, number][]): number {
  if (coordinates.length < 2) return 0
  const near = nearestPointOnRoute(position, coordinates)
  let before = 0
  let total = 0
  for (let i = 1; i < coordinates.length; i += 1) {
    const a = { lat: coordinates[i - 1][1], lng: coordinates[i - 1][0] }
    const b = { lat: coordinates[i][1], lng: coordinates[i][0] }
    const seg = haversine(a, b)
    if (i - 1 < near.index) before += seg
    else if (i - 1 === near.index) before += haversine(a, near.point)
    total += seg
  }
  return total > 0 ? Math.min(1, before / total) : 0
}

/** Off-route threshold that accounts for phone GPS noise. */
export function offRouteThresholdMeters(accuracyMeters?: number): number {
  const accuracy = Number.isFinite(accuracyMeters) ? Math.max(0, accuracyMeters as number) : 40
  // Phone GPS is often 30–80 m; don't nag for standing near the start of a ride.
  return Math.max(160, accuracy + 100)
}
