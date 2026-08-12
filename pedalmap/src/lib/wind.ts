import type { LatLng, RouteGeometry } from '@/domain/types'

/** Initial bearing from A→B in degrees [0, 360). */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180
  const φ2 = (to.lat * Math.PI) / 180
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Cardinal-ish Spanish label for a wind/route bearing. */
export function bearingLabel(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  const idx = Math.round((((degrees % 360) + 360) % 360) / 45) % 8
  return dirs[idx]
}

/**
 * Sample a representative travel bearing along a LineString by averaging
 * segment bearings weighted by distance (cheap proxy for head/tail wind).
 */
export function dominantRouteBearing(geometry: RouteGeometry): number | null {
  return bearingAlongProgress(geometry, 0, 1)
}

/**
 * Bearing for the outbound portion (first ~45% of distance).
 * More honest for circular / ida-vuelta than a full-loop average (which cancels).
 */
export function outboundRouteBearing(geometry: RouteGeometry): number | null {
  return bearingAlongProgress(geometry, 0, 0.45)
}

function bearingAlongProgress(
  geometry: RouteGeometry,
  fromProgress: number,
  toProgress: number,
): number | null {
  const coords = geometry.coordinates
  if (coords.length < 2) return null

  // Build cumulative distance weights in degree-space (same as before).
  const segWeights: number[] = []
  let total = 0
  for (let i = 0; i + 1 < coords.length; i += 1) {
    const a = { lng: coords[i][0], lat: coords[i][1] }
    const b = { lng: coords[i + 1][0], lat: coords[i + 1][1] }
    const w = Math.hypot(b.lat - a.lat, b.lng - a.lng)
    segWeights.push(w)
    total += w
  }
  if (total <= 0) return null

  const startD = total * Math.max(0, Math.min(1, fromProgress))
  const endD = total * Math.max(0, Math.min(1, toProgress))
  if (endD - startD < 1e-12) return null

  let sinSum = 0
  let cosSum = 0
  let weight = 0
  let acc = 0
  const step = Math.max(1, Math.floor(coords.length / 40))

  for (let i = 0; i + step < coords.length; i += step) {
    const a = { lng: coords[i][0], lat: coords[i][1] }
    const b = { lng: coords[i + step][0], lat: coords[i + step][1] }
    let segW = 0
    for (let k = i; k < i + step && k < segWeights.length; k += 1) segW += segWeights[k]
    const midD = acc + segW / 2
    acc += segW
    if (midD < startD || midD > endD) continue
    const brng = bearingDegrees(a, b)
    if (segW < 1e-9) continue
    const rad = (brng * Math.PI) / 180
    sinSum += Math.sin(rad) * segW
    cosSum += Math.cos(rad) * segW
    weight += segW
  }

  if (weight <= 0) return null
  return ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360
}

/** Circular mean of meteorological wind-from directions (degrees). */
export function meanWindDirectionDeg(degrees: number[]): number {
  if (!degrees.length) return 0
  let sinSum = 0
  let cosSum = 0
  for (const d of degrees) {
    const rad = (d * Math.PI) / 180
    sinSum += Math.sin(rad)
    cosSum += Math.cos(rad)
  }
  return ((Math.atan2(sinSum / degrees.length, cosSum / degrees.length) * 180) / Math.PI + 360) % 360
}

/**
 * Relative wind along travel direction.
 *  +1 = full headwind, -1 = full tailwind, 0 = crosswind.
 */
export function windRelativeFactor(travelBearingDeg: number, windFromDeg: number): number {
  // Meteorological wind direction = where wind comes FROM.
  const windToward = (windFromDeg + 180) % 360
  const diff = ((windToward - travelBearingDeg + 540) % 360) - 180
  // Align wind-toward with travel → tailwind (negative head factor)
  return -Math.cos((diff * Math.PI) / 180)
}

export function windRelativeLabel(factor: number): 'cara' | 'cola' | 'lateral' {
  if (factor >= 0.35) return 'cara'
  if (factor <= -0.35) return 'cola'
  return 'lateral'
}

/** Spanish phrase for the relative label shown on cards (matches the score). */
export function windRelativePhrase(relative: 'cara' | 'cola' | 'lateral'): string {
  switch (relative) {
    case 'cara':
      return 'de cara'
    case 'cola':
      return 'a favor'
    default:
      return 'lateral'
  }
}

export function scoreRideWindow(input: {
  windSpeedKmh: number
  gustKmh: number
  precipMm: number
  tempC: number
  relativeWind: number // +head / -tail
}): { score: number; notes: string[] } {
  const notes: string[] = []
  // Mid baseline so cola bonuses and cara penalties separate without both
  // saturating at 100 (old bug: calm cara ≈ solid cola → "sooner" wins).
  let score = 72

  const relative = windRelativeLabel(input.relativeWind)
  // Along-route component (km/h): +headwind, −tailwind.
  const along = input.relativeWind * input.windSpeedKmh
  const headComponent = Math.max(0, along)
  const tailComponent = Math.max(0, -along)

  // Use label thresholds (cara/cola/lateral) so light factors stay consistent
  // with the card text — never score as cara while labeled lateral.
  if (relative === 'cola') {
    // Sweet spot ~8–18 km/h of useful push; beyond that comfort drops.
    const sweet = Math.min(tailComponent, 18)
    score += Math.min(16, 3 + sweet * 0.7)
    if (tailComponent > 22) {
      score -= Math.min(10, (tailComponent - 22) * 0.55)
    }
    if (input.windSpeedKmh < 8) notes.push('Cola suave')
    else if (tailComponent >= 8) notes.push('Viento a favor')
    else notes.push('Viento de cola')
  } else if (relative === 'cara') {
    score -= Math.min(42, 3 + headComponent * 1.35)
    if (input.windSpeedKmh < 8) notes.push('Cara suave')
    else if (headComponent >= 10) notes.push('Viento de cara relevante')
    else notes.push('Viento de cara')
  } else if (input.windSpeedKmh <= 14) {
    score += 3
    notes.push('Viento flojo')
  } else {
    score -= Math.min(14, (input.windSpeedKmh - 14) * 0.45)
    notes.push('Viento lateral')
  }

  // Absolute gale — milder for cola, but still prefer calm over a gale push.
  if (input.windSpeedKmh >= 45) {
    score -= relative === 'cola' ? 14 : 22
    notes.push('Viento muy fuerte')
  } else if (input.windSpeedKmh >= 36) {
    score -= relative === 'cola' ? 8 : 14
    notes.push('Viento fuerte')
  } else if (input.windSpeedKmh >= 28) {
    score -= relative === 'cola' ? 6 : 12
    if (relative !== 'cola') notes.push('Viento fuerte')
  }

  // Gusts hurt more when they are not pushing along the route.
  if (input.gustKmh > 45) {
    score -= relative === 'cola' ? 10 : 20
    notes.push('Rachas fuertes')
  } else if (input.gustKmh > 32) {
    score -= relative === 'cola' ? 5 : 10
    notes.push('Rachas moderadas')
  }

  if (input.precipMm >= 2) {
    score -= 25
    notes.push('Lluvia prevista')
  } else if (input.precipMm >= 0.2) {
    score -= 10
    notes.push('Chubascos posibles')
  }

  if (input.tempC < 5) {
    score -= 12
    notes.push('Frío')
  } else if (input.tempC > 34) {
    score -= 15
    notes.push('Calor intenso')
  } else if (input.tempC >= 14 && input.tempC <= 26) {
    score += 5
    notes.push('Temperatura agradable')
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), notes }
}
