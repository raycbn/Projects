import { describe, expect, it } from 'vitest'
import {
  buildStatsFromProfile,
  estimateDifficulty,
  formatDistance,
  formatDuration,
  haversineMeters,
  pathDistanceMeters,
} from '@/lib/stats'

describe('stats', () => {
  it('computes haversine distance between close points', () => {
    const d = haversineMeters(
      { lat: 40.4168, lng: -3.7038 },
      { lat: 40.4178, lng: -3.7038 },
    )
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(130)
  })

  it('sums path distance', () => {
    const total = pathDistanceMeters([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.01 },
      { lat: 0, lng: 0.02 },
    ])
    expect(total).toBeGreaterThan(2000)
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

  it('formats distance and duration for es-ES', () => {
    expect(formatDistance(62400)).toContain('62')
    expect(formatDuration(2 * 3600 + 48 * 60)).toBe('2 h 48 min')
  })
})
