import { describe, expect, it } from 'vitest'
import { routingRequestSchema, saveRouteSchema } from '@/domain/schemas'

describe('schemas', () => {
  it('validates a routing request', () => {
    const result = routingRequestSchema.safeParse({
      waypoints: [
        { lat: 40.4, lng: -3.7 },
        { lat: 40.5, lng: -3.8 },
      ],
      bikeType: 'road',
      preferences: ['prefer_bike_lanes'],
      routeType: 'a_to_b',
    })
    expect(result.success).toBe(true)
  })

  it('rejects too few waypoints', () => {
    const result = routingRequestSchema.safeParse({
      waypoints: [{ lat: 40.4, lng: -3.7 }],
      bikeType: 'mtb',
      preferences: [],
      routeType: 'a_to_b',
    })
    expect(result.success).toBe(false)
  })

  it('validates save route input', () => {
    expect(saveRouteSchema.safeParse({ title: 'Madrid loop' }).success).toBe(true)
    expect(saveRouteSchema.safeParse({ title: '' }).success).toBe(false)
  })
})
