import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { upsertSubscriptionAndPlan } from './firestore'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'subscription-upsert-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-subscription-upsert-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-subscription-upsert-test',
} as Env

let subVersion: number
let userVersion: number
let subWriteStatus: number
let userWriteStatus: number
let calls: Array<{ url: URL; method: string; body?: Record<string, any> }>

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  globalThis.crypto.subtle.importKey = (async () => ({})) as typeof globalThis.crypto.subtle.importKey
  globalThis.crypto.subtle.sign = (async () => new ArrayBuffer(0)) as typeof globalThis.crypto.subtle.sign
  subVersion = 1
  userVersion = 1
  subWriteStatus = 200
  userWriteStatus = 200
  calls = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    if (url.hostname === 'oauth2.googleapis.com') {
      return response({ access_token: 'local-test-token' })
    }
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, any> : undefined
    calls.push({ url, method, body })

    if (url.pathname.endsWith('/documents/subscriptions/uid-sub-upsert') && method === 'GET') {
      return response({
        name: 'projects/pedalmap-subscription-upsert-test/databases/(default)/documents/subscriptions/uid-sub-upsert',
        updateTime: `sub-v${subVersion}`,
        fields: {
          userId: { stringValue: 'uid-sub-upsert' },
          stripeCustomerId: { stringValue: 'cus_existing' },
          soloSubscriptionId: { stringValue: 'sub_old' },
          soloStatus: { stringValue: 'canceled' },
          annualTrialUsed: { booleanValue: true },
        },
      })
    }

    if (url.pathname.endsWith('/documents/subscriptions/uid-sub-upsert') && method === 'PATCH') {
      const expected = url.searchParams.get('currentDocument.updateTime')
      if (expected !== `sub-v${subVersion}`) return response({ error: 'stale subscription version' }, 412)
      if (subWriteStatus !== 200) return response({ error: 'subscription CAS conflict' }, subWriteStatus)
      subVersion += 1
      return response({ updateTime: `sub-v${subVersion}` })
    }

    if (url.pathname.endsWith('/documents/users/uid-sub-upsert') && method === 'GET') {
      return response({
        name: 'projects/pedalmap-subscription-upsert-test/databases/(default)/documents/users/uid-sub-upsert',
        updateTime: `user-v${userVersion}`,
        fields: { plan: { stringValue: 'free' } },
      })
    }

    if (url.pathname.endsWith('/documents/users/uid-sub-upsert') && method === 'PATCH') {
      const expected = url.searchParams.get('currentDocument.updateTime')
      if (expected !== `user-v${userVersion}`) return response({ error: 'stale user version' }, 412)
      if (userWriteStatus !== 200) return response({ error: 'user CAS conflict' }, userWriteStatus)
      userVersion += 1
      return response({ updateTime: `user-v${userVersion}` })
    }

    return response({ error: `unexpected request ${method} ${url}` }, 500)
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.crypto.subtle.importKey = originalImportKey
  globalThis.crypto.subtle.sign = originalSign
  global.fetch = originalFetch
})

const input = {
  uid: 'uid-sub-upsert',
  plan: 'premium' as const,
  status: 'active',
  stripeCustomerId: 'cus_existing',
  stripeSubscriptionId: 'sub_new',
  product: 'solo' as const,
  soloSubscriptionId: 'sub_new',
  soloStatus: 'active',
  annualTrialUsed: true,
}

describe('concurrency-safe Stripe subscription persistence', () => {
  it('uses CAS for subscription state, then CAS for the user plan', async () => {
    await upsertSubscriptionAndPlan(env, input)

    const subPatch = calls.find((call) => call.url.pathname.endsWith('/documents/subscriptions/uid-sub-upsert') && call.method === 'PATCH')
    const userGet = calls.find((call) => call.url.pathname.endsWith('/documents/users/uid-sub-upsert') && call.method === 'GET')
    const userPatch = calls.find((call) => call.url.pathname.endsWith('/documents/users/uid-sub-upsert') && call.method === 'PATCH')

    expect(subPatch?.url.searchParams.get('currentDocument.updateTime')).toBe('sub-v1')
    expect(userGet).toBeDefined()
    expect(userPatch?.url.searchParams.get('currentDocument.updateTime')).toBe('user-v1')
    expect(calls.findIndex((call) => call.method === 'PATCH' && call.url.pathname.endsWith('/documents/subscriptions/uid-sub-upsert'))).toBeLessThan(
      calls.findIndex((call) => call.method === 'PATCH' && call.url.pathname.endsWith('/documents/users/uid-sub-upsert')),
    )
  })

  it('rejects a webhook merge based on a subscription snapshot that is already stale', async () => {
    await expect(
      upsertSubscriptionAndPlan(env, {
        ...input,
        expectedExistingUpdateTime: 'sub-v0',
      }),
    ).rejects.toThrow('Subscription changed concurrently; retry webhook')

    expect(calls.some(
      (call) => call.url.pathname.endsWith('/documents/subscriptions/uid-sub-upsert') && call.method === 'PATCH',
    )).toBe(false)
    expect(calls.some(
      (call) => call.url.pathname.endsWith('/documents/users/uid-sub-upsert') && call.method === 'PATCH',
    )).toBe(false)
  })

  it('does not update the profile plan when the subscription CAS loses a race', async () => {
    subWriteStatus = 412

    await expect(upsertSubscriptionAndPlan(env, input)).rejects.toThrow('subscriptions write failed: 412')
    expect(calls.some((call) => call.url.pathname.endsWith('/documents/users/uid-sub-upsert') && call.method === 'PATCH')).toBe(false)
  })

  it('fails visibly when the user-plan CAS conflicts so the webhook can retry', async () => {
    userWriteStatus = 412

    await expect(upsertSubscriptionAndPlan(env, input)).rejects.toThrow('users.plan write failed: 412')
    expect(calls.some((call) => call.url.pathname.endsWith('/documents/subscriptions/uid-sub-upsert') && call.method === 'PATCH')).toBe(true)
  })
})
