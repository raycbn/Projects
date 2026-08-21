import { describe, expect, it, vi, beforeEach } from 'vitest'
import { handleBikeRoute } from './bikeRoute'
import type { Env } from './types'

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    STADIA_API_KEY: overrides.STADIA_API_KEY ?? 'test-key',
    VALHALLA_URL: overrides.VALHALLA_URL,
    ...overrides,
  }
}

function mockRouteLocations(
  routes: Array<{
    distanceMeters: number
    elevationProfile: Array<{ elevationMeters: number }>
  }>,
) {
  let callIndex = 0
  const mock = vi.fn().mockImplementation(() => {
    if (callIndex < routes.length) {
      const route = routes[callIndex]
      callIndex += 1
      return Promise.resolve({
        coordinates: [[0, 0], [1, 1]],
        elevationProfile: route.elevationProfile,
        distanceMeters: route.distanceMeters,
        durationSeconds: 600,
        instructions: ['Go straight'],
        edges: [],
        alternatives: [],
      })
    }
    return Promise.resolve({
      coordinates: [[0, 0], [1, 1]],
      elevationProfile: Array.from({ length: 20 }, (_, i) => ({ elevationMeters: 100 + i * 10 })),
      distanceMeters: 65000,
      durationSeconds: 600,
      instructions: ['Go straight'],
      edges: [],
      alternatives: [],
    })
  })
  return mock
}

describe('handleBikeRoute circular objective', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('prefers within_tolerance candidate over closest even if closest has better surface score', async () => {
    const routeLocationsMock = mockRouteLocations([
      {
        distanceMeters: 58000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + Math.sin(i * 0.5) * 200 + i * 10,
        })),
      },
      {
        distanceMeters: 55000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + Math.sin(i * 0.3) * 150 + i * 8,
        })),
      },
    ])

    const req = new Request('http://localhost/api/bike-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waypoints: [{ lat: 40.4, lon: -3.7 }],
        bikeType: 'road',
        routeType: 'circular',
        circularDistanceMeters: 50000,
        targetElevationGainMeters: 500,
        language: 'es',
        circularSeed: 0,
        wantAlternatives: false,
      }),
    })

    const res = await handleBikeRoute(req, makeEnv({ STADIA_API_KEY: '' }), {
      routeLocations: routeLocationsMock as any,
    } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.objectiveMatch).toBe('within_tolerance')
    expect(body.distanceMeters).toBe(55000)
  })

  it('generates adaptive cohort when all initial candidates are outside elevation tolerance', async () => {
    const routeLocationsMock = mockRouteLocations([
      {
        distanceMeters: 58000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 40,
        })),
      },
      {
        distanceMeters: 60000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 45,
        })),
      },
      {
        distanceMeters: 55000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 48,
        })),
      },
      {
        distanceMeters: 57000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 50,
        })),
      },
      {
        distanceMeters: 62000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 10,
        })),
      },
      {
        distanceMeters: 52000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 20,
        })),
      },
      {
        distanceMeters: 63000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 12,
        })),
      },
      {
        distanceMeters: 64000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 15,
        })),
      },
    ])

    const req = new Request('http://localhost/api/bike-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waypoints: [{ lat: 40.4, lon: -3.7 }],
        bikeType: 'road',
        routeType: 'circular',
        circularDistanceMeters: 50000,
        targetElevationGainMeters: 500,
        language: 'es',
        circularSeed: 0,
        wantAlternatives: false,
      }),
    })

    const res = await handleBikeRoute(req, makeEnv({ STADIA_API_KEY: '' }), {
      routeLocations: routeLocationsMock as any,
    } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.objectiveMatch).toBe('within_tolerance')
    expect(body.distanceMeters).toBe(52000)
  })

  it('does not affect non-objective routes', async () => {
    const routeLocationsMock = mockRouteLocations([
      {
        distanceMeters: 12000,
        elevationProfile: Array.from({ length: 10 }, (_, i) => ({
          elevationMeters: 100 + i * 5,
        })),
      },
    ])

    const req = new Request('http://localhost/api/bike-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waypoints: [
          { lat: 40.4, lon: -3.7 },
          { lat: 40.41, lon: -3.69 },
        ],
        bikeType: 'road',
        routeType: 'a_to_b',
        language: 'es',
        wantAlternatives: false,
      }),
    })

    const res = await handleBikeRoute(req, makeEnv({ STADIA_API_KEY: '' }), {
      routeLocations: routeLocationsMock as any,
    } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.objectiveMatch).toBeUndefined()
  })

  it('returns closest when no candidate is within tolerance', async () => {
    const routeLocationsMock = mockRouteLocations([
      {
        distanceMeters: 58000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 40,
        })),
      },
      {
        distanceMeters: 60000,
        elevationProfile: Array.from({ length: 20 }, (_, i) => ({
          elevationMeters: 100 + i * 50,
        })),
      },
    ])

    const req = new Request('http://localhost/api/bike-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waypoints: [{ lat: 40.4, lon: -3.7 }],
        bikeType: 'road',
        routeType: 'circular',
        circularDistanceMeters: 50000,
        targetElevationGainMeters: 500,
        language: 'es',
        circularSeed: 0,
        wantAlternatives: false,
      }),
    })

    const res = await handleBikeRoute(req, makeEnv({ STADIA_API_KEY: '' }), {
      routeLocations: routeLocationsMock as any,
    } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.objectiveMatch).toBe('closest')
    expect(body.distanceMeters).toBe(58000)
  })
})
