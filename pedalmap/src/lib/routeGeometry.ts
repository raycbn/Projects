import type { LatLng } from '@/domain/types'

const R = 6371000

function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function cumulativeDistances(coords: LatLng[]): number[] {
  const out: number[] = [0]
  for (let i = 1; i < coords.length; i += 1) {
    out.push(out[i - 1] + haversineMeters(coords[i - 1], coords[i]))
  }
  return out
}

export function pointAtDistance(
  coords: LatLng[],
  cum: number[],
  target: number,
): { position: LatLng; index: number } | null {
  const total = cum[cum.length - 1] ?? 0
  if (total <= 0 || coords.length < 2) return null
  const t = Math.max(0, Math.min(total, target))
  let i = 1
  while (i < cum.length && cum[i] < t) i += 1
  const i1 = Math.max(1, i)
  const i0 = i1 - 1
  const segLen = cum[i1] - cum[i0] || 1
  const f = (t - cum[i0]) / segLen
  const a = coords[i0]
  const b = coords[i1]
  return {
    position: { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f },
    index: i0,
  }
}

export function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const φ = (p.lat * Math.PI) / 180
  const λ1 = (a.lng * Math.PI) / 180
  const λ2 = (b.lng * Math.PI) / 180
  const λ = (p.lng * Math.PI) / 180

  const x = (λ - λ1) * Math.cos((φ1 + φ2) / 2)
  const y = φ - φ1
  const dx = (λ2 - λ1) * Math.cos((φ1 + φ2) / 2)
  const dy = φ2 - φ1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return haversineMeters(p, a)

  let t = (x * dx + y * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const closestLat = φ1 + t * dy
  const closestLng = λ1 + t * dx
  const dφ = closestLat - φ
  const dλ = closestLng - λ
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ) * Math.cos(closestLat) * Math.sin(dλ / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function projectPoiAlongRoute(
  poi: LatLng,
  coords: LatLng[],
  cum: number[],
): { distanceAlongRouteMeters: number; detourMeters: number } | null {
  let bestDist = Infinity
  let bestAlong = 0
  for (let i = 1; i < coords.length; i += 1) {
    const d = distanceToSegment(poi, coords[i - 1], coords[i])
    if (d < bestDist) {
      bestDist = d
      bestAlong = cum[i - 1]
    }
  }
  if (!Number.isFinite(bestDist) || bestDist > 500) return null
  return { distanceAlongRouteMeters: bestAlong, detourMeters: bestDist }
}

export function buildBbox(coords: LatLng[]): [number, number, number, number] | null {
  if (!coords.length) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat
    if (c.lat > maxLat) maxLat = c.lat
    if (c.lng < minLng) minLng = c.lng
    if (c.lng > maxLng) maxLng = c.lng
  }
  const pad = 0.01
  return [minLat - pad, minLng - pad, maxLat + pad, maxLng + pad]
}

export function deduplicateByProximity<T>(
  items: T[],
  minSeparationMeters = 80,
  getPosition: (item: T) => LatLng = (item) => item as unknown as LatLng,
): T[] {
  const out: T[] = []
  for (const item of items) {
    const tooClose = out.some((kept) => haversineMeters(getPosition(item), getPosition(kept)) < minSeparationMeters)
    if (!tooClose) out.push(item)
  }
  return out
}

export function sortAlongRoute<T extends { distanceAlongRouteMeters?: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const da = a.distanceAlongRouteMeters ?? Infinity
    const db = b.distanceAlongRouteMeters ?? Infinity
    return da - db
  })
}

export function limitResults<T>(items: T[], max = 10): T[] {
  return items.slice(0, max)
}

export function estimatedArrivalMinutes(
  distanceMeters: number,
  totalDistanceMeters: number,
  totalDurationSeconds: number,
): number {
  if (!Number.isFinite(totalDistanceMeters) || totalDistanceMeters <= 0) return 0
  if (!Number.isFinite(totalDurationSeconds) || totalDurationSeconds <= 0) return 0
  const ratio = Math.max(0, Math.min(1, distanceMeters / totalDistanceMeters))
  return Math.round(ratio * (totalDurationSeconds / 60))
}

export function sampleRoutePoints(
  coords: LatLng[],
  intervalMeters: number,
): Array<{ distanceMeters: number; position: LatLng }> {
  if (!coords.length || intervalMeters <= 0) return []
  const cum = cumulativeDistances(coords)
  const total = cum[cum.length - 1] ?? 0
  if (total <= 0) return []

  const out: Array<{ distanceMeters: number; position: LatLng }> = []
  let next = 0
  while (next <= total) {
    const p = pointAtDistance(coords, cum, next)
    if (p) out.push({ distanceMeters: next, position: p.position })
    next += intervalMeters
  }
  if (out.length === 0 || out[out.length - 1].distanceMeters < total) {
    const last = pointAtDistance(coords, cum, total)
    if (last) out.push({ distanceMeters: total, position: last.position })
  }
  return out
}
