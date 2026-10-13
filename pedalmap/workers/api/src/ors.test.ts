import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleOrsProxy } from './ors'
import type { Env } from './types'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('handleOrsProxy', () => {
  it('strips PedalMap quota metadata before forwarding to OpenRouteService', async () => {
    let forwardedBody = ''
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      forwardedBody = String(init?.body ?? '')
      return new Response(JSON.stringify({ features: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof globalThis.fetch

    const env = { ORS_API_KEY: 'test-api-key' } as Env
    const request = new Request(
      'https://api.test/v2/directions/cycling-road/geojson',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: [[-3.7, 40.4], [-3.6, 40.5]],
          pedalmapPreferences: ['avoid_hills', 'avoid_unpaved'],
        }),
      },
    )

    const response = await handleOrsProxy(request, env, '/v2/directions/cycling-road/geojson')

    expect(response.status).toBe(200)
    expect(JSON.parse(forwardedBody)).toEqual({
      coordinates: [[-3.7, 40.4], [-3.6, 40.5]],
    })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v2/directions/cycling-road/geojson'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'test-api-key' }) }),
    )
  })
})
