import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearReadyRoute,
  peekReadyRoute,
  richerPacket,
  stashReadyRoute,
  type ReadyRoutePacket,
} from './readyRouteHandoff'
import type { RouteDraft } from '@/domain/types'

function draft(opts: number): RouteDraft {
  return {
    title: 'T',
    type: 'a_to_b',
    bikeType: 'road',
    preferences: [],
    waypoints: [],
    geometry: { type: 'LineString', coordinates: [[-3.7, 40.4], [-3.69, 40.41]] },
    elevationProfile: [],
    stats: {
      distanceMeters: 1000,
      elevationGainMeters: 10,
      elevationLossMeters: 10,
      estimatedDurationSeconds: 300,
      difficulty: 'easy',
    },
    routeOptions:
      opts > 0
        ? Array.from({ length: opts }, (_, i) => ({
            id: `opt-${i + 1}`,
            label: `Opción ${i + 1}`,
            rank: i + 1,
            geometry: { type: 'LineString' as const, coordinates: [[-3.7, 40.4], [-3.69, 40.41]] },
            elevationProfile: [],
            stats: {
              distanceMeters: 1000 + i,
              elevationGainMeters: 10,
              elevationLossMeters: 10,
              estimatedDurationSeconds: 300,
              difficulty: 'easy' as const,
            },
          }))
        : undefined,
  }
}

function packet(opts: number, source: ReadyRoutePacket['source'] = 'calculate'): ReadyRoutePacket {
  return { draft: draft(opts), source }
}

describe('readyRouteHandoff', () => {
  beforeEach(() => {
    clearReadyRoute()
    sessionStorage.clear()
  })

  it('prefers the packet with more routeOptions', () => {
    expect(richerPacket(packet(1), packet(3))?.draft.routeOptions).toHaveLength(3)
    expect(richerPacket(packet(3), packet(1))?.draft.routeOptions).toHaveLength(3)
  })

  it('keeps memory options even if sessionStorage was overwritten with fewer', () => {
    stashReadyRoute(packet(3))
    sessionStorage.setItem(
      'pedalmap_ready_route',
      JSON.stringify(packet(1, 'saved')),
    )
    const peeked = peekReadyRoute()
    expect(peeked?.draft.routeOptions).toHaveLength(3)
  })
})
