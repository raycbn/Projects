import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleWaterSources } from './waterSources'

function makeRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const mockCache = {
  match: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
}

describe('handleWaterSources', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('caches', { default: mockCache })
  })

  it('returns 400 when bbox is missing', async () => {
    const req = new Request('http://localhost/osm/water-sources', { method: 'GET' })
    const res = await handleWaterSources(req, {} as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('bbox required')
  })

  it('returns 400 when bbox is invalid', async () => {
    const req = new Request('http://localhost/osm/water-sources?bbox=a,b,c', { method: 'GET' })
    const res = await handleWaterSources(req, {} as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid bbox')
  })

  it('uses primary upstream when it responds ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeRes(200, {
        elements: [
          { type: 'node', id: 1, lat: 50.7, lon: 7.1, tags: { name: 'Fuente A', amenity: 'drinking_water' } },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/osm/water-sources?bbox=50.0,7.0,51.0,8.0', { method: 'GET' })
    const res = await handleWaterSources(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toHaveLength(1)
    expect(body.sources[0].name).toBe('Fuente A')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://overpass.openstreetmap.fr/api/interpreter',
      expect.any(Object),
    )
    const callArgs = fetchMock.mock.calls[0]
    const sentQuery = callArgs[1].body
    expect(sentQuery).not.toContain('qt=200')
  })

  it('falls back to secondary when primary fails', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce(
        makeRes(200, {
          elements: [
            { type: 'node', id: 2, lat: 50.71, lon: 7.11, tags: { name: 'Fuente B', amenity: 'drinking_water' } },
          ],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/osm/water-sources?bbox=50.0,7.0,51.0,8.0', { method: 'GET' })
    const res = await handleWaterSources(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toHaveLength(1)
    expect(body.sources[0].name).toBe('Fuente B')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://overpass-api.de/api/interpreter', expect.any(Object))
  })

  it('returns degraded when both upstreams fail', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('all down'))
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/osm/water-sources?bbox=50.0,7.0,51.0,8.0', { method: 'GET' })
    const res = await handleWaterSources(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
    expect(body.degraded).toBe(true)
    expect(body.reason).toBe('upstream_unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns degraded when upstream returns non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeRes(502, { error: 'bad gateway' }))
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/osm/water-sources?bbox=50.0,7.0,51.0,8.0', { method: 'GET' })
    const res = await handleWaterSources(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
    expect(body.degraded).toBe(true)
    expect(body.reason).toBe('upstream_unavailable')
  })

  it('returns degraded when JSON is invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/osm/water-sources?bbox=50.0,7.0,51.0,8.0', { method: 'GET' })
    const res = await handleWaterSources(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
    expect(body.degraded).toBe(true)
    expect(body.reason).toBe('upstream_unavailable')
  })

  it('skips elements without lat/lon', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeRes(200, {
        elements: [
          { type: 'node', id: 1, tags: { name: 'Sin coords' } },
          { type: 'node', id: 2, lat: 50.7, lon: 7.1, tags: { name: 'Con coords', amenity: 'drinking_water' } },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/osm/water-sources?bbox=50.0,7.0,51.0,8.0', { method: 'GET' })
    const res = await handleWaterSources(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toHaveLength(1)
    expect(body.sources[0].name).toBe('Con coords')
  })

  it('does not wait indefinitely when upstream hangs', async () => {
    const timeoutError = new Error('Aborted')
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => setTimeout(() => reject(timeoutError), 1000)))
      .mockResolvedValueOnce(
        makeRes(200, {
          elements: [
            { type: 'node', id: 3, lat: 50.72, lon: 7.12, tags: { name: 'Fuente C', amenity: 'drinking_water' } },
          ],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/osm/water-sources?bbox=50.0,7.0,51.0,8.0', { method: 'GET' })
    const start = Date.now()
    const res = await handleWaterSources(req, {} as any)
    const elapsedMs = Date.now() - start
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toHaveLength(1)
    expect(body.sources[0].name).toBe('Fuente C')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(elapsedMs).toBeLessThan(1500)
  })
})
