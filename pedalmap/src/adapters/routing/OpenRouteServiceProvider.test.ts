import { describe, expect, it } from 'vitest'
import {
  geometryFromOrsCoordinates,
  isOrsMaintenanceResponse,
  mapBikeProfile,
  ORS_BASE,
  ORS_LEGACY_BASE,
  ORS_SUPPORTED_PREFERENCES,
  OpenRouteServiceProvider,
  profileFallbacks,
} from '@/adapters/routing/OpenRouteServiceProvider'
import { RoutingError } from '@/domain/types'

describe('OpenRouteServiceProvider', () => {
  it('uses the recommended HeiGIT base URL', () => {
    expect(ORS_BASE).toBe('https://api.heigit.org/openrouteservice')
    expect(ORS_LEGACY_BASE).toBe('https://api.openrouteservice.org')
    expect(ORS_BASE).not.toContain('api.openrouteservice.org')
  })

  it('maps bike types to real ORS profiles', () => {
    expect(mapBikeProfile('road')).toBe('cycling-road')
    expect(mapBikeProfile('mtb')).toBe('cycling-mountain')
    expect(mapBikeProfile('ebike')).toBe('cycling-electric')
    expect(mapBikeProfile('gravel')).toBe('cycling-regular')
    expect(mapBikeProfile('urban')).toBe('cycling-regular')
  })

  it('falls back to cycling-regular when road/electric profiles are down', () => {
    expect(profileFallbacks('cycling-road')).toEqual(['cycling-regular'])
    expect(profileFallbacks('cycling-electric')).toEqual(['cycling-regular'])
    expect(isOrsMaintenanceResponse(503, 'Down For Maintenance')).toBe(true)
  })

  it('keeps Madrid-area coordinates when building geometry from ORS GeoJSON', () => {
    const { coordinates, profile } = geometryFromOrsCoordinates([
      [-3.621511, 40.380491, 630],
      [-3.621292, 40.380335, 630],
      [-3.571013, 40.20959, 520],
    ])
    expect(coordinates[0][0]).toBeCloseTo(-3.621511, 5)
    expect(coordinates[0][1]).toBeCloseTo(40.380491, 5)
    expect(coordinates.at(-1)?.[1]).toBeCloseTo(40.20959, 5)
    expect(profile[0].elevationMeters).toBe(630)
    expect(profile.at(-1)?.elevationMeters).toBe(520)
    expect(profile.at(-1)?.distanceMeters).toBeGreaterThan(1000)
  })

  it('only claims supported preferences that map to ORS', () => {
    expect(ORS_SUPPORTED_PREFERENCES).toEqual([
      'prefer_shorter',
      'prefer_faster',
      'prefer_less_elevation',
      'avoid_primary_roads',
    ])
  })

  it('fails clearly when not configured', async () => {
    const provider = new OpenRouteServiceProvider(undefined, 'https://example.invalid')
    await expect(
      provider.calculateRoute({
        waypoints: [
          { lat: 40.4, lng: -3.7 },
          { lat: 40.5, lng: -3.8 },
        ],
        bikeType: 'road',
        preferences: [],
        routeType: 'a_to_b',
      }),
    ).rejects.toBeInstanceOf(RoutingError)
  })
})
