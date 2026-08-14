import { describe, expect, it } from 'vitest'
import { computeActivityStats, estimateInstantPowerWatts } from '@/lib/activityStats'
import type { ActivityTrackPoint } from '@/domain/types'

function pt(
  lat: number,
  lng: number,
  tSec: number,
  elev?: number,
  speed?: number,
): ActivityTrackPoint {
  return {
    position: { lat, lng },
    elevationMeters: elev,
    speedMetersPerSecond: speed,
    recordedAt: new Date(Date.UTC(2026, 7, 10, 10, 0, tSec)).toISOString(),
  }
}

describe('computeActivityStats Free analytics', () => {
  it('computes moving time, speed, elev loss, power estimate and km splits', () => {
    // ~1.1 km northbound with climb then flat (approx 0.01 deg lat ≈ 1.11 km)
    const track: ActivityTrackPoint[] = []
    for (let i = 0; i <= 110; i += 1) {
      const frac = i / 110
      track.push(
        pt(
          40 + frac * 0.01,
          -3.7,
          i * 4, // 4s between points → ~7.4 km/h if moving steadily
          100 + Math.min(frac, 0.5) * 80, // climb first half
          2.5,
        ),
      )
    }

    const startedAt = track[0].recordedAt
    const finishedAt = track[track.length - 1].recordedAt
    const stats = computeActivityStats(track, startedAt, finishedAt)

    expect(stats.distanceMeters).toBeGreaterThan(1000)
    expect(stats.movingTimeSeconds).toBeGreaterThan(60)
    expect(stats.elevationGainMeters).toBeGreaterThan(0)
    expect(stats.elevationLossMeters).toBeGreaterThanOrEqual(0)
    expect(stats.averageSpeedMetersPerSecond).toBeGreaterThan(1)
    expect(stats.maxSpeedMetersPerSecond).toBeGreaterThanOrEqual(2)
    expect(stats.estimatedPowerWatts ?? stats.averagePowerWatts).toBeGreaterThan(0)
    expect(stats.splits?.length).toBeGreaterThanOrEqual(1)
  })

  it('treats long gaps as stopped time', () => {
    const track = [
      pt(40, -3.7, 0, 100, 5),
      pt(40.0002, -3.7, 10, 100, 5),
      // 5 minute pause
      pt(40.0002, -3.7, 310, 100, 0),
      pt(40.0004, -3.7, 320, 100, 5),
    ]
    const stats = computeActivityStats(track, track[0].recordedAt, track[3].recordedAt)
    expect(stats.durationSeconds).toBe(320)
    expect(stats.movingTimeSeconds ?? 0).toBeLessThan(stats.durationSeconds)
  })

  it('leaves HR/cadence undefined when the GPX has no sensors', () => {
    const track = [pt(40, -3.7, 0, 100, 5), pt(40.001, -3.7, 60, 108, 5)]
    const stats = computeActivityStats(track, track[0].recordedAt, track[1].recordedAt)
    expect(stats.averageHeartRateBpm).toBeUndefined()
    expect(stats.averageCadenceRpm).toBeUndefined()
  })
})

describe('estimateInstantPowerWatts', () => {
  it('grows with speed and positive grade', () => {
    const flat = estimateInstantPowerWatts(8, 0)
    const climb = estimateInstantPowerWatts(8, 0.06)
    expect(climb).toBeGreaterThan(flat)
    expect(estimateInstantPowerWatts(0, 0.1)).toBe(0)
  })
})
