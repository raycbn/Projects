import { describe, expect, it } from 'vitest'
import {
  buildStatsFromProfile,
  computeElevationStats,
  CYCLING_ELEVATION_THRESHOLD_M,
  estimateDifficulty,
  resolveCyclingElevationGain,
  sanitizeElevationProfile,
  smoothElevationProfile,
} from '@/lib/stats'

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

  it('smooths DEM stair-steps without inventing altitude', () => {
    const dense = Array.from({ length: 25 }, (_, i) => ({
      distanceMeters: i * 100,
      elevationMeters: i === 12 ? 130 : 100,
    }))
    const smoothed = smoothElevationProfile(dense, 5)
    expect(smoothed[12].elevationMeters).toBeGreaterThan(100)
    expect(smoothed[12].elevationMeters).toBeLessThan(130)
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
      profile: [
        { distanceMeters: 0, elevationMeters: 600 },
        { distanceMeters: 100, elevationMeters: 0 },
        { distanceMeters: 200, elevationMeters: 610 },
        { distanceMeters: 5000, elevationMeters: 580 },
        { distanceMeters: 10000, elevationMeters: 640 },
        { distanceMeters: 20000, elevationMeters: 520 },
      ],
    })
    expect(resolved.source).toBe('profile')
    expect(resolved.gain).toBeLessThan(800)
    expect(resolved.lowest).toBeGreaterThan(400)
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
