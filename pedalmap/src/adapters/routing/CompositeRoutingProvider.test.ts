import { describe, expect, it, vi } from 'vitest'
import { CompositeRoutingProvider } from './CompositeRoutingProvider'
import { OpenRouteServiceProvider } from './OpenRouteServiceProvider'
import { ValhallaProvider } from './ValhallaProvider'
import { RoutingError, type RoutingRequest } from '@/domain/types'

const request = {
  bikeType: 'road',
  preferences: ['avoid_hills', 'avoid_unpaved', 'avoid_tolls'],
  routeType: 'a_to_b',
  waypoints: [{ lat: 40.4, lng: -3.7 }, { lat: 40.5, lng: -3.6 }],
  wantAlternatives: false,
} as unknown as RoutingRequest

describe('CompositeRoutingProvider entitlement errors', () => {
  it.each([
    'create_limit',
    'anonymous_limit_reached',
    'guest_identity_limit_reached',
    'free_circular_limit',
    'filter_limit',
    'quota_unavailable',
  ] as const)('does not fall back to ORS for authoritative %s responses', async (code) => {
    const expected = new RoutingError('Quota denied', code)
    const valhalla = {
      isConfigured: () => true,
      calculateRoute: vi.fn().mockRejectedValue(expected),
    } as unknown as ValhallaProvider
    const ors = {
      isConfigured: () => true,
      calculateRoute: vi.fn(),
    } as unknown as OpenRouteServiceProvider
    const composite = new CompositeRoutingProvider(valhalla, ors)

    await expect(composite.calculateRoute(request)).rejects.toBe(expected)
    expect(valhalla.calculateRoute).toHaveBeenCalledTimes(1)
    expect(ors.calculateRoute).not.toHaveBeenCalled()
  })
})
