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
 * Build map overlay: short colored line segments + arrow points for a chosen hour/window.
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
  const samples = Math.max(12, Math.min(36, opts.sampleCount ?? 24))
  const windToward = (wind.windFromDeg + 180) % 360
  const features: Feature<Point | LineString>[] = []

  for (let s = 0; s < samples; s += 1) {
    const d0 = (total * s) / samples
    const d1 = (total * (s + 1)) / samples
    const p0 = pointAtDistance(coords, cum, d0)
    const p1 = pointAtDistance(coords, cum, d1)
    if (!p0 || !p1) continue

    const midProgress = (s + 0.5) / samples
    const relative = windRelativeFactor(p0.travelBearing, wind.windFromDeg)
    const relativeKind = windRelativeLabel(relative)
    const leg = legForProgress(midProgress, opts.routeType)
    const intensity = intensityBucket(wind.windSpeedKmh)
    const headwindScore = Math.max(0, relative)
    const tailwindScore = Math.max(0, -relative)

    features.push({
      type: 'Feature',
      properties: {
        kind: 'segment',
        leg,
        relative: relativeKind,
        relativeFactor: Number(relative.toFixed(3)),
        headwindScore,
        tailwindScore,
        windSpeedKmh: Number(wind.windSpeedKmh.toFixed(1)),
        intensity,
        timeLabel: wind.timeLabel,
      },
      geometry: {
        type: 'LineString',
        coordinates: [p0.position, p1.position],
      },
    })

    const mid = pointAtDistance(coords, cum, (d0 + d1) / 2)
    if (!mid) continue
    features.push({
      type: 'Feature',
      properties: {
        kind: 'arrow',
        leg,
        relative: relativeKind,
        relativeFactor: Number(relative.toFixed(3)),
        headwindScore,
        windSpeedKmh: Math.round(wind.windSpeedKmh),
        windFromLabel: bearingLabel(wind.windFromDeg),
        windTowardDeg: Number(windToward.toFixed(1)),
        travelBearing: mid.travelBearing,
        intensity,
        timeLabel: wind.timeLabel,
        label: `${wind.timeLabel} · ${Math.round(wind.windSpeedKmh)}km/h ${relativeKind}`,
        legLabel: leg === 'ruta' ? '' : leg.toUpperCase(),
      },
      geometry: {
        type: 'Point',
        coordinates: mid.position,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}
