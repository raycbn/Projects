import { describe, expect, it } from 'vitest'
import {
  BIKE_MODALITY_PROFILES,
  PROFILE_MIN_SCORE,
  primaryOrsProfile,
  resolveRoutingStrategies,
  scoreSurfaceSuitability,
} from '@/lib/bikeSurfaceProfile'
import type { BikeType } from '@/domain/types'

describe('bikeSurfaceProfile', () => {
  it('uses 90 as soft optimal target for every modality', () => {
    const types: BikeType[] = ['road', 'mtb', 'gravel', 'urban', 'ebike']
    for (const t of types) {
      expect(BIKE_MODALITY_PROFILES[t].acceptScore).toBe(PROFILE_MIN_SCORE)
      expect(PROFILE_MIN_SCORE).toBe(90)
    }
  })

  it('maps primary ORS profiles by modality', () => {
    expect(primaryOrsProfile('road')).toBe('cycling-road')
    expect(primaryOrsProfile('mtb')).toBe('cycling-mountain')
    expect(primaryOrsProfile('ebike')).toBe('cycling-electric')
    expect(primaryOrsProfile('gravel')).toBe('cycling-regular')
    expect(primaryOrsProfile('urban')).toBe('cycling-regular')
  })

  it('rejects road routes that are mostly dirt/track', () => {
    const suit = scoreSurfaceSuitability('road', {
      pavedPercent: 20,
      unpavedPercent: 80,
      surfaces: [
        { type: 'Tierra', distanceMeters: 8000, value: 11 },
        { type: 'Asfalto', distanceMeters: 2000, value: 3 },
      ],
      waytypes: [
        { type: 'Pista', distanceMeters: 7000, percent: 70, value: 5 },
        { type: 'Calle', distanceMeters: 3000, percent: 30, value: 3 },
      ],
    })
    expect(suit.score).toBeLessThan(PROFILE_MIN_SCORE)
    expect(suit.notes[0]).toMatch(/Mejor candidata|óptima/i)
  })

  it('recommends road routes that are nearly all asphalt/street', () => {
    const suit = scoreSurfaceSuitability('road', {
      pavedPercent: 96,
      unpavedPercent: 4,
      surfaces: [
        { type: 'Asfalto', distanceMeters: 9600, value: 3 },
        { type: 'Grava', distanceMeters: 400, value: 10 },
      ],
      waytypes: [
        { type: 'Carretera', distanceMeters: 6000, percent: 60, value: 2 },
        { type: 'Carril bici', distanceMeters: 4000, percent: 40, value: 6 },
      ],
    })
    expect(suit.score).toBeGreaterThanOrEqual(PROFILE_MIN_SCORE)
    expect(suit.label).toBe('excelente')
  })

  it('recommends mtb on dirt/path-heavy routes', () => {
    const suit = scoreSurfaceSuitability('mtb', {
      pavedPercent: 10,
      unpavedPercent: 90,
      surfaces: [
        { type: 'Tierra', distanceMeters: 9000, value: 11 },
        { type: 'Asfalto', distanceMeters: 1000, value: 3 },
      ],
      waytypes: [
        { type: 'Sendero', distanceMeters: 6000, percent: 60, value: 4 },
        { type: 'Pista', distanceMeters: 4000, percent: 40, value: 5 },
      ],
    })
    expect(suit.score).toBeGreaterThanOrEqual(PROFILE_MIN_SCORE)
  })

  it('recommends gravel on mixed compacted/asphalt', () => {
    const suit = scoreSurfaceSuitability('gravel', {
      pavedPercent: 40,
      unpavedPercent: 60,
      surfaces: [
        { type: 'Grava compacta', distanceMeters: 5000, value: 8 },
        { type: 'Asfalto', distanceMeters: 4000, value: 3 },
        { type: 'Grava', distanceMeters: 1000, value: 10 },
      ],
      waytypes: [
        { type: 'Pista', distanceMeters: 5500, percent: 55, value: 5 },
        { type: 'Carretera', distanceMeters: 4500, percent: 45, value: 2 },
      ],
    })
    expect(suit.score).toBeGreaterThanOrEqual(PROFILE_MIN_SCORE)
  })

  it('prefers bike lanes strategy when requested', () => {
    const strategies = resolveRoutingStrategies('urban', ['prefer_bike_lanes'])
    expect(strategies[0]?.profile).toBe('cycling-regular')
    expect(strategies[0]?.weightings.green).toBeGreaterThanOrEqual(0.85)
  })
})
