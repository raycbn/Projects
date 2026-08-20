import type { HourlyWeatherPoint, RouteWeatherForecast } from '@/services/WeatherService'
import type { RouteGeometry, RouteStats } from '@/domain/types'
import { estimatedArrivalMinutes, sampleRoutePoints } from '@/lib/routeGeometry'

export interface RouteWeatherPoint {
  timestamp: string
  distanceAlongRouteMeters: number
  estimatedArrivalMinutes: number
  temperatureC: number
  precipitationMm: number
  windSpeedKmh: number
  windDirectionDeg: number
  windGustsKmh: number
  relativeWind: 'cara' | 'lateral' | 'cola'
  source: 'open-meteo'
  forecastIssuedAt: string
}

export interface RouteWeatherTimeline {
  points: RouteWeatherPoint[]
  degraded: boolean
  reason?: string
  provider: string
  forecastIssuedAt: string
  hours?: Array<{
    time: string
    temperatureC: number
    precipitationMm: number
    windSpeedKmh: number
    windDirectionDeg: number
    windGustsKmh: number
  }>
}

export interface BuildWeatherTimelineOptions {
  startTime?: Date
  sampleIntervalMeters?: number
}

const DEFAULT_SAMPLE_INTERVAL_METERS = 5000

function windRelative(routeBearingDeg: number | null, windDirectionDeg: number): 'cara' | 'lateral' | 'cola' {
  if (routeBearingDeg == null) return 'lateral'
  const rel = ((windDirectionDeg - routeBearingDeg + 540) % 360) - 180
  const abs = Math.abs(rel)
  if (abs <= 45) return 'cara'
  if (abs >= 135) return 'cola'
  return 'lateral'
}

function closestHour(
  hours: HourlyWeatherPoint[],
  target: Date,
): HourlyWeatherPoint | null {
  if (!hours.length) return null
  let best = hours[0]
  let bestDiff = Math.abs(new Date(best.time).getTime() - target.getTime())
  for (let i = 1; i < hours.length; i += 1) {
    const diff = Math.abs(new Date(hours[i].time).getTime() - target.getTime())
    if (diff < bestDiff) {
      bestDiff = diff
      best = hours[i]
    }
  }
  return best
}

export function buildWeatherTimeline(
  geometry: RouteGeometry,
  forecast: RouteWeatherForecast,
  stats: RouteStats,
  opts: BuildWeatherTimelineOptions = {},
): RouteWeatherTimeline {
  const startTime = opts.startTime ?? new Date()
  const interval = opts.sampleIntervalMeters ?? DEFAULT_SAMPLE_INTERVAL_METERS
  const coords = geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))

  const samples = sampleRoutePoints(coords, interval)
  if (!samples.length) {
    return {
      points: [],
      degraded: true,
      reason: 'no_geometry',
      provider: forecast.attribution || 'Open-Meteo',
      forecastIssuedAt: new Date().toISOString(),
      hours: forecast.hours,
    }
  }

  if (!forecast.hours.length) {
    return {
      points: [],
      degraded: true,
      reason: 'no_forecast',
      provider: forecast.attribution || 'Open-Meteo',
      forecastIssuedAt: new Date().toISOString(),
      hours: forecast.hours,
    }
  }

  const points: RouteWeatherPoint[] = samples.map((sample) => {
    const arrival = new Date(startTime.getTime() + estimatedArrivalMinutes(sample.distanceMeters, stats.distanceMeters, stats.estimatedDurationSeconds) * 60_000)
    const hour = closestHour(forecast.hours, arrival)
    if (!hour) {
      return {
        timestamp: arrival.toISOString(),
        distanceAlongRouteMeters: Math.round(sample.distanceMeters),
        estimatedArrivalMinutes: estimatedArrivalMinutes(sample.distanceMeters, stats.distanceMeters, stats.estimatedDurationSeconds),
        temperatureC: 0,
        precipitationMm: 0,
        windSpeedKmh: 0,
        windDirectionDeg: 0,
        windGustsKmh: 0,
        relativeWind: 'lateral',
        source: 'open-meteo',
        forecastIssuedAt: new Date().toISOString(),
      }
    }
    return {
      timestamp: hour.time,
      distanceAlongRouteMeters: Math.round(sample.distanceMeters),
      estimatedArrivalMinutes: estimatedArrivalMinutes(sample.distanceMeters, stats.distanceMeters, stats.estimatedDurationSeconds),
      temperatureC: hour.temperatureC,
      precipitationMm: hour.precipitationMm,
      windSpeedKmh: hour.windSpeedKmh,
      windDirectionDeg: hour.windDirectionDeg,
      windGustsKmh: hour.windGustsKmh,
      relativeWind: windRelative(forecast.routeBearingDeg, hour.windDirectionDeg),
      source: 'open-meteo',
      forecastIssuedAt: new Date().toISOString(),
    }
  })

  return {
    points,
    degraded: false,
    provider: forecast.attribution || 'Open-Meteo',
    forecastIssuedAt: new Date().toISOString(),
    hours: forecast.hours,
  }
}
