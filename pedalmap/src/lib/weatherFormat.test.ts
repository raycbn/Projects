import { describe, expect, it } from 'vitest'
import {
  formatWeatherDay,
  formatWeatherHour,
  formatWeatherHourRange,
  formatWeatherWindowCaption,
  meteoDayKey,
  parseMeteoLocal,
  isMeteoStampUpcoming,
} from '@/lib/weatherFormat'

describe('weatherFormat', () => {
  it('parses Open-Meteo local times without shifting the calendar day', () => {
    const d = parseMeteoLocal('2026-08-10T07:00')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(10)
    expect(d.getHours()).toBe(7)
  })

  it('formats day and hour range in Spanish', () => {
    expect(formatWeatherHour('2026-08-10T07:00')).toBe('07:00')
    expect(formatWeatherHourRange('2026-08-10T07:00', '2026-08-10T10:00')).toBe('07:00–10:00')
    expect(formatWeatherDay('2026-08-10T07:00')).toMatch(/10/)
    expect(formatWeatherWindowCaption('2026-08-10T07:00', '2026-08-10T10:00')).toMatch(/07:00–10:00/)
  })

  it('extracts day keys from meteo timestamps', () => {
    expect(meteoDayKey('2026-08-10T07:00')).toBe('2026-08-10')
    expect(meteoDayKey('2026-08-11')).toBe('2026-08-11')
  })

  it('detects past vs upcoming meteo stamps in a zone', () => {
    const now = new Date('2026-08-11T16:22:00+02:00')
    expect(isMeteoStampUpcoming('2026-08-11T07:00', 'Europe/Madrid', now)).toBe(false)
    expect(isMeteoStampUpcoming('2026-08-11T19:00', 'Europe/Madrid', now)).toBe(true)
  })
})
