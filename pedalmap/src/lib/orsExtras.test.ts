import { describe, expect, it } from 'vitest'
import {
  surfaceStatsFromOrsExtras,
  waytypeBreakdownFromOrsExtras,
} from '@/lib/orsExtras'

describe('orsExtras', () => {
  it('builds paved/unpaved percentages and surface list from ORS summary', () => {
    const stats = surfaceStatsFromOrsExtras({
      surface: {
        summary: [
          { value: 3, distance: 12000, amount: 60 },
          { value: 11, distance: 6000, amount: 30 },
          { value: 0, distance: 2000, amount: 10 },
        ],
      },
    })
    expect(stats?.pavedPercent).toBe(60)
    expect(stats?.unpavedPercent).toBe(30)
    expect(stats?.unknownPercent).toBe(10)
    expect(stats?.surfaces?.[0]).toEqual({ type: 'Asfalto', distanceMeters: 12000 })
    expect(stats?.surfaces?.[1].type).toBe('Tierra')
  })

  it('maps waytypes for Strava-like breakdown', () => {
    const rows = waytypeBreakdownFromOrsExtras({
      waytypes: {
        summary: [
          { value: 6, distance: 5000, amount: 50 },
          { value: 5, distance: 5000, amount: 50 },
        ],
      },
    })
    expect(rows?.[0].type).toBe('Carril bici')
    expect(rows?.[1].type).toBe('Pista')
  })
})
