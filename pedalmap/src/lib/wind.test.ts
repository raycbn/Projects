import { describe, expect, it } from 'vitest'
import {
  bearingDegrees,
  bearingLabel,
  windRelativeFactor,
  windRelativeLabel,
  scoreRideWindow,
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
})
