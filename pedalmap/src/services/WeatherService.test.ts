import { describe, expect, it } from 'vitest'
import {
  WeatherService,
  scoreHourSlice,
  type HourlyWeatherPoint,
} from '@/services/WeatherService'
import {
  isMeteoStampUpcoming,
  normalizeMeteoStamp,
  nowWallClockInZone,
} from '@/lib/weatherFormat'
import { meanWindDirectionDeg } from '@/lib/wind'

function hour(
  time: string,
  opts: Partial<HourlyWeatherPoint> = {},
): HourlyWeatherPoint {
  return {
    time,
    temperatureC: opts.temperatureC ?? 20,
    precipitationMm: opts.precipitationMm ?? 0,
    windSpeedKmh: opts.windSpeedKmh ?? 12,
    windDirectionDeg: opts.windDirectionDeg ?? 270,
    windGustsKmh: opts.windGustsKmh ?? (opts.windSpeedKmh ?? 12) + 2,
  }
}

/** Dense daylight series for one day. */
function dayHours(
  day: string,
  from: number,
  to: number,
  factory: (time: string, h: number) => HourlyWeatherPoint,
): HourlyWeatherPoint[] {
  const out: HourlyWeatherPoint[] = []
  for (let h = from; h <= to; h += 1) {
    const time = `${day}T${String(h).padStart(2, '0')}:00`
    out.push(factory(time, h))
  }
  return out
}

describe('weatherFormat upcoming stamps', () => {
  it('normalizes meteo stamps', () => {
    expect(normalizeMeteoStamp('2026-08-11T07:00')).toBe('2026-08-11T07:00')
  })

  it('compares wall clock in Europe/Madrid', () => {
    const now = new Date('2026-08-11T16:22:00+02:00')
    expect(nowWallClockInZone('Europe/Madrid', now)).toBe('2026-08-11T16:22')
    expect(isMeteoStampUpcoming('2026-08-11T10:00', 'Europe/Madrid', now)).toBe(false)
    expect(isMeteoStampUpcoming('2026-08-11T19:00', 'Europe/Madrid', now)).toBe(true)
  })
})

describe('meanWindDirectionDeg', () => {
  it('averages across 0° correctly (not arithmetic mean)', () => {
    // 350° and 10° → ~0°, not 180°.
    const mean = meanWindDirectionDeg([350, 10])
    expect(mean < 20 || mean > 340).toBe(true)
  })
})

describe('WeatherService.buildWindows', () => {
  const svc = new WeatherService()

  it('never recommends a past morning at 16:22', () => {
    const hours = [
      ...dayHours('2026-08-11', 6, 21, (t, h) =>
        hour(t, {
          // Calm excellent morning, rough afternoon — old bug would still pick morning.
          windSpeedKmh: h < 12 ? 6 : 28,
          windDirectionDeg: 270,
          windGustsKmh: h < 12 ? 8 : 40,
        }),
      ),
      ...dayHours('2026-08-12', 6, 12, (t) =>
        hour(t, { windSpeedKmh: 8, windDirectionDeg: 270 }),
      ),
    ]
    const now = new Date('2026-08-11T16:22:00+02:00')
    const windows = svc.buildWindows(hours, 90, {
      timeZone: 'Europe/Madrid',
      now,
    })

    expect(windows.length).toBeGreaterThan(0)
    expect(windows.every((w) => w.startHour >= '2026-08-11T17:00')).toBe(true)
    expect(windows.some((w) => w.startHour.startsWith('2026-08-11T07'))).toBe(false)
    // Best should be actionable — soonest good block or tomorrow morning, not 07–10 today.
    const best = windows[0]
    expect(best.startHour >= '2026-08-11T17:00').toBe(true)
  })

  it('picks the calm 3h block, not a fixed mañana/tarde slot', () => {
    // Midday 11–14 is calm; morning and late afternoon are windy.
    const hours = dayHours('2026-08-12', 6, 21, (t, h) =>
      hour(t, {
        windSpeedKmh: h >= 11 && h <= 13 ? 6 : 30,
        windGustsKmh: h >= 11 && h <= 13 ? 8 : 42,
        windDirectionDeg: 270,
        temperatureC: 22,
      }),
    )
    const now = new Date('2026-08-12T05:00:00+02:00')
    const windows = svc.buildWindows(hours, 90, {
      timeZone: 'Europe/Madrid',
      now,
    })
    const best = windows[0]
    expect(best.startHour).toBe('2026-08-12T11:00')
    expect(best.endHour).toBe('2026-08-12T14:00')
    expect(best.bestHourTime).toBeTruthy()
  })

  it('when scores tie, prefers the sooner window', () => {
    const hours = [
      ...dayHours('2026-08-11', 17, 19, (t) =>
        hour(t, { windSpeedKmh: 10, windDirectionDeg: 270, temperatureC: 22 }),
      ),
      ...dayHours('2026-08-12', 7, 9, (t) =>
        hour(t, { windSpeedKmh: 10, windDirectionDeg: 270, temperatureC: 22 }),
      ),
    ]
    const now = new Date('2026-08-11T16:22:00+02:00')
    const windows = svc.buildWindows(hours, 90, {
      timeZone: 'Europe/Madrid',
      now,
    })
    expect(windows[0].startHour.startsWith('2026-08-11')).toBe(true)
  })

  it('keeps early morning when the day has not started', () => {
    const hours = dayHours('2026-08-11', 6, 12, (t) =>
      hour(t, { windSpeedKmh: 8, windDirectionDeg: 270 }),
    )
    const now = new Date('2026-08-11T05:00:00+02:00')
    const windows = svc.buildWindows(hours, 90, {
      timeZone: 'Europe/Madrid',
      now,
    })
    expect(windows.some((w) => w.startHour === '2026-08-11T06:00' || w.startHour === '2026-08-11T07:00')).toBe(
      true,
    )
  })

  it('scores a slice with vector wind mean and bestHourTime', () => {
    const slice = [
      hour('2026-08-12T11:00', { windSpeedKmh: 8, windDirectionDeg: 260 }),
      hour('2026-08-12T12:00', { windSpeedKmh: 7, windDirectionDeg: 270 }),
      hour('2026-08-12T13:00', { windSpeedKmh: 9, windDirectionDeg: 280 }),
    ]
    // Travel east (90): west wind (~270) is tailwind → good score.
    const advice = scoreHourSlice(slice, 90)
    expect(advice).not.toBeNull()
    expect(advice!.relative).toBe('cola')
    expect(advice!.startHour).toBe('2026-08-12T11:00')
    expect(advice!.endHour).toBe('2026-08-12T14:00')
    expect(advice!.bestHourTime).toBeTruthy()
    expect(advice!.score).toBeGreaterThan(70)
  })
})
