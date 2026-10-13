import { afterEach, describe, expect, it, vi } from 'vitest'
import * as firestore from './firestore'
import type { Env, FirebaseIdentity } from './types'

const originalFetch = globalThis.fetch

const env = {
  ORS_API_KEY: 'ors-test-key',
  FIREBASE_PROJECT_ID: 'pedalmap-quota-test',
} as Env

const identity: FirebaseIdentity = {
  uid: 'route-options-test-user',
  email: undefined,
  emailVerified: false,
  isAnonymous: false,
}

function entitlements(plan: 'free' | 'premium') {
  return {
    plan,
    routesSaved: 0,
    routesCreatedThisMonth: 0,
    monthKey: '2026-10',
    freeGpxWeekKey: '2026-W42',
    freeGpxUsedThisWeek: 0,
    freeCircularUsedThisMonth: 0,
    anonymousRoutesCreated: 0,
  }
}

function requestWithThreeOptions(): Request {
  return new Request('https://api.test/v2/directions/cycling-road/geojson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: [[-3.7, 40.4], [-3.6, 40.5]],
      alternative_routes: { target_count: 3, share_factor: 0.55, weight_factor: 1.6 },
    }),
  })
}

function requestWithCircularOptions(): Request {
  return new Request('https://api.test/v2/directions/cycling-road/geojson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: [[-3.7, 40.4]],
      options: { round_trip: { length: 20000, points: 5, seed: 0 } },
    }),
  })
}

const validRouteResponse = {
  features: [{
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[-3.7, 40.4], [-3.6, 40.5]] },
    properties: { summary: { distance: 10000, duration: 2000, ascent: 50, descent: 40 } },
  }],
}

function installOrsFetchMock(payload: unknown = validRouteResponse) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('server-enforced ORS route option entitlement', () => {
  it('clamps Free users to 2 route options even when they request 3', async () => {
    vi.spyOn(firestore, 'readUserEntitlements').mockResolvedValue(entitlements('free'))
    const fetchMock = installOrsFetchMock()
    const { handleOrsProxyWithEntitlements } = await import('./index')

    const response = await handleOrsProxyWithEntitlements(
      env,
      identity,
      requestWithThreeOptions(),
      '/v2/directions/cycling-road/geojson',
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit]
    const forwarded = JSON.parse(String(init.body)) as {
      alternative_routes: { target_count: number }
    }
    expect(forwarded.alternative_routes.target_count).toBe(2)
  })

  it('keeps 3 route options for Premium', async () => {
    vi.spyOn(firestore, 'readUserEntitlements').mockResolvedValue(entitlements('premium'))
    const fetchMock = installOrsFetchMock()
    const { handleOrsProxyWithEntitlements } = await import('./index')

    const response = await handleOrsProxyWithEntitlements(
      env,
      identity,
      requestWithThreeOptions(),
      '/v2/directions/cycling-road/geojson',
    )

    expect(response.status).toBe(200)
    const [, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit]
    const forwarded = JSON.parse(String(init.body)) as {
      alternative_routes: { target_count: number }
    }
    expect(forwarded.alternative_routes.target_count).toBe(3)
  })

  it('fails closed and does not call ORS when entitlement lookup fails', async () => {
    vi.spyOn(firestore, 'readUserEntitlements').mockRejectedValue(new Error('Firestore unavailable'))
    const fetchMock = installOrsFetchMock()
    const { handleOrsProxyWithEntitlements } = await import('./index')

    const response = await handleOrsProxyWithEntitlements(
      env,
      identity,
      requestWithThreeOptions(),
      '/v2/directions/cycling-road/geojson',
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'quota_unavailable' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('blocks a Free circular ORS request when the monthly trial was already consumed', async () => {
    vi.spyOn(firestore, 'readUserEntitlements').mockResolvedValue(entitlements('free'))
    const checkSpy = vi.spyOn(firestore, 'checkFreeCircularLimit').mockResolvedValue({
      error: 'Límite de Objetivo circular alcanzado',
      code: 'free_circular_limit',
    })
    const consumeSpy = vi.spyOn(firestore, 'consumeFreeCircular')
    const fetchMock = installOrsFetchMock(validRouteResponse)
    const { handleOrsProxyWithEntitlements } = await import('./index')

    const response = await handleOrsProxyWithEntitlements(
      env,
      identity,
      requestWithCircularOptions(),
      '/v2/directions/cycling-road/geojson',
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'free_circular_limit' })
    expect(checkSpy).toHaveBeenCalledWith(env, identity.uid)
    expect(consumeSpy).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('consumes Free circular quota only after ORS returns a route and marks the response', async () => {
    vi.spyOn(firestore, 'readUserEntitlements').mockResolvedValue(entitlements('free'))
    const checkSpy = vi.spyOn(firestore, 'checkFreeCircularLimit').mockResolvedValue(null)
    const consumeSpy = vi.spyOn(firestore, 'consumeFreeCircular').mockResolvedValue({
      allowed: true,
      remaining: 0,
    })
    const fetchMock = installOrsFetchMock(validRouteResponse)
    const { handleOrsProxyWithEntitlements } = await import('./index')

    const response = await handleOrsProxyWithEntitlements(
      env,
      identity,
      requestWithCircularOptions(),
      '/v2/directions/cycling-road/geojson',
    )
    const body = await response.json() as { features?: unknown[]; pedalmapQuotaConsumed?: boolean }

    expect(response.status).toBe(200)
    expect(body.features).toHaveLength(1)
    expect(body.pedalmapQuotaConsumed).toBe(true)
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(consumeSpy).toHaveBeenCalledWith(env, identity.uid)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not return an ORS circular route if atomic quota consumption loses a race', async () => {
    vi.spyOn(firestore, 'readUserEntitlements').mockResolvedValue(entitlements('free'))
    vi.spyOn(firestore, 'checkFreeCircularLimit').mockResolvedValue(null)
    vi.spyOn(firestore, 'consumeFreeCircular').mockRejectedValue(
      new firestore.QuotaLimitReachedError('free_circular_limit', 'Límite de Objetivo circular alcanzado'),
    )
    const fetchMock = installOrsFetchMock(validRouteResponse)
    const { handleOrsProxyWithEntitlements } = await import('./index')

    const response = await handleOrsProxyWithEntitlements(
      env,
      identity,
      requestWithCircularOptions(),
      '/v2/directions/cycling-road/geojson',
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'free_circular_limit' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not consume route quota or circular credit when ORS returns an empty feature collection', async () => {
    vi.spyOn(firestore, 'readUserEntitlements').mockResolvedValue(entitlements('free'))
    vi.spyOn(firestore, 'checkFreeCircularLimit').mockResolvedValue(null)
    const consumeSpy = vi.spyOn(firestore, 'consumeFreeCircular')
    const fetchMock = installOrsFetchMock({ features: [] })
    const { handleOrsProxyWithEntitlements } = await import('./index')

    const response = await handleOrsProxyWithEntitlements(
      env,
      identity,
      requestWithCircularOptions(),
      '/v2/directions/cycling-road/geojson',
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'no_route' })
    expect(consumeSpy).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not consume the Free circular trial for Premium', async () => {
    vi.spyOn(firestore, 'readUserEntitlements').mockResolvedValue(entitlements('premium'))
    const checkSpy = vi.spyOn(firestore, 'checkFreeCircularLimit')
    const consumeSpy = vi.spyOn(firestore, 'consumeFreeCircular')
    const fetchMock = installOrsFetchMock(validRouteResponse)
    const { handleOrsProxyWithEntitlements } = await import('./index')

    const response = await handleOrsProxyWithEntitlements(
      env,
      identity,
      requestWithCircularOptions(),
      '/v2/directions/cycling-road/geojson',
    )
    const body = await response.json() as { pedalmapQuotaConsumed?: boolean }

    expect(response.status).toBe(200)
    expect(body.pedalmapQuotaConsumed).toBeUndefined()
    expect(checkSpy).not.toHaveBeenCalled()
    expect(consumeSpy).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
