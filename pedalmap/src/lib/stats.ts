import type { Difficulty, ElevationPoint, LatLng, RouteStats } from '@/domain/types'

const EARTH_RADIUS_M = 6371000

/**
 * Threshold for counting climb toward cycling elevation gain (“desnivel positivo”).
 * ORS elevations are DEM-based (not barometric). Strava uses ~10 m for DEM / non-baro
 * sources and ~2–3 m for barometric. We use the DEM threshold here.
 *
 * Applies to EVERY PedalMap bike profile (road / mtb / gravel / urban / ebike)
 * and every ORS cycling-* profile — never MTB-only.
 */
export const CYCLING_ELEVATION_THRESHOLD_M = 10

/** Moving-average window (samples) to damp DEM stair-steps before gain. */
export const CYCLING_ELEVATION_SMOOTH_WINDOW = 5

/**
 * Max plausible jump between consecutive DEM samples before treating as glitch.
 * Shared by all cycling profiles (road DEM has the same artifacts as MTB).
 */
export const CYCLING_ELEVATION_MAX_STEP_M = 80

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

function isUsableElevation(v: number | undefined | null): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * Fix DEM/ORS glitches for ALL cycling profiles:
 * - missing / NaN elevations
 * - isolated 0 (or near-sea) samples when neighbors are inland
 * - single-sample spikes that snap back (fake cliffs)
 *
 * Same pipeline for road, mtb, gravel, urban and ebike.
 */
export function sanitizeElevationProfile(profile: ElevationPoint[]): ElevationPoint[] {
  if (profile.length === 0) return profile
  const values = profile.map((p) => p.elevationMeters)

  const nearest = (from: number, step: -1 | 1): number | undefined => {
    for (let i = from + step; i >= 0 && i < values.length; i += step) {
      const v = values[i]
      if (isUsableElevation(v) && Math.abs(v) > 0.5) return v
    }
    return undefined
  }

  const cleaned = values.map((v, i) => {
    const prev = nearest(i, -1)
    const next = nearest(i, 1)
    const inlandNeighbor = Math.max(prev ?? 0, next ?? 0)

    const missing = !isUsableElevation(v)
    const seaLevelGlitch = isUsableElevation(v) && Math.abs(v) <= 0.5 && inlandNeighbor > 40
    const spike =
      isUsableElevation(v) &&
      prev !== undefined &&
      next !== undefined &&
      Math.abs(v - prev) > CYCLING_ELEVATION_MAX_STEP_M &&
      Math.abs(v - next) > CYCLING_ELEVATION_MAX_STEP_M &&
      Math.abs(prev - next) < CYCLING_ELEVATION_MAX_STEP_M

    if (!missing && !seaLevelGlitch && !spike) return v

    if (prev !== undefined && next !== undefined) return (prev + next) / 2
    return prev ?? next ?? (isUsableElevation(v) ? v : 0)
  })

  // Second pass: only clip impossible cliffs between NEARBY DEM samples.
  // Sparse points (GPX / long ORS segments) can legitimately change >80 m.
  for (let i = 1; i < cleaned.length; i += 1) {
    const spacing = Math.abs(profile[i].distanceMeters - profile[i - 1].distanceMeters)
    if (spacing > 60) continue

    const delta = cleaned[i] - cleaned[i - 1]
    if (Math.abs(delta) <= CYCLING_ELEVATION_MAX_STEP_M) continue
    const prev = cleaned[i - 1]
    const next = i + 1 < cleaned.length ? cleaned[i + 1] : undefined
    if (next !== undefined && Math.abs(next - prev) <= CYCLING_ELEVATION_MAX_STEP_M) {
      cleaned[i] = (prev + next) / 2
    } else {
      cleaned[i] = prev + Math.sign(delta) * CYCLING_ELEVATION_MAX_STEP_M
    }
  }

  return profile.map((p, i) => ({ ...p, elevationMeters: cleaned[i] }))
}

/** Light DEM smooth so stair-step noise does not inflate cycling gain. */
export function smoothElevationProfile(
  profile: ElevationPoint[],
  windowSize = CYCLING_ELEVATION_SMOOTH_WINDOW,
): ElevationPoint[] {
  // Sparse profiles must not be averaged — it flattens real climbs between samples.
  if (profile.length < 20 || windowSize <= 1) return profile

  const spacings: number[] = []
  for (let i = 1; i < profile.length; i += 1) {
    spacings.push(Math.abs(profile[i].distanceMeters - profile[i - 1].distanceMeters))
  }
  spacings.sort((a, b) => a - b)
  const median = spacings[Math.floor(spacings.length / 2)] ?? 0
  // Only smooth dense DEM (≤60 m between samples). Coarse profiles keep raw deltas.
  if (median > 60) return profile

  const half = Math.floor(windowSize / 2)
  const values = profile.map((p) => p.elevationMeters)
  const smoothed = values.map((_, i) => {
    let sum = 0
    let n = 0
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j += 1) {
      sum += values[j]
      n += 1
    }
    return sum / n
  })
  return profile.map((p, i) => ({ ...p, elevationMeters: smoothed[i] }))
}

/**
 * Canonical elevation profile for UI + stats (all bike / ORS cycling profiles).
 */
export function normalizeCyclingElevationProfile(profile: ElevationPoint[]): ElevationPoint[] {
  return sanitizeElevationProfile(profile)
}

/**
 * Cycling elevation gain/loss: cumulative positive/negative change after DEM
 * sanitize + smooth + noise threshold (Strava-like “desnivel positivo”).
 * Profile-agnostic: road / mtb / gravel / urban / ebike share this logic.
 *
 * Algorithm: move an anchor only when |Δ| from the last committed point
 * exceeds the threshold. Small DEM wiggles do not reset a climb in progress
 * (unlike a naïve pending accumulator that zeroes on every micro-descent).
 */
export function computeElevationStats(
  profile: ElevationPoint[],
  thresholdMeters = CYCLING_ELEVATION_THRESHOLD_M,
): {
  gain: number
  loss: number
  highest?: number
  lowest?: number
  significantClimbs: number
} {
  const sanitized = normalizeCyclingElevationProfile(profile)
  const cleaned = smoothElevationProfile(sanitized)
  if (cleaned.length === 0) {
    return { gain: 0, loss: 0, significantClimbs: 0 }
  }

  let highest = sanitized[0].elevationMeters
  let lowest = sanitized[0].elevationMeters
  for (const p of sanitized) {
    highest = Math.max(highest, p.elevationMeters)
    lowest = Math.min(lowest, p.elevationMeters)
  }

  let gain = 0
  let loss = 0
  let significantClimbs = 0
  let climbAccum = 0
  let anchor = cleaned[0].elevationMeters

  for (let i = 1; i < cleaned.length; i += 1) {
    const elev = cleaned[i].elevationMeters
    const delta = elev - anchor

    if (delta >= thresholdMeters) {
      gain += delta
      climbAccum += delta
      anchor = elev
      if (climbAccum >= 50) {
        significantClimbs += 1
        climbAccum = 0
      }
    } else if (delta <= -thresholdMeters) {
      loss += -delta
      anchor = elev
      climbAccum = 0
    }
  }

  return { gain, loss, highest, lowest, significantClimbs }
}

/**
 * Prefer a sane cycling gain: sanitized profile first; use provider ascent only
 * when it agrees roughly (provider DEM glitches can report thousands of meters
 * on any cycling-* profile, not only mountain).
 */
export function resolveCyclingElevationGain(options: {
  profile: ElevationPoint[]
  providerAscent?: number
  providerDescent?: number
  distanceMeters: number
}): {
  gain: number
  loss: number
  highest?: number
  lowest?: number
  significantClimbs: number
  source: 'profile' | 'provider'
} {
  const fromProfile = computeElevationStats(options.profile)
  // ~80 m/km is extreme alpine; typical cycling routes stay well under this.
  const maxPlausible = Math.max(800, options.distanceMeters * 0.08)

  const providerGain =
    typeof options.providerAscent === 'number' ? options.providerAscent : undefined
  const providerLoss =
    typeof options.providerDescent === 'number' ? options.providerDescent : undefined

  const providerSane =
    providerGain !== undefined &&
    providerGain >= 0 &&
    providerGain <= maxPlausible &&
    (providerLoss === undefined || providerLoss <= maxPlausible)

  if (providerSane && providerGain !== undefined) {
    if (
      fromProfile.gain === 0 ||
      Math.abs(providerGain - fromProfile.gain) / Math.max(providerGain, 1) < 0.5
    ) {
      return {
        gain: providerGain,
        loss: providerLoss ?? fromProfile.loss,
        highest: fromProfile.highest,
        lowest: fromProfile.lowest,
        significantClimbs: fromProfile.significantClimbs,
        source: 'provider',
      }
    }
  }

  return { ...fromProfile, source: 'profile' }
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
  providerAscent?: number,
  providerDescent?: number,
): RouteStats {
  // bikeType only affects duration estimate — elevation gain is profile-agnostic.
  const elev = resolveCyclingElevationGain({
    profile,
    providerAscent,
    providerDescent,
    distanceMeters,
  })
  const elevationGainMeters = Math.round(elev.gain)
  const elevationLossMeters = Math.round(elev.loss)
  return {
    distanceMeters: Math.round(distanceMeters),
    elevationGainMeters,
    elevationLossMeters,
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

export function formatDuration(seconds: number, localeMode: 'short' | 'live' = 'short'): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (localeMode === 'live') {
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }
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
