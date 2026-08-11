import { describe, expect, it } from 'vitest'
import { stripUndefinedDeep, toPersistedDraft } from '@/services/RouteRepository'
import type { RouteDraft } from '@/domain/types'

describe('toPersistedDraft', () => {
  it('strips undefined and drops bulky alternatives', () => {
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
      routeOptions: [{ id: 'x' }],
      alternatives: [{ id: 'y' }],
    } as unknown as RouteDraft

    const payload = toPersistedDraft(draft)
    expect(payload.title).toBe('Test')
    expect('description' in payload).toBe(false)
    expect('instructions' in payload).toBe(false)
    expect('routeOptions' in payload).toBe(false)
    expect('alternatives' in payload).toBe(false)
    expect(stripUndefinedDeep({ a: 1, b: undefined })).toEqual({ a: 1 })
  })
})
