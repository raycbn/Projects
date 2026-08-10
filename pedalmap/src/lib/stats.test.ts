import { describe, expect, it } from 'vitest'
import {
  buildStatsFromProfile,
  computeElevationStats,
  CYCLING_ELEVATION_THRESHOLD_M,
  estimateDifficulty,
  normalizeCyclingElevationProfile,
  resolveCyclingElevationGain,
  sanitizeElevationProfile,
  smoothElevationProfile,
} from '@/lib/stats'
import type { BikeType, ElevationPoint } from '@/domain/types'

/** Shared DEM glitch fixture — same artifact ORS can emit on any cycling-* profile. */
function demGlitchProfile(): ElevationPoint[] {
  return [
    { distanceMeters: 0, elevationMeters: 600 },
    { distanceMeters: 100, elevationMeters: 0 }, // sea-level glitch
    { distanceMeters: 200, elevationMeters: 610 },
    { distanceMeters: 300, elevationMeters: Number.NaN }, // missing Z
    { distanceMeters: 400, elevationMeters: 605 },
    { distanceMeters: 500, elevationMeters: 900 }, // spike
    { distanceMeters: 600, elevationMeters: 600 },
    { distanceMeters: 5000, elevationMeters: 580 },
    { distanceMeters: 10000, elevationMeters: 640 },
    { distanceMeters: 20000, elevationMeters: 520 },
  ]
}

const ALL_BIKE_TYPES: BikeType[] = ['road', 'mtb', 'gravel', 'urban', 'ebike']

describe('stats', () => {
  it('uses DEM-like threshold for cycling elevation gain', () => {
    expect(CYCLING_ELEVATION_THRESHOLD_M).toBe(10)
  })

  it('sanitizes isolated zero elevations that break cycling gain', () => {
    const cleaned = sanitizeElevationProfile([
      { distanceMeters: 0, elevationMeters: 600 },
      { distanceMeters: 100, elevationMeters: 0 },
      { distanceMeters: 200, elevationMeters: 610 },
    ])
    expect(cleaned[1].elevationMeters).toBe(605)
  })

  it('sanitizes missing Z and DEM spikes for every profile source', () => {
    const cleaned = normalizeCyclingElevationProfile(demGlitchProfile())
    expect(cleaned.every((p) => Number.isFinite(p.elevationMeters))).toBe(true)
    expect(cleaned[1].elevationMeters).toBeGreaterThan(400)
    expect(cleaned[3].elevationMeters).toBeGreaterThan(400)
    expect(cleaned[5].elevationMeters).toBeLessThan(750)
    expect(Math.min(...cleaned.map((p) => p.elevationMeters))).toBeGreaterThan(400)
  })

  it('smooths DEM stair-steps without inventing altitude', () => {
    const dense = Array.from({ length: 40 }, (_, i) => ({
      distanceMeters: i * 30, // dense 30 m samples (route elevation_interval)
      elevationMeters: i === 20 ? 130 : 100,
    }))
    const smoothed = smoothElevationProfile(dense, 5)
    expect(smoothed[20].elevationMeters).toBeGreaterThan(100)
    expect(smoothed[20].elevationMeters).toBeLessThan(130)
  })

  it('does not smooth sparse elevation profiles (would erase real climbs)', () => {
    const sparse = Array.from({ length: 30 }, (_, i) => ({
      distanceMeters: i * 250,
      elevationMeters: 100 + (i % 2 === 0 ? 0 : 40),
    }))
    const smoothed = smoothElevationProfile(sparse, 5)
    expect(smoothed[1].elevationMeters).toBe(140)
    expect(smoothed[2].elevationMeters).toBe(100)
  })

  it('computes cycling elevation gain with DEM threshold (desnivel positivo)', () => {
    const stats = computeElevationStats([
      { distanceMeters: 0, elevationMeters: 100 },
      { distanceMeters: 100, elevationMeters: 105 }, // noise < 10m
      { distanceMeters: 200, elevationMeters: 100 },
      { distanceMeters: 1000, elevationMeters: 200 },
      { distanceMeters: 2000, elevationMeters: 150 },
    ])
    expect(stats.gain).toBeGreaterThanOrEqual(90)
    expect(stats.loss).toBeGreaterThanOrEqual(40)
    expect(stats.lowest).toBe(100)
  })

  it('rejects absurd provider ascent in favour of sanitized profile', () => {
    const resolved = resolveCyclingElevationGain({
      distanceMeters: 25000,
      providerAscent: 5359,
      providerDescent: 5493,
      profile: demGlitchProfile(),
    })
    expect(resolved.source).toBe('profile')
    expect(resolved.gain).toBeLessThan(800)
    expect(resolved.lowest).toBeGreaterThan(400)
  })

  it('applies the same desnivel positivo pipeline to ALL bike profiles in parallel', () => {
    const profile = demGlitchProfile()
    const gains = ALL_BIKE_TYPES.map((bikeType) => {
      const stats = buildStatsFromProfile(25000, profile, bikeType, undefined, 5359, 5493)
      return { bikeType, gain: stats.elevationGainMeters, min: stats.lowestPointMeters }
    })

    for (const row of gains) {
      expect(row.gain, row.bikeType).toBeLessThan(800)
      expect(row.gain, row.bikeType).toBeGreaterThan(0)
      expect(row.min, row.bikeType).toBeGreaterThan(400)
    }

    // Elevation gain must be identical across bike types (only duration differs).
    const uniqueGains = new Set(gains.map((g) => g.gain))
    expect(uniqueGains.size).toBe(1)
  })

  it('builds elevation stats and difficulty', () => {
    const profile = [
      { distanceMeters: 0, elevationMeters: 100 },
      { distanceMeters: 1000, elevationMeters: 200 },
      { distanceMeters: 2000, elevationMeters: 150 },
      { distanceMeters: 50000, elevationMeters: 400 },
    ]
    const stats = buildStatsFromProfile(50000, profile, 'road')
    expect(stats.elevationGainMeters).toBeGreaterThan(0)
    expect(stats.elevationLossMeters).toBeGreaterThan(0)
    expect(stats.difficulty).toBe(estimateDifficulty(50000, stats.elevationGainMeters))
  })
})
