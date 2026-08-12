import { describe, expect, it } from 'vitest'
import {
  bearingDegrees,
  bearingLabel,
  windRelativeFactor,
  windRelativeLabel,
  scoreRideWindow,
  meanWindDirectionDeg,
} from '@/lib/wind'

describe('wind helpers', () => {
  it('computes northbound bearing', () => {
    const b = bearingDegrees({ lat: 40, lng: -3 }, { lat: 41, lng: -3 })
    expect(b === 0 || b > 350 || b < 10).toBe(true)
  })

  it('labels bearings', () => {
    expect(bearingLabel(0)).toBe('N')
    expect(bearingLabel(90)).toBe('E')
  })

  it('detects headwind vs tailwind', () => {
    // Travel east (90), wind from east (90) → headwind
    expect(windRelativeFactor(90, 90)).toBeGreaterThan(0.9)
    expect(windRelativeLabel(windRelativeFactor(90, 90))).toBe('cara')
    // Travel east, wind from west (270) → tailwind
    expect(windRelativeFactor(90, 270)).toBeLessThan(-0.9)
    expect(windRelativeLabel(windRelativeFactor(90, 270))).toBe('cola')
  })

  it('scores rainy headwind poorly', () => {
    const bad = scoreRideWindow({
      windSpeedKmh: 30,
      gustKmh: 50,
      precipMm: 4,
      tempC: 12,
      relativeWind: 1,
    })
    const good = scoreRideWindow({
      windSpeedKmh: 10,
      gustKmh: 12,
      precipMm: 0,
      tempC: 18,
      relativeWind: -0.8,
    })
    expect(bad.score).toBeLessThan(55)
    expect(good.score).toBeGreaterThan(80)
  })

  it('prefers useful tailwind over calm headwind', () => {
    const calmCara = scoreRideWindow({
      windSpeedKmh: 8,
      gustKmh: 10,
      precipMm: 0,
      tempC: 18,
      relativeWind: 0.95,
    })
    const solidCola = scoreRideWindow({
      windSpeedKmh: 22,
      gustKmh: 28,
      precipMm: 0,
      tempC: 24,
      relativeWind: -0.95,
    })
    expect(solidCola.score).toBeGreaterThan(calmCara.score)
    expect(solidCola.score - calmCara.score).toBeGreaterThan(8)
    expect(solidCola.notes.some((n) => /favor|cola/i.test(n))).toBe(true)
    expect(calmCara.notes.some((n) => /cara/i.test(n))).toBe(true)
  })

  it('still rewards moderate cola when absolute wind is 25–32 km/h', () => {
    const cola = scoreRideWindow({
      windSpeedKmh: 30,
      gustKmh: 36,
      precipMm: 0,
      tempC: 20,
      relativeWind: -1,
    })
    const cara = scoreRideWindow({
      windSpeedKmh: 12,
      gustKmh: 16,
      precipMm: 0,
      tempC: 20,
      relativeWind: 1,
    })
    expect(cola.score).toBeGreaterThan(cara.score)
  })

  it('notes match light tailwind (never "lateral" when factor is cola)', () => {
    const lightCola = scoreRideWindow({
      windSpeedKmh: 2,
      gustKmh: 4,
      precipMm: 0,
      tempC: 25,
      relativeWind: -0.9,
    })
    expect(windRelativeLabel(-0.9)).toBe('cola')
    expect(lightCola.notes.some((n) => /cola|favor/i.test(n))).toBe(true)
    expect(lightCola.notes.some((n) => /lateral/i.test(n))).toBe(false)

    const lightCross = scoreRideWindow({
      windSpeedKmh: 4,
      gustKmh: 5,
      precipMm: 0,
      tempC: 22,
      relativeWind: 0.1,
    })
    expect(lightCross.notes).toContain('Viento flojo')
  })

  it('means wind directions across north correctly', () => {
    const mean = meanWindDirectionDeg([350, 10])
    expect(mean < 15 || mean > 345).toBe(true)
  })
})
