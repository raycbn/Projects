import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Env } from './types'

var resolveEffectivePlanMock = vi.fn()
var upsertSubscriptionAndPlanMock = vi.fn()
var writeUserPlanMock = vi.fn()

vi.mock('./entitlements', () => ({
  resolveEffectivePlan: resolveEffectivePlanMock,
}))
vi.mock('./firestore', () => ({
  upsertSubscriptionAndPlan: upsertSubscriptionAndPlanMock,
  writeUserPlan: writeUserPlanMock,
}))

const mockEnv = (token = 'secret-token'): Env => ({
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
  RECONCILE_OPS_TOKEN: token,
})

function makeRequest(body: unknown, token = 'secret-token'): Request {
  return new Request('http://localhost/ops/reconcile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PedalMap-Ops-Token': token,
    },
    body: JSON.stringify(body),
  })
}

describe('handleReconcile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.resetAllMocks()
    resolveEffectivePlanMock.mockReset()
    upsertSubscriptionAndPlanMock.mockReset()
    writeUserPlanMock.mockReset()
  })

  it('rejects missing ops token', async () => {
    const env = mockEnv('expected-token')
    const { handleReconcile } = await import('./reconcile')
    const request = makeRequest({ uid: 'uid_1', dryRun: true }, '')
    const res = await handleReconcile(request, env)
    expect(res.status).toBe(401)
  })

  it('rejects incorrect ops token', async () => {
    const env = mockEnv('expected-token')
    const { handleReconcile } = await import('./reconcile')
    const request = makeRequest({ uid: 'uid_1', dryRun: true }, 'wrong-token')
    const res = await handleReconcile(request, env)
    expect(res.status).toBe(401)
  })

  it('rejects invalid uid', async () => {
    const env = mockEnv()
    const { handleReconcile } = await import('./reconcile')
    const request = makeRequest({ uid: '', dryRun: true })
    const res = await handleReconcile(request, env)
    expect(res.status).toBe(400)
  })

  it('rejects body with non-string uid', async () => {
    const env = mockEnv()
    const { handleReconcile } = await import('./reconcile')
    const request = makeRequest({ uid: 123, dryRun: true })
    const res = await handleReconcile(request, env)
    expect(res.status).toBe(400)
  })

  it('rejects body with non-boolean dryRun', async () => {
    const env = mockEnv()
    const { handleReconcile } = await import('./reconcile')
    const request = makeRequest({ uid: 'uid_1234567890', dryRun: 'true' })
    const res = await handleReconcile(request, env)
    expect(res.status).toBe(400)
  })

  it('returns free plan without writing when resolveEffectivePlan returns free', async () => {
    const env = mockEnv()
    const { handleReconcile } = await import('./reconcile')
    resolveEffectivePlanMock.mockResolvedValue({
      plan: 'free',
      allowlisted: false,
      grupetaSeat: false,
    } as any)

    const request = makeRequest({ uid: 'uid_free_123', dryRun: false })
    const res = await handleReconcile(request, env)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.plan).toBe('free')
    expect(data.updated).toBe(false)
    expect(upsertSubscriptionAndPlanMock).not.toHaveBeenCalled()
    expect(writeUserPlanMock).not.toHaveBeenCalled()
  })

  it('dry-run for premium does not write', async () => {
    const env = mockEnv()
    const { handleReconcile } = await import('./reconcile')
    resolveEffectivePlanMock.mockResolvedValue({
      plan: 'premium',
      allowlisted: false,
      grupetaSeat: false,
    } as any)

    const request = makeRequest({ uid: 'uid_premium_123', dryRun: true })
    const res = await handleReconcile(request, env)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.plan).toBe('premium')
    expect(data.dryRun).toBe(true)
    expect(data.wouldUpdate).toEqual([
      'subscriptions/uid_premium_123',
      'users/uid_premium_123.plan',
    ])
    expect(upsertSubscriptionAndPlanMock).not.toHaveBeenCalled()
    expect(writeUserPlanMock).not.toHaveBeenCalled()
  })

  it('real write for premium calls upsert and writePlan', async () => {
    const env = mockEnv()
    const { handleReconcile } = await import('./reconcile')
    resolveEffectivePlanMock.mockResolvedValue({
      plan: 'premium',
      allowlisted: false,
      grupetaSeat: false,
    } as any)

    const request = makeRequest({ uid: 'uid_premium_write_123', dryRun: false })
    const res = await handleReconcile(request, env)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.plan).toBe('premium')
    expect(data.updated).toBe(true)
    expect(data.wouldUpdate).toEqual([
      'subscriptions/uid_premium_write_123',
      'users/uid_premium_write_123.plan',
    ])
    expect(upsertSubscriptionAndPlanMock).toHaveBeenCalledTimes(1)
    expect(writeUserPlanMock).toHaveBeenCalledTimes(1)
  })

  it('is idempotent when called twice', async () => {
    const env = mockEnv()
    const { handleReconcile } = await import('./reconcile')
    resolveEffectivePlanMock.mockResolvedValue({
      plan: 'premium',
      allowlisted: false,
      grupetaSeat: false,
    } as any)

    const body = { uid: 'uid_idem_123', dryRun: false }
    const request1 = makeRequest(body)
    const request2 = makeRequest(body)

    const res1 = await handleReconcile(request1, env)
    const res2 = await handleReconcile(request2, env)

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(upsertSubscriptionAndPlanMock).toHaveBeenCalledTimes(2)
    expect(writeUserPlanMock).toHaveBeenCalledTimes(2)
  })
})
