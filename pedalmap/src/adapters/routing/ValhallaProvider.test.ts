import { describe, expect, it, vi, afterEach } from 'vitest'
import { ValhallaProvider } from '@/adapters/routing/ValhallaProvider'
import type { RoutingRequest } from '@/domain/types'

function makeRouteResponse(objective?: {
  objectiveMatch?: 'within_tolerance' | 'closest'
  objectiveDistanceError?: number
  objectiveElevationError?: number
  objectiveElevationGainMeters?: number
}) {
  return {
    ok: true,
    provider: 'valhalla',
    bikeType: 'road',
    routeType: 'circular',
    coordinates: [
      [0, 0],
      [0.001, 0.001],
      [0.002, 0.002],
      [0, 0],
    ],
    elevationProfile: [
      { distanceMeters: 0, elevationMeters: 100 },
      { distanceMeters: 100, elevationMeters: 105 },
      { distanceMeters: 200, elevationMeters: 110 },
    ],
    edges: [],
    distanceMeters: 50000,
    durationSeconds: 3600,
    instructions: ['Start', 'Turn right', 'Arrive'],
    alternatives: objective
      ? [
          {
            coordinates: [
              [0, 0],
              [0.0015, 0.0015],
              [0.003, 0.003],
              [0, 0],
            ],
            elevationProfile: [
              { distanceMeters: 0, elevationMeters: 100 },
              { distanceMeters: 150, elevationMeters: 108 },
            ],
            edges: [],
            distanceMeters: 52000,
            durationSeconds: 3800,
            instructions: ['Start', 'Turn left', 'Arrive'],
            ...objective,
          },
        ]
      : [],
    ...objective,
  }
}

describe('ValhallaProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('primary conserva objective*', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(makeRouteResponse({
            objectiveMatch: 'within_tolerance',
            objectiveDistanceError: 0.04,
            objectiveElevationError: 0.24,
            objectiveElevationGainMeters: 380,
          })), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )

    const provider = new ValhallaProvider('http://localhost:8787')
    const result = await provider.calculateRoute({
      waypoints: [{ lat: 0, lng: 0 }],
      bikeType: 'road',
      preferences: [],
      routeType: 'circular',
      circularDistanceMeters: 50000,
      targetElevationGainMeters: 400,
      circularSeed: 1,
    } as RoutingRequest)

    expect(result.objectiveMatch).toBe('within_tolerance')
    expect(result.objectiveDistanceError).toBeCloseTo(0.04)
    expect(result.objectiveElevationError).toBeCloseTo(0.24)
    expect(result.objectiveElevationGainMeters).toBe(380)
  })

  it('alternatives conservan objective*', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(makeRouteResponse({
            objectiveMatch: 'closest',
            objectiveDistanceError: 0.08,
            objectiveElevationError: 0.45,
            objectiveElevationGainMeters: 420,
          })), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )

    const provider = new ValhallaProvider('http://localhost:8787')
    const result = await provider.calculateRoute({
      waypoints: [{ lat: 0, lng: 0 }],
      bikeType: 'road',
      preferences: [],
      routeType: 'circular',
      circularDistanceMeters: 50000,
      targetElevationGainMeters: 400,
      circularSeed: 1,
    } as RoutingRequest)

    expect(result.alternatives?.length).toBe(1)
    const alt = result.alternatives?.[0]
    expect(alt?.objectiveMatch).toBe('closest')
    expect(alt?.objectiveDistanceError).toBeCloseTo(0.08)
    expect(alt?.objectiveElevationError).toBeCloseTo(0.45)
    expect(alt?.objectiveElevationGainMeters).toBe(420)
  })

  it('alternativas sin objective* no se ven afectadas en A→B', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              provider: 'valhalla',
              bikeType: 'road',
              routeType: 'a_to_b',
              coordinates: [[0, 0], [0.001, 0.001]],
              elevationProfile: [],
              edges: [],
              distanceMeters: 10000,
              durationSeconds: 600,
              instructions: ['Start', 'Arrive'],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )

    const provider = new ValhallaProvider('http://localhost:8787')
    const result = await provider.calculateRoute({
      waypoints: [{ lat: 0, lng: 0 }, { lat: 0.001, lng: 0.001 }],
      bikeType: 'road',
      preferences: [],
      routeType: 'a_to_b',
    } as RoutingRequest)

    expect(result.objectiveMatch).toBeUndefined()
    expect(result.objectiveDistanceError).toBeUndefined()
    expect(result.alternatives).toBeUndefined()
  })
})
