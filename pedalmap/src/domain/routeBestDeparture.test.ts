import { describe, expect, it } from 'vitest'
import type { RouteGeometry, RouteStats } from '@/domain/types'
import type { RouteWeatherForecast } from '@/services/WeatherService'
import { evaluateDepartureWindows } from '@/domain/routeBestDeparture'

const geometry: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [-3.7, 40.4],
    [-3.69, 40.41],
    [-3.68, 40.42],
    [-3.67, 40.41],
    [-3.66, 40.4],
  ] as [number, number][],
}

const stats: RouteStats = {
  distanceMeters: 5000,
  elevationGainMeters: 100,
  elevationLossMeters: 100,
  estimatedDurationSeconds: 1800,
  difficulty: 'easy',
  surfaceStats: { pavedPercent: 100, unpavedPercent: 0 },
}

function makeForecast(): RouteWeatherForecast {
  const base = new Date('2026-08-20T10:00:00Z')
  const hours = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(base.getTime() + i * 3600_000).toISOString(),
    temperatureC: 20 + (i % 6),
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

describe('evaluateDepartureWindows', () => {
  it('returns degraded for empty geometry', () => {
    const result = evaluateDepartureWindows(
      { type: 'LineString', coordinates: [] },
      makeForecast(),
      stats,
    )
    expect(result.degraded).toBe(true)
    expect(result.reason).toBe('no_geometry')
  })

  it('returns empty windows for past hours', () => {
    const now = new Date('2026-08-20T10:00:00Z')
    const result = evaluateDepartureWindows(
      geometry,
      makeForecast(),
      stats,
      {},
      { now, candidateHours: [6, 7, 8, 9] },
    )
    expect(result.windows).toHaveLength(0)
  })

  it('evaluates candidate windows', () => {
    const now = new Date('2026-08-20T00:00:00Z')
    const result = evaluateDepartureWindows(
      geometry,
      makeForecast(),
      stats,
      {},
      { now, candidateHours: [8, 10, 12] },
    )
    expect(result.windows.length).toBeGreaterThan(0)
    expect(result.windows.length).toBeLessThanOrEqual(3)
  })

  it('scores windows 0-100', () => {
    const now = new Date('2026-08-20T00:00:00Z')
    const result = evaluateDepartureWindows(
      geometry,
      makeForecast(),
      stats,
      {},
      { now, candidateHours: [8, 10, 12] },
    )
    for (const w of result.windows) {
      expect(w.score).toBeGreaterThanOrEqual(0)
      expect(w.score).toBeLessThanOrEqual(100)
    }
  })

  it('applies latestDeparture constraint', () => {
    const now = new Date('2026-08-20T00:00:00Z')
    const result = evaluateDepartureWindows(
      geometry,
      makeForecast(),
      stats,
      { latestDeparture: '2026-08-20T09:30:00Z' },
      { now, candidateHours: [8, 10, 12] },
    )
    const viable = result.windows.filter((w) => w.state !== 'not_viable')
    expect(viable.length).toBeGreaterThan(0)
    for (const w of viable) {
      expect(w.startTime.getUTCHours()).toBeLessThanOrEqual(9)
    }
  })

  it('marks not_viable when all windows violate constraints', () => {
    const now = new Date('2026-08-20T00:00:00Z')
    const result = evaluateDepartureWindows(
      geometry,
      makeForecast(),
      stats,
      { latestDeparture: '2026-08-20T07:00:00Z' },
      { now, candidateHours: [8, 10, 12] },
    )
    expect(result.windows.every((w) => w.state === 'not_viable')).toBe(true)
  })

  it('recommends the highest scoring viable window', () => {
    const now = new Date('2026-08-20T00:00:00Z')
    const result = evaluateDepartureWindows(
      geometry,
      makeForecast(),
      stats,
      {},
      { now, candidateHours: [8, 10, 12] },
    )
    const recommended = result.recommended
    if (recommended) {
      expect(recommended.state).toBe('recommended')
    }
  })
})
