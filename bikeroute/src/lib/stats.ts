import type { Difficulty, ElevationPoint, LatLng, RouteStats } from '@/domain/types'

const EARTH_RADIUS_M = 6371000

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function pathDistanceMeters(points: LatLng[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1], points[i])
  }
  return total
}

export function computeElevationStats(profile: ElevationPoint[]): {
  gain: number
  loss: number
  highest?: number
  lowest?: number
  significantClimbs: number
} {
  if (profile.length === 0) {
    return { gain: 0, loss: 0, significantClimbs: 0 }
  }

  let gain = 0
  let loss = 0
  let highest = profile[0].elevationMeters
  let lowest = profile[0].elevationMeters
  let climbAccum = 0
  let significantClimbs = 0

  for (let i = 1; i < profile.length; i += 1) {
    const delta = profile[i].elevationMeters - profile[i - 1].elevationMeters
    highest = Math.max(highest, profile[i].elevationMeters)
    lowest = Math.min(lowest, profile[i].elevationMeters)

    if (delta > 0) {
      gain += delta
      climbAccum += delta
      if (climbAccum >= 50) {
        significantClimbs += 1
        climbAccum = 0
      }
    } else if (delta < 0) {
      loss += Math.abs(delta)
      climbAccum = 0
    }
  }

  return { gain, loss, highest, lowest, significantClimbs }
}

export function estimateDifficulty(
  distanceMeters: number,
  elevationGainMeters: number,
): Difficulty {
  const score = distanceMeters / 1000 + elevationGainMeters / 100
  if (score < 30) return 'easy'
  if (score < 70) return 'moderate'
  if (score < 120) return 'hard'
  return 'expert'
}

/** Rough cycling duration: ~18 km/h base, +1 min per 10 m gain. */
export function estimateDurationSeconds(
  distanceMeters: number,
  elevationGainMeters: number,
  bikeType: string,
): number {
  const speedKmh =
    bikeType === 'road' ? 22 : bikeType === 'ebike' ? 24 : bikeType === 'urban' ? 16 : 14
  const movingHours = distanceMeters / 1000 / speedKmh
  const climbMinutes = elevationGainMeters / 10
  return Math.round(movingHours * 3600 + climbMinutes * 60)
}

export function buildStatsFromProfile(
  distanceMeters: number,
  profile: ElevationPoint[],
  bikeType: string,
  durationSeconds?: number,
): RouteStats {
  const elev = computeElevationStats(profile)
  const elevationGainMeters = Math.round(elev.gain)
  return {
    distanceMeters: Math.round(distanceMeters),
    elevationGainMeters,
    elevationLossMeters: Math.round(elev.loss),
    estimatedDurationSeconds:
      durationSeconds ??
      estimateDurationSeconds(distanceMeters, elevationGainMeters, bikeType),
    difficulty: estimateDifficulty(distanceMeters, elevationGainMeters),
    highestPointMeters: elev.highest !== undefined ? Math.round(elev.highest) : undefined,
    lowestPointMeters: elev.lowest !== undefined ? Math.round(elev.lowest) : undefined,
    significantClimbs: elev.significantClimbs,
  }
}

export function formatDistance(meters: number, locale = 'es-ES'): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km`
}

export function formatElevation(meters: number, locale = 'es-ES'): string {
  const sign = meters >= 0 ? '+' : ''
  return `${sign}${Math.round(meters).toLocaleString(locale)} m`
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  return `${h} h ${m.toString().padStart(2, '0')} min`
}

export function difficultyLabel(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'Fácil'
    case 'moderate':
      return 'Moderada'
    case 'hard':
      return 'Difícil'
    case 'expert':
      return 'Experta'
  }
}
