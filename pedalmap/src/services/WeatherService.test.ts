import { describe, expect, it } from 'vitest'
import { WeatherService, type HourlyWeatherPoint } from '@/services/WeatherService'
import {
  isMeteoStampUpcoming,
  normalizeMeteoStamp,
  nowWallClockInZone,
} from '@/lib/weatherFormat'

function hour(time: string, wind = 12): HourlyWeatherPoint {
  return {
    time,
    temperatureC: 20,
    precipitationMm: 0,
    windSpeedKmh: wind,
    windDirectionDeg: 270,
    windGustsKmh: wind + 2,
  }
}

describe('weatherFormat upcoming stamps', () => {
  it('normalizes meteo stamps', () => {
    expect(normalizeMeteoStamp('2026-08-11T07:00')).toBe('2026-08-11T07:00')
  })

  it('compares wall clock in Europe/Madrid', () => {
    // 16:22 wall clock in Madrid (CEST = UTC+2)
    const now = new Date('2026-08-11T16:22:00+02:00')
    expect(nowWallClockInZone('Europe/Madrid', now)).toBe('2026-08-11T16:22')
    expect(isMeteoStampUpcoming('2026-08-11T10:00', 'Europe/Madrid', now)).toBe(false)
    expect(isMeteoStampUpcoming('2026-08-11T19:00', 'Europe/Madrid', now)).toBe(true)
  })
})

describe('WeatherService.buildWindows', () => {
  const svc = new WeatherService()

  const hours: HourlyWeatherPoint[] = [
    // Today morning + afternoon samples
    hour('2026-08-11T07:00', 8),
    hour('2026-08-11T08:00', 8),
    hour('2026-08-11T09:00', 8),
    hour('2026-08-11T16:00', 14),
    hour('2026-08-11T17:00', 14),
    hour('2026-08-11T18:00', 14),
    // Tomorrow morning (great tailwind-ish)
    hour('2026-08-12T07:00', 6),
    hour('2026-08-12T08:00', 6),
    hour('2026-08-12T09:00', 6),
  ]

  it('drops past morning when it is already afternoon', () => {
    const now = new Date('2026-08-11T16:22:00+02:00')
    const windows = svc.buildWindows(hours, 90, {
      timeZone: 'Europe/Madrid',
      now,
      minRemainingMinutes: 30,
    })
    expect(windows.some((w) => w.startHour === '2026-08-11T07:00')).toBe(false)
    // Afternoon today may still be rideable (ends 19:00).
    expect(windows.some((w) => w.startHour === '2026-08-11T16:00')).toBe(true)
  })

  it('keeps morning when it is still early', () => {
    const now = new Date('2026-08-11T05:00:00+02:00')
    const windows = svc.buildWindows(hours, 90, {
      timeZone: 'Europe/Madrid',
      now,
    })
    expect(windows.some((w) => w.startHour === '2026-08-11T07:00')).toBe(true)
  })
})
