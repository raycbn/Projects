import { describe, it, expect } from 'vitest'
import { DEV_DRAFT, DEV_READY_ROUTE_PACKET, DEV_ROUTE_CONTEXT } from '@/lib/devSeed'

describe('DEV route fixture (dev-only, never shipped to production)', () => {
  it('has a valid geometry with at least 2 coordinates', () => {
    expect(DEV_DRAFT.geometry.type).toBe('LineString')
    expect(DEV_DRAFT.geometry.coordinates.length).toBeGreaterThanOrEqual(2)
  })

  it('stats are coherent with the route context', () => {
    expect(DEV_DRAFT.stats.distanceMeters).toBe(DEV_ROUTE_CONTEXT.distanceKm * 1000)
    expect(DEV_DRAFT.stats.elevationGainMeters).toBe(DEV_ROUTE_CONTEXT.elevationGainM)
    expect(DEV_DRAFT.stats.estimatedDurationSeconds).toBe(DEV_ROUTE_CONTEXT.durationMinutes * 60)
  })

  it('is explicitly marked as DEV/TEST', () => {
    expect(DEV_DRAFT.title).toMatch(/DEV/)
    expect(DEV_DRAFT.description).toMatch(/desarrollo/)
  })

  it('packet carries the draft and calculate source', () => {
    expect(DEV_READY_ROUTE_PACKET.draft).toBe(DEV_DRAFT)
    expect(DEV_READY_ROUTE_PACKET.source).toBe('calculate')
  })
})
