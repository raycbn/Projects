import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { RouteGeometry, RouteType } from '@/domain/types'
import type { HourlyWeatherPoint, RideWindowAdvice } from '@/services/WeatherService'
import {
  bearingDegrees,
  bearingLabel,
  windRelativeFactor,
  windRelativeLabel,
} from '@/lib/wind'

export type WindLeg = 'ida' | 'vuelta' | 'ruta'

export interface RouteWindOverlayOptions {
  routeType: RouteType
  /** Preferred: selected forecast window. */
  window?: RideWindowAdvice | null
  /** Or a concrete hourly sample. */
  hour?: HourlyWeatherPoint | null
  /** Approx number of arrow samples along the line. */
  sampleCount?: number
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function cumulativeDistances(coords: [number, number][]): number[] {
  const out = [0]
  for (let i = 1; i < coords.length; i += 1) {
    out.push(out[i - 1] + haversineMeters(coords[i - 1], coords[i]))
  }
  return out
}

function pointAtDistance(
  coords: [number, number][],
  cum: number[],
  target: number,
): { position: [number, number]; travelBearing: number; index: number } | null {
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
  const position: [number, number] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  const travelBearing = bearingDegrees(
    { lng: a[0], lat: a[1] },
    { lng: b[0], lat: b[1] },
  )
  return { position, travelBearing, index: i0 }
}

/**
 * Dense polyline following the route between two distances (no chord shortcuts).
 */
function coordsAlongRoute(
  coords: [number, number][],
  cum: number[],
  d0: number,
  d1: number,
): [number, number][] {
  const start = pointAtDistance(coords, cum, d0)
  const end = pointAtDistance(coords, cum, d1)
  if (!start || !end) return []

  const out: [number, number][] = [start.position]
  const fromIdx = start.index + 1
  const toIdx = end.index
  for (let i = fromIdx; i <= toIdx; i += 1) {
    const c = coords[i]
    if (!c) continue
    const prev = out[out.length - 1]
    if (prev[0] === c[0] && prev[1] === c[1]) continue
    // Only include vertices that sit within [d0, d1]
    if (cum[i] >= d0 - 1e-6 && cum[i] <= d1 + 1e-6) out.push(c)
  }
  const last = out[out.length - 1]
  if (!last || last[0] !== end.position[0] || last[1] !== end.position[1]) {
    out.push(end.position)
  }
  return out.length >= 2 ? out : [start.position, end.position]
}

function resolveWind(opts: RouteWindOverlayOptions): {
  windFromDeg: number
  windSpeedKmh: number
  windGustsKmh: number
  timeLabel: string
} | null {
  if (opts.hour) {
    return {
      windFromDeg: opts.hour.windDirectionDeg,
      windSpeedKmh: opts.hour.windSpeedKmh,
      windGustsKmh: opts.hour.windGustsKmh,
      timeLabel: opts.hour.time.slice(11, 16),
    }
  }
  if (opts.window) {
    return {
      windFromDeg: opts.window.windDirectionDeg,
      windSpeedKmh: opts.window.windSpeedKmh,
      windGustsKmh: opts.window.windSpeedKmh,
      timeLabel: `${opts.window.startHour.slice(11, 16)}–${opts.window.endHour.slice(11, 16)}`,
    }
  }
  return null
}

function legForProgress(progress: number, routeType: RouteType): WindLeg {
  if (routeType === 'circular' || routeType === 'out_and_back') {
    return progress < 0.5 ? 'ida' : 'vuelta'
  }
  return 'ruta'
}

function intensityBucket(speedKmh: number): 'flojo' | 'moderado' | 'fuerte' | 'muy_fuerte' {
  if (speedKmh < 12) return 'flojo'
  if (speedKmh < 25) return 'moderado'
  if (speedKmh < 40) return 'fuerte'
  return 'muy_fuerte'
}

/**
 * Build map overlay: colored route segments (follow path) + wind arrows on the line.
 */
export function buildRouteWindOverlay(
  geometry: RouteGeometry,
  opts: RouteWindOverlayOptions,
): FeatureCollection {
  const wind = resolveWind(opts)
  const coords = geometry.coordinates as [number, number][]
  if (!wind || coords.length < 2) {
    return { type: 'FeatureCollection', features: [] }
  }

  const cum = cumulativeDistances(coords)
  const total = cum[cum.length - 1] || 1
  // Dense segments for color; arrows denser + always at relative/color changes.
  const samples = Math.max(20, Math.min(40, opts.sampleCount ?? 28))
  const arrowEvery = Math.max(2, Math.ceil(samples / 12))
  const windToward = (wind.windFromDeg + 180) % 360
  const features: Feature<Point | LineString>[] = []
  let prevRelative: string | null = null

  for (let s = 0; s < samples; s += 1) {
    const d0 = (total * s) / samples
    const d1 = (total * (s + 1)) / samples
    const p0 = pointAtDistance(coords, cum, d0)
    if (!p0) continue

    const midProgress = (s + 0.5) / samples
    const relative = windRelativeFactor(p0.travelBearing, wind.windFromDeg)
    const relativeKind = windRelativeLabel(relative)
    const leg = legForProgress(midProgress, opts.routeType)
    const intensity = intensityBucket(wind.windSpeedKmh)
    const headwindScore = Math.max(0, relative)
    const tailwindScore = Math.max(0, -relative)
    const shared = {
      leg,
      relative: relativeKind,
      relativeFactor: Number(relative.toFixed(3)),
      headwindScore,
      tailwindScore,
      windSpeedKmh: Number(wind.windSpeedKmh.toFixed(1)),
      intensity,
      timeLabel: wind.timeLabel,
    }

    const along = coordsAlongRoute(coords, cum, d0, d1)
    if (along.length >= 2) {
      features.push({
        type: 'Feature',
        properties: {
          kind: 'segment',
          ...shared,
        },
        geometry: {
          type: 'LineString',
          coordinates: along,
        },
      })
    }

    const colorChanged = prevRelative != null && prevRelative !== relativeKind
    const cadenceHit = s % arrowEvery === 0
    prevRelative = relativeKind
    if (!colorChanged && !cadenceHit) continue

    const mid = pointAtDistance(coords, cum, (d0 + d1) / 2)
    if (!mid) continue

    // Arrow sits ON the route (no wind-direction stick that shortcuts the map).
    features.push({
      type: 'Feature',
      properties: {
        kind: 'arrow',
        ...shared,
        windSpeedKmh: Math.round(wind.windSpeedKmh),
        windFromLabel: bearingLabel(wind.windFromDeg),
        windTowardDeg: Number(windToward.toFixed(1)),
        travelBearing: mid.travelBearing,
        label: `${Math.round(wind.windSpeedKmh)} km/h`,
        legLabel: leg === 'ruta' ? '' : leg.toUpperCase(),
        atColorChange: colorChanged,
      },
      geometry: {
        type: 'Point',
        coordinates: mid.position,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}
