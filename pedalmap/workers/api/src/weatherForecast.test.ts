import { describe, expect, it, vi, afterEach } from 'vitest'
import { handleWeatherForecast } from './weatherForecast'

function makeRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const mockCache = {
  match: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
}

describe('handleWeatherForecast', () => {
  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns 400 when lat is missing', async () => {
    const req = new Request('http://localhost/osm/weather-forecast?lng=-3.66')
    const res = await handleWeatherForecast(req, {} as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('lat and lng required')
  })

  it('returns degraded when upstream responds 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeRes(500, { error: 'server' })))
    vi.stubGlobal('caches', { default: mockCache })

    const req = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    const res = await handleWeatherForecast(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.degraded).toBe(true)
    expect(body.reason).toBe('upstream_500')
    expect(mockCache.put).toHaveBeenCalledTimes(1)
  })

  it('returns degraded when upstream responds 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeRes(429, { error: 'rate limited' })))
    vi.stubGlobal('caches', { default: mockCache })

    const req = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    const res = await handleWeatherForecast(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.degraded).toBe(true)
    expect(body.reason).toBe('upstream_429')
  })

  it('returns degraded when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))
    vi.stubGlobal('caches', { default: mockCache })

    const req = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    const res = await handleWeatherForecast(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.degraded).toBe(true)
    expect(body.reason).toBe('network failure')
    expect(mockCache.put).toHaveBeenCalledTimes(1)
  })

  it('returns degraded when res.json() throws', async () => {
    const badRes = new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(badRes))
    vi.stubGlobal('caches', { default: mockCache })

    const req = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    const res = await handleWeatherForecast(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.degraded).toBe(true)
    expect(body.reason).toBe('upstream_invalid_json')
    expect(mockCache.put).toHaveBeenCalledTimes(1)
  })

  it('normalizes forecast_days=3 to upstream 7', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeRes(200, {
        latitude: 40.38,
        longitude: -3.66,
        timezone: 'Europe/Madrid',
        hourly: {
          time: ['2026-08-23T00:00', '2026-08-23T01:00'],
          temperature_2m: [20, 19],
          precipitation: [0, 0],
          wind_speed_10m: [10, 12],
          wind_direction_10m: [180, 190],
          wind_gusts_10m: [15, 18],
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('caches', { default: mockCache })

    const req = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    await handleWeatherForecast(req, {} as any)

    const upstreamUrl = new URL(fetchMock.mock.calls[0][0])
    expect(upstreamUrl.searchParams.get('forecast_days')).toBe('7')
  })

  it('uses same cache key for forecast_days=3 and 7', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeRes(200, {
        latitude: 40.38,
        longitude: -3.66,
        timezone: 'Europe/Madrid',
        hourly: {
          time: ['2026-08-23T00:00'],
          temperature_2m: [20],
          precipitation: [0],
          wind_speed_10m: [10],
          wind_direction_10m: [180],
          wind_gusts_10m: [15],
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const store = new Map<string, Response>()
    const cache = {
      match: vi.fn((key: RequestInfo) => Promise.resolve(store.get(String(key)) ?? null)),
      put: vi.fn((key: RequestInfo, value: Response) => {
        store.set(String(key), value.clone())
        return Promise.resolve()
      }),
    }
    vi.stubGlobal('caches', { default: cache })

    const req3 = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    await handleWeatherForecast(req3, {} as any)

    const req7 = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=7')
    await handleWeatherForecast(req7, {} as any)

    const cacheCalls = cache.put.mock.calls.map((c) => c[0])
    expect(cacheCalls[0]).toBe('https://cache.pedalmap.internal/weather/40.38,-3.66,7')
    expect(cache.put).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches degraded responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeRes(500, { error: 'server' })))
    vi.stubGlobal('caches', { default: mockCache })

    const req = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    await handleWeatherForecast(req, {} as any)

    expect(mockCache.put).toHaveBeenCalledTimes(1)
    const cachedKey = mockCache.put.mock.calls[0][0]
    expect(cachedKey).toBe('https://cache.pedalmap.internal/weather/40.38,-3.66,7')
  })

  it('returns cached response on second request', async () => {
    const cachedBody = new Response(JSON.stringify({ forecast: { hours: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    const cache = { match: vi.fn().mockResolvedValue(cachedBody), put: vi.fn().mockResolvedValue(undefined) }
    vi.stubGlobal('caches', { default: cache })
    vi.stubGlobal('fetch', vi.fn())

    const req = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    const res = await handleWeatherForecast(req, {} as any)
    expect(res.status).toBe(200)
    expect(cache.match).toHaveBeenCalledTimes(1)
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('does not crash when cache.match throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeRes(200, {
        latitude: 40.38,
        longitude: -3.66,
        timezone: 'Europe/Madrid',
        hourly: {
          time: ['2026-08-23T00:00'],
          temperature_2m: [20],
          precipitation: [0],
          wind_speed_10m: [10],
          wind_direction_10m: [180],
          wind_gusts_10m: [15],
        },
      }),
    ))
    const cache = { match: vi.fn().mockRejectedValue(new Error('cache boom')), put: vi.fn() }
    vi.stubGlobal('caches', { default: cache })

    const req = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    const res = await handleWeatherForecast(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.forecast?.hours).toHaveLength(1)
  })

  it('does not crash when cache.put throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeRes(500, { error: 'server' })))
    const cache = { match: vi.fn().mockResolvedValue(null), put: vi.fn().mockRejectedValue(new Error('cache put boom')) }
    vi.stubGlobal('caches', { default: cache })

    const req = new Request('http://localhost/osm/weather-forecast?lat=40.38&lng=-3.66&forecast_days=3')
    const res = await handleWeatherForecast(req, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.degraded).toBe(true)
  })
})
