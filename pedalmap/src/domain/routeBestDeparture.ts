import type { RouteWeatherForecast } from '@/services/WeatherService'
import type { RouteGeometry, RouteStats } from '@/domain/types'
import { buildWeatherTimeline, type RouteWeatherTimeline } from '@/domain/routeWeatherTimeline'

export interface DepartureConstraint {
  earliestDeparture?: string // ISO
  latestDeparture?: string // ISO
  maxTemperatureC?: number
  maxPrecipitationMm?: number
  maxWindSpeedKmh?: number
  maxGustKmh?: number
}

export interface DepartureWindow {
  startTime: Date
  endTime: Date
  label: string
  timeline: RouteWeatherTimeline
  score: number
  windScore: number
  temperatureScore: number
  precipitationScore: number
  gustScore: number
  reasons: string[]
  constraintViolations: string[]
  state: 'recommended' | 'alternative' | 'unfavorable' | 'not_viable'
}

export interface BestDepartureResult {
  windows: DepartureWindow[]
  recommended: DepartureWindow | null
  degraded: boolean
  reason?: string
  evaluatedAt: string
}

function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function windScore(kmh: number): number {
  if (kmh <= 10) return 100
  if (kmh <= 15) return 80
  if (kmh <= 20) return 60
  if (kmh <= 25) return 40
  if (kmh <= 30) return 20
  return 0
}

function temperatureScore(c: number): number {
  if (c >= 15 && c <= 22) return 100
  if (c >= 10 && c < 15) return 80
  if (c > 22 && c <= 28) return 80
  if (c >= 5 && c < 10) return 60
  if (c > 28 && c <= 32) return 60
  if (c >= 0 && c < 5) return 40
  if (c > 32) return 20
  return 0
}

function precipitationScore(mm: number): number {
  if (mm === 0) return 100
  if (mm <= 0.5) return 80
  if (mm <= 1) return 60
  if (mm <= 2) return 40
  if (mm <= 5) return 20
  return 0
}

function gustScore(kmh: number): number {
  if (kmh <= 30) return 100
  if (kmh <= 40) return 80
  if (kmh <= 50) return 60
  if (kmh <= 60) return 40
  return 20
}

function aggregateTimelineMetrics(timeline: RouteWeatherTimeline): {
  avgTemp: number
  maxGust: number
  totalPrecip: number
  maxWind: number
  worstRelativeWind: 'cara' | 'lateral' | 'cola'
  windCaraRatio: number
} {
  const points = timeline.points
  if (!points.length) {
    return { avgTemp: 0, maxGust: 0, totalPrecip: 0, maxWind: 0, worstRelativeWind: 'lateral', windCaraRatio: 0 }
  }

  const avgTemp = points.reduce((s, p) => s + p.temperatureC, 0) / points.length
  const maxGust = Math.max(...points.map((p) => p.windGustsKmh))
  const totalPrecip = points.reduce((s, p) => s + p.precipitationMm, 0)
  const maxWind = Math.max(...points.map((p) => p.windSpeedKmh))
  const caraCount = points.filter((p) => p.relativeWind === 'cara').length
  const windCaraRatio = caraCount / points.length

  const windOrder: Array<'cola' | 'lateral' | 'cara'> = ['cola', 'lateral', 'cara']
  const worstRelativeWind = windOrder.reduce((worst, rel) =>
    points.filter((p) => p.relativeWind === rel).length > points.filter((p) => p.relativeWind === worst).length
      ? rel
      : worst,
  'lateral')

  return { avgTemp, maxGust, totalPrecip, maxWind, worstRelativeWind, windCaraRatio }
}

function violatesConstraint(
  window: { startTime: Date; endTime: Date },
  constraint: DepartureConstraint,
): string[] {
  const violations: string[] = []
  const startUtc = Date.UTC(
    window.startTime.getUTCFullYear(),
    window.startTime.getUTCMonth(),
    window.startTime.getUTCDate(),
    window.startTime.getUTCHours(),
    window.startTime.getUTCMinutes(),
    window.startTime.getUTCSeconds(),
  )
  if (constraint.earliestDeparture) {
    const earliest = Date.parse(constraint.earliestDeparture)
    if (!Number.isNaN(earliest) && startUtc < earliest) {
      violations.push('before_earliest')
    }
  }
  if (constraint.latestDeparture) {
    const latest = Date.parse(constraint.latestDeparture)
    if (!Number.isNaN(latest) && startUtc > latest) {
      violations.push('after_latest')
    }
  }
  return violations
}

function windowLabel(start: Date): string {
  return start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function evaluateDepartureWindows(
  geometry: RouteGeometry,
  forecast: RouteWeatherForecast,
  stats: RouteStats,
  constraints: DepartureConstraint = {},
  opts: {
    candidateHours?: number[]
    now?: Date
    maxWindows?: number
  } = {},
): BestDepartureResult {
  const now = opts.now ?? new Date()
  const maxWindows = opts.maxWindows ?? 3

  if (!geometry.coordinates.length) {
    return {
      windows: [],
      recommended: null,
      degraded: true,
      reason: 'no_geometry',
      evaluatedAt: new Date().toISOString(),
    }
  }

  const candidateHours = opts.candidateHours ?? [8, 10, 12]
  const windows: DepartureWindow[] = []

  for (const hour of candidateHours) {
    const startTime = new Date(now)
    startTime.setUTCHours(hour, 0, 0, 0)
    if (startTime <= now) continue

    const endTime = new Date(startTime.getTime() + 3 * 60 * 60_000)
    const timeline = buildWeatherTimeline(geometry, forecast, stats, { startTime })
    const metrics = aggregateTimelineMetrics(timeline)

    const wind = metrics.windCaraRatio > 0.5 ? metrics.maxWind * 1.2 : metrics.maxWind
    const windS = windScore(wind)
    const tempS = temperatureScore(metrics.avgTemp)
    const precipS = precipitationScore(metrics.totalPrecip)
    const gustS = gustScore(metrics.maxGust)

    const constraintViolations = violatesConstraint({ startTime, endTime }, constraints)
    const score = constraintViolations.length > 0 ? 0 : Math.round(windS * 0.35 + tempS * 0.25 + precipS * 0.25 + gustS * 0.15)

    let state: DepartureWindow['state'] = 'alternative'
    if (constraintViolations.length > 0) {
      state = 'not_viable'
    } else if (score >= 75) {
      state = 'recommended'
    } else if (score >= 50) {
      state = 'alternative'
    } else {
      state = 'unfavorable'
    }

    const reasons: string[] = []
    if (metrics.windCaraRatio > 0.5) reasons.push('Viento de cara significativo')
    if (metrics.avgTemp > 28) reasons.push('Temperatura alta')
    if (metrics.avgTemp < 10) reasons.push('Temperatura baja')
    if (metrics.totalPrecip > 1) reasons.push('Lluvia probable')
    if (metrics.maxGust > 40) reasons.push('Rachas fuertes')
    if (state === 'recommended') reasons.push('Buen equilibrio de condiciones')

    windows.push({
      startTime,
      endTime,
      label: windowLabel(startTime),
      timeline,
      score: clampScore(score),
      windScore: clampScore(windS),
      temperatureScore: clampScore(tempS),
      precipitationScore: clampScore(precipS),
      gustScore: clampScore(gustS),
      reasons,
      constraintViolations,
      state,
    })
  }

  windows.sort((a, b) => {
    if (a.state !== b.state) {
      const order: Record<DepartureWindow['state'], number> = {
        recommended: 0,
        alternative: 1,
        unfavorable: 2,
        not_viable: 3,
      }
      return order[a.state] - order[b.state]
    }
    return b.score - a.score
  })

  const recommended = windows.find((w) => w.state === 'recommended') ?? null

  return {
    windows: windows.slice(0, maxWindows),
    recommended,
    degraded: false,
    evaluatedAt: new Date().toISOString(),
  }
}
