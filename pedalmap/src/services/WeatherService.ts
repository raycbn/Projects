import type { LatLng, RouteGeometry } from '@/domain/types'
import {
  bearingLabel,
  dominantRouteBearing,
  scoreRideWindow,
  windRelativeFactor,
  windRelativeLabel,
} from '@/lib/wind'
import { isMeteoStampUpcoming } from '@/lib/weatherFormat'

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

export class WeatherService {
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast'

  async forecastForRoute(
    geometry: RouteGeometry,
    opts?: { forecastDays?: number; signal?: AbortSignal; now?: Date },
  ): Promise<RouteWeatherForecast> {
    const center = midpoint(geometry)
    const routeBearingDeg = dominantRouteBearing(geometry)
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
   * Score morning (7–10) and afternoon (16–19) windows per day.
   * Past windows (already ended in the forecast timezone) are dropped so
   * "best window" never suggests this morning at 16:00.
   */
  buildWindows(
    hours: HourlyWeatherPoint[],
    routeBearingDeg: number | null,
    opts?: { timeZone?: string; now?: Date; minRemainingMinutes?: number },
  ): RideWindowAdvice[] {
    const timeZone = opts?.timeZone ?? 'UTC'
    const now = opts?.now ?? new Date()
    // Keep a window if ≥30 min remain before its end (still rideable).
    const minRemaining = opts?.minRemainingMinutes ?? 30

    const byDay = new Map<string, HourlyWeatherPoint[]>()
    for (const h of hours) {
      const key = dayKey(h.time)
      const list = byDay.get(key) ?? []
      list.push(h)
      byDay.set(key, list)
    }

    const slots: Array<{ start: number; end: number; name: string }> = [
      { start: 7, end: 10, name: 'mañana' },
      { start: 16, end: 19, name: 'tarde' },
    ]

    const out: RideWindowAdvice[] = []
    for (const [day, dayHours] of byDay) {
      for (const slot of slots) {
        const endStamp = `${day}T${String(slot.end).padStart(2, '0')}:00`
        if (!isMeteoStampUpcoming(endStamp, timeZone, now, minRemaining)) {
          continue
        }

        const slice = dayHours.filter((h) => {
          const hour = Number(h.time.slice(11, 13))
          return hour >= slot.start && hour < slot.end
        })
        if (!slice.length) continue

        const avg = (pick: (h: HourlyWeatherPoint) => number) =>
          slice.reduce((s, h) => s + pick(h), 0) / slice.length

        const windSpeedKmh = avg((h) => h.windSpeedKmh)
        const windDirectionDeg = avg((h) => h.windDirectionDeg)
        const windGustsKmh = avg((h) => h.windGustsKmh)
        const temperatureC = avg((h) => h.temperatureC)
        const precipitationMm = slice.reduce((s, h) => s + h.precipitationMm, 0)

        const relative =
          routeBearingDeg == null
            ? 0
            : windRelativeFactor(routeBearingDeg, windDirectionDeg)
        const scored = scoreRideWindow({
          windSpeedKmh,
          gustKmh: windGustsKmh,
          precipMm: precipitationMm,
          tempC: temperatureC,
          relativeWind: relative,
        })

        out.push({
          startHour: `${day}T${String(slot.start).padStart(2, '0')}:00`,
          endHour: endStamp,
          score: scored.score,
          label: labelForScore(scored.score),
          windSpeedKmh: Math.round(windSpeedKmh),
          windDirectionDeg: Math.round(windDirectionDeg),
          windDirLabel: bearingLabel(windDirectionDeg),
          relative: windRelativeLabel(relative),
          temperatureC: Math.round(temperatureC),
          precipitationMm: Math.round(precipitationMm * 10) / 10,
          notes: scored.notes,
        })
      }
    }

    return out.sort((a, b) => b.score - a.score)
  }
}

export const weatherService = new WeatherService()
