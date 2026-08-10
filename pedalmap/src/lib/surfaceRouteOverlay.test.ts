import { describe, expect, it } from 'vitest'
import { buildSurfaceRouteOverlay, summarizeUnpavedAlert } from '@/lib/surfaceRouteOverlay'

describe('surfaceRouteOverlay', () => {
  it('splits geometry proportionally by edge lengths', () => {
    const geometry = {
      type: 'LineString' as const,
      coordinates: [
        [0, 0],
        [0.01, 0],
        [0.02, 0],
        [0.03, 0],
      ] as [number, number][],
    }
    const overlay = buildSurfaceRouteOverlay(geometry, [
      { length: 0.5, surface: 'paved' },
      { length: 0.5, surface: 'gravel' },
    ])
    expect(overlay.features.length).toBeGreaterThanOrEqual(2)
    expect(overlay.features.some((f) => f.properties?.kind === 'paved')).toBe(true)
    expect(overlay.features.some((f) => f.properties?.kind === 'unpaved')).toBe(true)
  })

  it('warns road riders about unpaved stretch', () => {
    expect(summarizeUnpavedAlert('road', 12, 1500)).toMatch(/sin asfaltar/i)
    expect(summarizeUnpavedAlert('mtb', 40)).toBeNull()
  })
})
