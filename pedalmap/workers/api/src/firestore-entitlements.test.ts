import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkFreeCircularLimit,
  readUserEntitlements,
  utcMonthKey,
  QuotaUnavailableError,
  type UserEntitlements,
} from './firestore'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'quota-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-quota-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-quota-test',
} as Env

function firestoreUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    fields: {
      plan: { stringValue: 'free' },
      usage: {
        mapValue: {
          fields: {
            monthKey: { stringValue: utcMonthKey() },
            routesSaved: { integerValue: '0' },
            routesCreatedThisMonth: { integerValue: '0' },
            freeCircularUsedThisMonth: { integerValue: '0' },
            ...overrides,
          },
        },
      },
    },
  }
}

let documentResponse: ReturnType<typeof firestoreUserDoc>

beforeEach(() => {
  globalThis.crypto.subtle.importKey = (async () => ({})) as typeof globalThis.crypto.subtle.importKey
  globalThis.crypto.subtle.sign = (async () => new ArrayBuffer(0)) as typeof globalThis.crypto.subtle.sign

  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'local-test-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('/documents/users/')) {
      return new Response(JSON.stringify(documentResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('{}', { status: 404 })
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.crypto.subtle.importKey = originalImportKey
  globalThis.crypto.subtle.sign = originalSign
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('readUserEntitlements quota fields', () => {
  it('reads freeCircularUsedThisMonth and blocks a second Free circular objective', async () => {
    documentResponse = firestoreUserDoc({ freeCircularUsedThisMonth: { integerValue: '1' } })

    const entitlements: UserEntitlements = await readUserEntitlements(env, 'uid-circular-used')
    expect(entitlements.freeCircularUsedThisMonth).toBe(1)

    const result = await checkFreeCircularLimit(env, 'uid-circular-used')
    expect(result).toMatchObject({ code: 'free_circular_limit' })
  })

  it('treats an absent circular counter as zero', async () => {
    const { freeCircularUsedThisMonth: _removed, ...usage } = firestoreUserDoc().fields.usage.mapValue.fields
    documentResponse = {
      fields: {
        plan: { stringValue: 'free' },
        usage: { mapValue: { fields: usage } },
      },
    }

    const entitlements = await readUserEntitlements(env, 'uid-circular-missing')
    expect(entitlements.freeCircularUsedThisMonth).toBe(0)
    expect(await checkFreeCircularLimit(env, 'uid-circular-missing')).toBeNull()
  })

  it('normalizes Firestore network errors to QuotaUnavailableError', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'local-test-token' }), { status: 200 })
      }
      throw new TypeError('network unavailable')
    }) as typeof globalThis.fetch

    await expect(checkFreeCircularLimit(env, 'uid-network-failure')).rejects.toBeInstanceOf(
      QuotaUnavailableError,
    )
  })

  it('normalizes service-account token failures to QuotaUnavailableError', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 401 }),
    ) as typeof globalThis.fetch

    await expect(checkFreeCircularLimit(env, 'uid-token-failure')).rejects.toBeInstanceOf(
      QuotaUnavailableError,
    )
  })
})
