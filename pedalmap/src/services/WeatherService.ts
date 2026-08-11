import type { LatLng, RouteGeometry } from '@/domain/types'
import {
  bearingLabel,
  dominantRouteBearing,
  meanWindDirectionDeg,
  outboundRouteBearing,
  scoreRideWindow,
  windRelativeFactor,
  windRelativeLabel,
} from '@/lib/wind'
import { isMeteoStampUpcoming, normalizeMeteoStamp } from '@/lib/weatherFormat'

export interface HourlyWeatherPoint {
  time: string // ISO local-ish from Open-Meteo
  temperatureC: number
  precipitationMm: number
  windSpeedKmh: number
  windDirectionDeg: number
  windGustsKmh: number
}

export interface RideWindowAdvice {
  startHour: string
  endHour: string
  score: number
  label: 'excelente' | 'buena' | 'aceptable' | 'evitar'
  windSpeedKmh: number
  windDirectionDeg: number
  windDirLabel: string
  relative: 'cara' | 'cola' | 'lateral'
  temperatureC: number
  precipitationMm: number
  notes: string[]
  /** Best single hour inside the window (for map overlay). */
  bestHourTime?: string
}

export interface RouteWeatherForecast {
  latitude: number
  longitude: number
  timezone: string
  routeBearingDeg: number | null
  routeBearingLabel: string | null
  hours: HourlyWeatherPoint[]
  windows: RideWindowAdvice[]
  attribution: string
}

/** Daylight ride hours considered for recommendations. */
const RIDE_HOUR_START = 6
const RIDE_HOUR_END = 21 // inclusive last start hour
/** Prefer ~3 h blocks (typical salida); allow 2 h near end of day. */
const PREFERRED_WINDOW_HOURS = 3
const MIN_WINDOW_HOURS = 2
/** When scores are within this margin, prefer the sooner window. */
const SCORE_TIE_MARGIN = 3

function midpoint(geometry: RouteGeometry): LatLng {
  const coords = geometry.coordinates
  const mid = coords[Math.floor(coords.length / 2)] ?? coords[0]
  return { lng: mid[0], lat: mid[1] }
}

function labelForScore(score: number): RideWindowAdvice['label'] {
  if (score >= 80) return 'excelente'
  if (score >= 65) return 'buena'
  if (score >= 45) return 'aceptable'
  return 'evitar'
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function hourOf(iso: string): number {
  return Number(iso.slice(11, 13))
}

/** Exclusive end stamp one hour after the last included hour start. */
function exclusiveEndStamp(lastHourStart: string): string {
  const day = lastHourStart.slice(0, 10)
  const h = hourOf(lastHourStart) + 1
  if (h >= 24) {
    // Ride windows never cross midnight in our daylight model.
    return `${day}T23:59`
  }
  return `${day}T${String(h).padStart(2, '0')}:00`
}

function overlaps(a: RideWindowAdvice, b: RideWindowAdvice): boolean {
  return (
    normalizeMeteoStamp(a.startHour) < normalizeMeteoStamp(b.endHour) &&
    normalizeMeteoStamp(b.startHour) < normalizeMeteoStamp(a.endHour)
  )
}

export function scoreHourSlice(
  slice: HourlyWeatherPoint[],
  routeBearingDeg: number | null,
): RideWindowAdvice | null {
  if (slice.length < MIN_WINDOW_HOURS) return null

  const hourScores: number[] = []
  let bestHour = slice[0]
  let bestHourScore = -Infinity

  for (const h of slice) {
    const rel =
      routeBearingDeg == null ? 0 : windRelativeFactor(routeBearingDeg, h.windDirectionDeg)
    const s = scoreRideWindow({
      windSpeedKmh: h.windSpeedKmh,
      gustKmh: h.windGustsKmh,
      precipMm: h.precipitationMm,
      tempC: h.temperatureC,
      relativeWind: rel,
    }).score
    hourScores.push(s)
    if (s > bestHourScore) {
      bestHourScore = s
      bestHour = h
    }
  }

  // Window is only as rideable as its weaker hours — averaging alone hid gales.
  const avgScore = hourScores.reduce((a, b) => a + b, 0) / hourScores.length
  const minScore = Math.min(...hourScores)
  const score = Math.round(0.45 * avgScore + 0.55 * minScore)

  const windSpeedKmh = slice.reduce((s, h) => s + h.windSpeedKmh, 0) / slice.length
  const windGustsKmh = slice.reduce((s, h) => s + h.windGustsKmh, 0) / slice.length
  const temperatureC = slice.reduce((s, h) => s + h.temperatureC, 0) / slice.length
  const precipitationMm = slice.reduce((s, h) => s + h.precipitationMm, 0)
  const windDirectionDeg = meanWindDirectionDeg(slice.map((h) => h.windDirectionDeg))
  const relative =
    routeBearingDeg == null ? 0 : windRelativeFactor(routeBearingDeg, windDirectionDeg)

  // Notes from the weakest hour (most actionable warning).
  const worst = slice[hourScores.indexOf(minScore)]
  const worstRel =
    routeBearingDeg == null ? 0 : windRelativeFactor(routeBearingDeg, worst.windDirectionDeg)
  const notes = [
    ...scoreRideWindow({
      windSpeedKmh: worst.windSpeedKmh,
      gustKmh: worst.windGustsKmh,
      precipMm: precipitationMm,
      tempC: worst.temperatureC,
      relativeWind: worstRel,
    }).notes,
  ]
  if (slice.length === 2) notes.push('Tramo corto (~2 h)')

  const startHour = slice[0].time
  const endHour = exclusiveEndStamp(slice[slice.length - 1].time)

  return {
    startHour,
    endHour,
    score: Math.max(0, Math.min(100, score)),
    label: labelForScore(score),
    windSpeedKmh: Math.round(windSpeedKmh),
    windDirectionDeg: Math.round(windDirectionDeg),
    windDirLabel: bearingLabel(windDirectionDeg),
    relative: windRelativeLabel(relative),
    temperatureC: Math.round(temperatureC),
    precipitationMm: Math.round(precipitationMm * 10) / 10,
    notes,
    bestHourTime: bestHour.time,
  }
}

function compareWindows(a: RideWindowAdvice, b: RideWindowAdvice): number {
  const scoreDiff = b.score - a.score
  if (Math.abs(scoreDiff) > SCORE_TIE_MARGIN) return scoreDiff
  // Prefer sooner when nearly tied — more actionable for the rider.
  const byStart = a.startHour.localeCompare(b.startHour)
  if (byStart !== 0) return byStart
  // Prefer longer (~3 h) over short when same start/score.
  return b.endHour.localeCompare(a.endHour)
}

export class WeatherService {
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast'

  async forecastForRoute(
    geometry: RouteGeometry,
    opts?: { forecastDays?: number; signal?: AbortSignal; now?: Date },
  ): Promise<RouteWeatherForecast> {
    const center = midpoint(geometry)
    // Outbound bearing: for circular/ida-vuelta a full-loop average cancels and lies.
    const routeBearingDeg =
      outboundRouteBearing(geometry) ?? dominantRouteBearing(geometry)
    const days = Math.min(16, Math.max(1, opts?.forecastDays ?? 7))

    const url = new URL(this.baseUrl)
    url.searchParams.set('latitude', String(center.lat))
    url.searchParams.set('longitude', String(center.lng))
    url.searchParams.set(
      'hourly',
      [
        'temperature_2m',
        'precipitation',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
      ].join(','),
    )
    url.searchParams.set('forecast_days', String(days))
    url.searchParams.set('timezone', 'auto')
    url.searchParams.set('wind_speed_unit', 'kmh')

    const response = await fetch(url.toString(), { signal: opts?.signal })
    if (!response.ok) {
      throw new Error(`Open-Meteo ${response.status}`)
    }
    const data = (await response.json()) as {
      latitude?: number
      longitude?: number
      timezone?: string
      hourly?: {
        time?: string[]
        temperature_2m?: number[]
        precipitation?: number[]
        wind_speed_10m?: number[]
        wind_direction_10m?: number[]
        wind_gusts_10m?: number[]
      }
    }

    const times = data.hourly?.time ?? []
    const hours: HourlyWeatherPoint[] = times.map((time, i) => ({
      time,
      temperatureC: Number(data.hourly?.temperature_2m?.[i] ?? 0),
      precipitationMm: Number(data.hourly?.precipitation?.[i] ?? 0),
      windSpeedKmh: Number(data.hourly?.wind_speed_10m?.[i] ?? 0),
      windDirectionDeg: Number(data.hourly?.wind_direction_10m?.[i] ?? 0),
      windGustsKmh: Number(data.hourly?.wind_gusts_10m?.[i] ?? 0),
    }))

    const timezone = data.timezone ?? 'UTC'
    const windows = this.buildWindows(hours, routeBearingDeg, {
      timeZone: timezone,
      now: opts?.now ?? new Date(),
    })

    return {
      latitude: data.latitude ?? center.lat,
      longitude: data.longitude ?? center.lng,
      timezone,
      routeBearingDeg,
      routeBearingLabel: routeBearingDeg == null ? null : bearingLabel(routeBearingDeg),
      hours,
      windows,
      attribution: 'Datos: Open-Meteo (CC BY 4.0)',
    }
  }

  /**
   * Build real ride windows from upcoming daylight hours:
   * rolling ~3 h blocks (2 h near dusk), scored with vector-mean wind,
   * past hours excluded, near-ties prefer the sooner start.
   */
  buildWindows(
    hours: HourlyWeatherPoint[],
    routeBearingDeg: number | null,
    opts?: { timeZone?: string; now?: Date; minRemainingMinutes?: number },
  ): RideWindowAdvice[] {
    const timeZone = opts?.timeZone ?? 'UTC'
    const now = opts?.now ?? new Date()
    // Hour must not have started yet (strict) — avoids "best = 07:00" at 16:22.
    const minRemaining = opts?.minRemainingMinutes ?? 0

    const byDay = new Map<string, HourlyWeatherPoint[]>()
    for (const h of hours) {
      const key = dayKey(h.time)
      const list = byDay.get(key) ?? []
      list.push(h)
      byDay.set(key, list)
    }

    const picked: RideWindowAdvice[] = []

    for (const [, dayHoursRaw] of byDay) {
      const upcoming = dayHoursRaw
        .filter((h) => {
          const hr = hourOf(h.time)
          if (hr < RIDE_HOUR_START || hr > RIDE_HOUR_END) return false
          return isMeteoStampUpcoming(h.time, timeZone, now, minRemaining)
        })
        .sort((a, b) => a.time.localeCompare(b.time))

      if (upcoming.length < MIN_WINDOW_HOURS) continue

      const candidates: RideWindowAdvice[] = []
      for (const len of [PREFERRED_WINDOW_HOURS, MIN_WINDOW_HOURS]) {
        if (upcoming.length < len) continue
        for (let i = 0; i + len <= upcoming.length; i += 1) {
          const advice = scoreHourSlice(upcoming.slice(i, i + len), routeBearingDeg)
          if (advice) candidates.push(advice)
        }
      }

      candidates.sort(compareWindows)

      // Keep up to 2 non-overlapping windows per day (e.g. mañana + tarde).
      const dayPicked: RideWindowAdvice[] = []
      for (const c of candidates) {
        if (dayPicked.some((p) => overlaps(p, c))) continue
        // Prefer 3 h: skip a 2 h candidate that sits inside a better 3 h already considered
        // (candidates are sorted; first wins).
        dayPicked.push(c)
        if (dayPicked.length >= 2) break
      }
      picked.push(...dayPicked)
    }

    return picked.sort(compareWindows)
  }
}

export const weatherService = new WeatherService()
