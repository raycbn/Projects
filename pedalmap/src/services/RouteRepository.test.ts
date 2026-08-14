import { describe, expect, it } from 'vitest'
import {
  coordsFromStored,
  coordsToStored,
  stripUndefinedDeep,
  toPersistedDraft,
  toSharePublishPayload,
} from '@/services/RouteRepository'
import type { RouteDraft } from '@/domain/types'

describe('toPersistedDraft', () => {
  it('strips undefined, keeps lean surface/instructions, and slim opciones', () => {
    const draft = {
      title: 'Test',
      type: 'a_to_b',
      bikeType: 'road',
      preferences: [],
      waypoints: [],
      geometry: { type: 'LineString', coordinates: [[-3.7, 40.4], [-3.6, 40.5]] },
      elevationProfile: [{ distanceMeters: 0, elevationMeters: 600 }],
      stats: {
        distanceMeters: 1000,
        elevationGainMeters: 10,
        elevationLossMeters: 5,
        estimatedDurationSeconds: 300,
        difficulty: 'easy',
      },
      description: undefined,
      instructions: undefined,
      surfaceEdges: [{ length: 12, surface: 'paved', road_class: 'secondary' }],
      selectedOptionId: 'opt-1',
      routeOptions: [
        {
          id: 'opt-1',
          label: 'Opción 1',
          rank: 1,
          geometry: { type: 'LineString', coordinates: [[-3.7, 40.4], [-3.6, 40.5]] },
          elevationProfile: [{ distanceMeters: 0, elevationMeters: 600 }],
          stats: {
            distanceMeters: 1000,
            elevationGainMeters: 10,
            elevationLossMeters: 5,
            estimatedDurationSeconds: 300,
            difficulty: 'easy',
          },
        },
        {
          id: 'opt-2',
          label: 'Opción 2',
          rank: 2,
          geometry: { type: 'LineString', coordinates: [[-3.71, 40.41], [-3.59, 40.49]] },
          elevationProfile: [{ distanceMeters: 0, elevationMeters: 610 }],
          stats: {
            distanceMeters: 1100,
            elevationGainMeters: 20,
            elevationLossMeters: 8,
            estimatedDurationSeconds: 320,
            difficulty: 'easy',
          },
        },
      ],
      alternatives: [{ id: 'y' }],
    } as unknown as RouteDraft

    const payload = toPersistedDraft(draft)
    expect(payload.title).toBe('Test')
    expect('description' in payload).toBe(false)
    // Instructions are capped (not dropped) so navigate/share stay useful offline.
    expect(payload.instructions).toEqual([])
    expect(payload.surfaceEdges).toEqual([
      { length: 12, surface: 'paved', road_class: 'secondary' },
    ])
    expect(Array.isArray(payload.routeOptions)).toBe(true)
    expect((payload.routeOptions as unknown[]).length).toBe(2)
    // Legacy alts omitted when ranked routeOptions are present.
    expect('alternatives' in payload).toBe(false)
    expect(stripUndefinedDeep({ a: 1, b: undefined })).toEqual({ a: 1 })
    expect(
      stripUndefinedDeep({
        distanceMeters: 12000,
        durationSeconds: 2400,
        elevationGainMeters: 180,
        averageHeartRateBpm: undefined,
        averageCadenceRpm: undefined,
        averagePowerWatts: undefined,
      }),
    ).toEqual({
      distanceMeters: 12000,
      durationSeconds: 2400,
      elevationGainMeters: 180,
    })

    const geometry = payload.geometry as { coordinates: unknown[] }
    expect(geometry.coordinates[0]).toEqual({ lng: -3.7, lat: 40.4 })
    expect(Array.isArray(geometry.coordinates[0])).toBe(false)
  })

  it('round-trips stored coords', () => {
    const stored = coordsToStored([
      [-3.7, 40.4],
      [-3.6, 40.5],
    ])
    expect(coordsFromStored(stored)).toEqual([
      [-3.7, 40.4],
      [-3.6, 40.5],
    ])
    expect(coordsFromStored([[-3.7, 40.4]])).toEqual([[-3.7, 40.4]])
  })

  it('downsamples long geometries for share publish', () => {
    const coords = Array.from(
      { length: 5000 },
      (_, i) => [-3.7 + i * 0.00001, 40.4] as [number, number],
    )
    const draft = {
      title: 'Larga',
      type: 'a_to_b',
      bikeType: 'road',
      preferences: [],
      waypoints: [{ id: 'a', lng: -3.7, lat: 40.4 }],
      geometry: { type: 'LineString', coordinates: coords },
      elevationProfile: coords.map((_, i) => ({ distanceMeters: i, elevationMeters: 600 })),
      stats: {
        distanceMeters: 50000,
        elevationGainMeters: 100,
        elevationLossMeters: 90,
        estimatedDurationSeconds: 7200,
        difficulty: 'moderate',
      },
    } as unknown as RouteDraft

    const share = toSharePublishPayload(draft)
    const geometry = share.geometry as { coordinates: unknown[] }
    expect(geometry.coordinates.length).toBeLessThanOrEqual(2500)
    expect(geometry.coordinates[0]).toMatchObject({
      lng: expect.any(Number),
      lat: expect.any(Number),
    })
    expect((share.elevationProfile as unknown[]).length).toBeLessThanOrEqual(400)
  })
})
