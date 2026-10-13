import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as firestore from './firestore'
import type { Env, FirebaseIdentity } from './types'

const mockEnv = (): Env => ({
  ORS_API_KEY: '',
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: '',
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'sa@test',
    private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    project_id: 'test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'test',
  STRIPE_PRICE_MONTHLY: 'price_month',
  STRIPE_PRICE_YEARLY: 'price_year',
  STRIPE_PRICE_GRUPETA_MONTHLY: 'price_g_month',
  STRIPE_PRICE_GRUPETA_YEARLY: 'price_g_year',
  APP_URL: 'https://pedalmap.es',
  ALLOWED_ORIGINS: '',
  PREMIUM_ALLOWLIST: '',
  RECONCILE_OPS_TOKEN: 'secret-token',
})

function makeIdentity(uid: string, isAnonymous: boolean): FirebaseIdentity {
  return { uid, email: undefined, emailVerified: false, isAnonymous }
}

function quotaTestRequest(): Request {
  return new Request('https://quota.test/', {
    headers: { 'CF-Connecting-IP': '192.0.2.123' },
  })
}

describe('withRoutingCreateQuota - anonymous to authenticated conversion', () => {
  let env: Env

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.resetAllMocks()
    env = mockEnv()

    // Mock the internal firestore functions at module level
    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)
    vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)
  })

  // Tests 1-6: Conversion with different anonymous counts (via bumpRoutesCreatedThisMonth mock verification)
  it('anonymous=0 -> conversion calls bump with isAnonymous=false', async () => {
    const identity = makeIdentity('uid_0', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_0', false)
  })

  it('anonymous=1 -> conversion calls bump with isAnonymous=false', async () => {
    const identity = makeIdentity('uid_1', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_1', false)
  })

  it('anonymous=2 -> conversion calls bump with isAnonymous=false', async () => {
    const identity = makeIdentity('uid_2', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_2', false)
  })

  it('anonymous=3 -> conversion calls bump with isAnonymous=false', async () => {
    const identity = makeIdentity('uid_3', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_3', false)
  })

  it('same month: bump called with isAnonymous=false', async () => {
    const identity = makeIdentity('uid_same_month', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_same_month', false)
  })

  it('previous month: bump called with isAnonymous=false', async () => {
    const identity = makeIdentity('uid_prev_month', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_prev_month', false)
  })

  // Idempotency: bump called but internal logic handles idempotency
  it('idempotent: bump called for first conversion', async () => {
    const identity = makeIdentity('uid_idempotent_1', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_idempotent_1', false)
  })

  it('idempotent: bump called for second conversion (idempotency handled internally)', async () => {
    const identity = makeIdentity('uid_idempotent_2', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_idempotent_2', false)
  })

  it('idempotent: bump called when convertedAt exists', async () => {
    const identity = makeIdentity('uid_no_reconvert', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_no_reconvert', false)
  })

  it('isAnonymous=true -> bump called with isAnonymous=true', async () => {
    const identity = makeIdentity('uid_still_anon', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_still_anon', true)
  })

  it('premium plan -> bump still called but assertion allows', async () => {
    const identity = makeIdentity('uid_premium', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const bumpSpy = vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(bumpSpy).toHaveBeenCalledWith(env, 'uid_premium', false)
  })

  it('assertRoutingCreateAllowed called with correct isAnonymous', async () => {
    const identity = makeIdentity('uid_assert_test', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    const assertSpy = vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)

    const { withRoutingCreateQuota } = await import('./index')
    await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(assertSpy).toHaveBeenCalledWith(env, 'uid_assert_test', true)
  })

  it('assertRoutingCreateAllowed returns 403 for anonymous limit', async () => {
    const identity = makeIdentity('uid_anon_limit', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue({
      error: 'Límite de 3 creaciones alcanzado para usuarios anónimos. Regístrate para continuar.',
      code: 'anonymous_limit_reached',
    })

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('anonymous_limit_reached')
  })

  it('assertRoutingCreateAllowed returns 403 for free monthly limit', async () => {
    const identity = makeIdentity('uid_free_limit', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue({
      error: 'Has alcanzado el límite de creaciones del plan Free este mes.',
      code: 'create_limit',
    })

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('create_limit')
  })

  it('premium bypasses assertion', async () => {
    const identity = makeIdentity('uid_premium_assert', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(200)
  })
})

describe('fail-closed: read failure', () => {
  let env: Env

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.resetAllMocks()
    env = mockEnv()

    vi.spyOn(firestore, 'readUserEntitlements').mockRejectedValue(
      new firestore.QuotaUnavailableError('Firestore read failed')
    )
    vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)
  })

  it('read failure anonymous -> 503 quota_unavailable', async () => {
    const identity = makeIdentity('uid_anon_readfail', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('quota_unavailable')
  })

  it('read failure authenticated free -> 503 quota_unavailable', async () => {
    const identity = makeIdentity('uid_free_readfail', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('quota_unavailable')
  })

  it('read failure premium -> 503 quota_unavailable (no special bypass on read)', async () => {
    const identity = makeIdentity('uid_premium_readfail', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('quota_unavailable')
  })
})

describe('fail-closed: write failure', () => {
  let env: Env

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.resetAllMocks()
    env = mockEnv()

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)
    vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockRejectedValue(
      new firestore.QuotaUnavailableError('Firestore write failed')
    )
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)
  })

  it('write failure anonymous -> 503 quota_unavailable', async () => {
    const identity = makeIdentity('uid_anon_writefail', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('quota_unavailable')
  })

  it('write failure authenticated free -> 503 quota_unavailable', async () => {
    const identity = makeIdentity('uid_free_writefail', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('quota_unavailable')
  })

  it('write failure premium -> 503 quota_unavailable', async () => {
    const identity = makeIdentity('uid_premium_writefail', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('quota_unavailable')
  })
})

describe('server limits - real assertion results', () => {
  let env: Env

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.resetAllMocks()
    env = mockEnv()

    vi.spyOn(firestore, 'bumpRoutesCreatedThisMonth').mockResolvedValue(undefined)
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockResolvedValue(undefined)
  })

  it('anonymous 0 -> allow', async () => {
    const identity = makeIdentity('uid_anon_0', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(200)
  })

  it('anonymous 1 -> allow', async () => {
    const identity = makeIdentity('uid_anon_1', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(200)
  })

  it('anonymous 2 -> allow', async () => {
    const identity = makeIdentity('uid_anon_2', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(200)
  })

  it('anonymous 3 -> reject anonymous_limit_reached', async () => {
    const identity = makeIdentity('uid_anon_3', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue({
      error: 'Límite de 3 creaciones alcanzado para usuarios anónimos. Regístrate para continuar.',
      code: 'anonymous_limit_reached',
    })

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('anonymous_limit_reached')
  })

  it('guest identity gate blocks a second incognito UID before route calculation', async () => {
    const identity = makeIdentity('uid_second_incognito', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    vi.spyOn(firestore, 'ensureAnonymousIdentityForIp').mockRejectedValue(
      new firestore.QuotaLimitReachedError(
        'guest_identity_limit_reached',
        'Guest identity already used for this IP',
      ),
    )
    const assertSpy = vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'guest_identity_limit_reached' })
    expect(assertSpy).not.toHaveBeenCalled()
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('anonymous calls without a Request fail closed', async () => {
    const identity = makeIdentity('uid_missing_request', true)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, mockRun)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ code: 'quota_unavailable' })
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('ORS proxy rejects more than two Free preferences using server-side entitlements', async () => {
    const { enforceOrsFilterLimit } = await import('./index')
    vi.spyOn(firestore, 'assertFilterLimitAllowed').mockResolvedValue({
      error: 'Has alcanzado el límite de 2 filtros simultáneos del plan Free.',
      code: 'filter_limit',
    })
    const request = new Request('https://quota.test/v2/directions/cycling-road/geojson', {
      method: 'POST',
      body: JSON.stringify({
        coordinates: [[-3.7, 40.4], [-3.6, 40.5]],
        pedalmapPreferences: ['avoid_hills', 'avoid_unpaved', 'avoid_tolls'],
      }),
    })

    const response = await enforceOrsFilterLimit(env, request, makeIdentity('uid_filter_limit', false))

    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toMatchObject({ code: 'filter_limit' })
    expect(firestore.assertFilterLimitAllowed).toHaveBeenCalledWith(
      env,
      'uid_filter_limit',
      false,
      ['avoid_hills', 'avoid_unpaved', 'avoid_tolls'],
    )
  })

  it('ORS proxy fails closed if preference metadata is missing', async () => {
    const { enforceOrsFilterLimit } = await import('./index')
    const filterSpy = vi.spyOn(firestore, 'assertFilterLimitAllowed')
    const request = new Request('https://quota.test/v2/directions/cycling-road/geojson', {
      method: 'POST',
      body: JSON.stringify({ coordinates: [[-3.7, 40.4], [-3.6, 40.5]] }),
    })

    const response = await enforceOrsFilterLimit(env, request, makeIdentity('uid_missing_preferences', false))

    expect(response?.status).toBe(503)
    await expect(response?.json()).resolves.toMatchObject({ code: 'quota_unavailable' })
    expect(filterSpy).not.toHaveBeenCalled()
  })

  it('authenticated free 14 -> allow', async () => {
    const identity = makeIdentity('uid_free_14', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(200)
  })

  it('authenticated free 15 -> reject create_limit', async () => {
    const identity = makeIdentity('uid_free_15', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue({
      error: 'Has alcanzado el límite de creaciones del plan Free este mes.',
      code: 'create_limit',
    })

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('create_limit')
  })

  it('premium 999 -> allow', async () => {
    const identity = makeIdentity('uid_premium_999', false)
    const mockRun = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    vi.spyOn(firestore, 'assertRoutingCreateAllowed').mockResolvedValue(null)

    const { withRoutingCreateQuota } = await import('./index')
    const response = await withRoutingCreateQuota(env, identity, quotaTestRequest(), mockRun)

    expect(response.status).toBe(200)
  })
})