import { describe, expect, it } from 'vitest'
import { buildFuelUrl, canShowFuelCta } from '@/lib/fuel'

/**
 * Popup blocker handling is implemented in ReadyRoutePage.tsx, not in fuel.ts.
 *
 * Expected flow:
 *  1. window.open('about:blank', '_blank')  // synchronous, inside click handler, WITHOUT noopener
 *  2. if null → popup blocked → abort (no second window.open)
 *  3. fuelWindow.opener = null               // manual opener nullification for security
 *  4. await getIdToken()
 *  5. await mintCustomTokenFromIdToken()
 *  6. buildFuelUrl(context, customToken)
 *  7. fuelWindow.location.href = fuelUrl  // navigate existing tab
 *
 * This ensures the browser sees a synchronous window.open within the user gesture,
 * avoiding popup blockers, while maintaining security via manual opener nullification.
 * If handoff fails, fuelWindow.location.href navigates the already-opened tab to
 * the base URL without token.
 */

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

  it('appends custom token to hash when provided', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120 }, 'custom-token-123')
    expect(url).toContain('#pm_ct=custom-token-123')
    expect(url).not.toContain('custom-token-123?')
    expect(url).not.toContain('custom-token-123&')
  })

  it('does not include custom token in query params', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120 }, 'secret-token')
    const [query] = url.split('#')
    expect(query).not.toContain('secret-token')
    expect(url).toContain('#pm_ct=secret-token')
  })

  it('returns base URL when customToken is empty', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120 }, '')
    expect(url).not.toContain('#pm_ct=')
  })

  it('returns base URL when customToken is undefined', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120 })
    expect(url).not.toContain('#pm_ct=')
  })

  it('fallback without token omits custom token fragment', () => {
    const url = buildFuelUrl({ distanceKm: 50, durationMinutes: 120 })
    expect(url).not.toContain('#pm_ct=')
    expect(url).toBe('https://fuel.pedalmap.es/planner?source=pedalmap&sport=cycling&distanceKm=50&durationMinutes=120')
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
