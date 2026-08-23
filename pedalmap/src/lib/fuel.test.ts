import { describe, expect, it } from 'vitest'
import { buildFuelUrl, canShowFuelCta } from '@/lib/fuel'

describe('buildFuelUrl', () => {
  it('builds a valid Fuel URL with required params', () => {
    const url = buildFuelUrl({ distanceKm: 58.4, durationMinutes: 167, elevationGainM: 620 })
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('source')).toBe('pedalmap')
    expect(params.get('sport')).toBe('cycling')
    expect(params.get('distanceKm')).toBe('58.4')
    expect(params.get('elevationGainM')).toBe('620')
    expect(params.get('durationMinutes')).toBe('167')
  })

  it('includes temperatureC when valid', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120, temperatureC: 26 })
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('temperatureC')).toBe('26')
  })

  it('omits temperatureC when invalid', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120, temperatureC: NaN })
    expect(url).not.toContain('temperatureC')
  })

  it('omits elevationGainM when invalid', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120, elevationGainM: -5 })
    expect(url).not.toContain('elevationGainM')
  })

  it('includes intensity and goal when valid', () => {
    const url = buildFuelUrl({
      distanceKm: 50,
      durationMinutes: 120,
      intensity: 'endurance',
      goal: 'fuel',
    })
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('intensity')).toBe('endurance')
    expect(params.get('goal')).toBe('fuel')
  })

  it('omits intensity and goal when empty strings', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120, intensity: '  ', goal: '' })
    expect(url).not.toContain('intensity')
    expect(url).not.toContain('goal')
  })

  it('throws when distanceKm is invalid', () => {
    expect(() => buildFuelUrl({ distanceKm: NaN, durationMinutes: 120 })).toThrow('distanceKm')
  })

  it('throws when durationMinutes is invalid', () => {
    expect(() => buildFuelUrl({ distanceKm: 50, durationMinutes: 0 })).toThrow('durationMinutes')
  })

  it('always sets source=pedalmap and sport=cycling', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120 })
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('source')).toBe('pedalmap')
    expect(params.get('sport')).toBe('cycling')
  })
})

describe('canShowFuelCta', () => {
  it('returns true when distance and duration are valid', () => {
    expect(canShowFuelCta({ distanceKm: 50, durationMinutes: 120 })).toBe(true)
  })

  it('returns false when distanceKm is missing', () => {
    expect(canShowFuelCta({ durationMinutes: 120 })).toBe(false)
  })

  it('returns false when durationMinutes is missing', () => {
    expect(canShowFuelCta({ distanceKm: 50 })).toBe(false)
  })

  it('returns false when distanceKm is negative', () => {
    expect(canShowFuelCta({ distanceKm: -1, durationMinutes: 120 })).toBe(false)
  })

  it('returns false when durationMinutes is zero', () => {
    expect(canShowFuelCta({ distanceKm: 50, durationMinutes: 0 })).toBe(false)
  })
})
