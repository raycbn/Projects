import { describe, expect, it } from 'vitest'
import type { RouteGeometry, RouteStats } from '@/domain/types'
import type { RouteWeatherForecast } from '@/services/WeatherService'
import { buildWeatherTimeline } from '@/domain/routeWeatherTimeline'
import { cumulativeDistances } from '@/lib/routeGeometry'

const coords = [
  [-3.7, 40.4],
  [-3.69, 40.41],
  [-3.68, 40.42],
  [-3.67, 40.41],
  [-3.66, 40.4],
] as [number, number][]

const geometry: RouteGeometry = {
  type: 'LineString',
  coordinates: coords,
}

const realDistance = cumulativeDistances(coords.map(([lng, lat]) => ({ lat, lng }))).slice(-1)[0] ?? 0

const stats: RouteStats = {
  distanceMeters: realDistance,
  elevationGainMeters: 100,
  elevationLossMeters: 100,
  estimatedDurationSeconds: 1800,
  difficulty: 'easy',
  surfaceStats: { pavedPercent: 100, unpavedPercent: 0 },
}

function makeForecast(startHour = '2026-08-20T10:00:00Z'): RouteWeatherForecast {
  const base = new Date(startHour)
  const hours = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(base.getTime() + i * 3600_000).toISOString(),
    temperatureC: 18 + (i % 6),
    precipitationMm: i % 5 === 0 ? 1.5 : 0,
    windSpeedKmh: 10 + i,
    windDirectionDeg: 90,
    windGustsKmh: 15 + i,
  }))
  return {
    latitude: 40.4,
    longitude: -3.7,
    timezone: 'UTC',
    routeBearingDeg: 45,
    routeBearingLabel: 'NE',
    hours,
    windows: [],
    attribution: 'Open-Meteo',
  }
}

describe('buildWeatherTimeline', () => {
  it('returns degraded for empty geometry', () => {
    const result = buildWeatherTimeline(
      { type: 'LineString', coordinates: [] },
      makeForecast(),
      stats,
    )
    expect(result.degraded).toBe(true)
    expect(result.reason).toBe('no_geometry')
  })

  it('returns degraded for empty forecast hours', () => {
    const result = buildWeatherTimeline(
      geometry,
      { ...makeForecast(), hours: [] },
      stats,
    )
    expect(result.degraded).toBe(true)
    expect(result.points.length).toBe(0)
  })

  it('samples points along route', () => {
    const result = buildWeatherTimeline(geometry, makeForecast(), stats, { sampleIntervalMeters: 1000 })
    expect(result.points.length).toBeGreaterThan(0)
    expect(result.points[0].distanceAlongRouteMeters).toBe(0)
    expect(result.points[result.points.length - 1].distanceAlongRouteMeters).toBeCloseTo(realDistance, -2)
  })

  it('assigns weather data to each point', () => {
    const result = buildWeatherTimeline(geometry, makeForecast(), stats)
    const withData = result.points.filter((p) => p.temperatureC !== 0 || p.windSpeedKmh !== 0)
    expect(withData.length).toBeGreaterThan(0)
  })

  it('computes relative wind against route bearing', () => {
    const result = buildWeatherTimeline(geometry, makeForecast(), stats)
    const rels = result.points.map((p) => p.relativeWind)
    expect(rels.every((r) => ['cara', 'lateral', 'cola'].includes(r))).toBe(true)
  })

  it('limits samples by interval', () => {
    const result = buildWeatherTimeline(geometry, makeForecast(), stats, { sampleIntervalMeters: 2000 })
    expect(result.points.length).toBeLessThanOrEqual(4)
  })

  it('uses provided startTime', () => {
    const start = '2026-08-20T08:00:00Z'
    const result = buildWeatherTimeline(geometry, makeForecast(start), stats, { startTime: new Date(start) })
    const first = result.points[0]
    expect(first.timestamp).toContain('2026-08-20T08:')
  })
})
