import { describe, expect, it } from 'vitest'
import { evaluateMilestones, sumWeekStats, sumYearStats } from '@/lib/athleteStats'
import type { Activity, SavedRoute } from '@/domain/types'

function act(partial: Partial<Activity> & Pick<Activity, 'id' | 'startedAt' | 'stats'>): Activity {
  return {
    userId: 'u1',
    title: 'Salida',
    bikeType: 'road',
    status: 'finished',
    track: [],
    endedAt: partial.startedAt,
    ...partial,
  } as Activity
}

describe('athleteStats', () => {
  it('sums year distance for finished rides', () => {
    const year = new Date().getFullYear()
    const activities = [
      act({
        id: '1',
        startedAt: `${year}-03-01T10:00:00.000Z`,
        stats: { distanceMeters: 40_000, elevationGainMeters: 400, durationSeconds: 3600 },
      }),
      act({
        id: '2',
        startedAt: `${year - 1}-03-01T10:00:00.000Z`,
        stats: { distanceMeters: 99_000, elevationGainMeters: 100, durationSeconds: 1000 },
      }),
    ]
    const y = sumYearStats(activities, year)
    expect(y.rides).toBe(1)
    expect(y.distanceMeters).toBe(40_000)
  })

  it('unlocks first ride milestone', () => {
    const ms = evaluateMilestones({
      activities: [
        act({
          id: '1',
          startedAt: new Date().toISOString(),
          stats: { distanceMeters: 5000, elevationGainMeters: 50, durationSeconds: 900 },
        }),
      ],
      routes: [] as SavedRoute[],
      followersCount: 0,
    })
    expect(ms.find((m) => m.id === 'first_ride')?.unlocked).toBe(true)
    expect(ms.find((m) => m.id === 'km_100')?.unlocked).toBe(false)
  })

  it('week stats ignore other weeks', () => {
    const now = new Date()
    const activities = [
      act({
        id: '1',
        startedAt: now.toISOString(),
        stats: { distanceMeters: 10_000, elevationGainMeters: 10, durationSeconds: 600 },
      }),
    ]
    const w = sumWeekStats(activities)
    expect(w.rides).toBe(1)
    expect(w.distanceMeters).toBe(10_000)
  })
})
