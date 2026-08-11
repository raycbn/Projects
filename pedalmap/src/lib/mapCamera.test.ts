import { describe, expect, it } from 'vitest'
import { routeCameraKey } from '@/lib/mapCamera'

describe('routeCameraKey', () => {
  it('returns empty without geometry', () => {
    expect(routeCameraKey(null)).toBe('empty')
    expect(routeCameraKey(undefined, 'import')).toBe('empty-import')
  })

  it('changes when the route moves to another place', () => {
    const madrid = {
      type: 'LineString' as const,
      coordinates: [
        [-3.7, 40.4] as [number, number],
        [-3.6, 40.5] as [number, number],
      ],
    }
    const barcelona = {
      type: 'LineString' as const,
      coordinates: [
        [2.1, 41.3] as [number, number],
        [2.2, 41.4] as [number, number],
      ],
    }
    expect(routeCameraKey(madrid)).not.toBe(routeCameraKey(barcelona))
    expect(routeCameraKey(madrid, 1)).not.toBe(routeCameraKey(madrid, 2))
  })
})
