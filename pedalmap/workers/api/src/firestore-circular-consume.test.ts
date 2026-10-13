import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  consumeFreeCircular,
  FREE_MAX_CIRCULAR_PER_MONTH,
  QuotaLimitReachedError,
  QuotaUnavailableError,
  utcMonthKey,
} from './firestore'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'circular-quota-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-circular-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-circular-test',
} as Env

type RestDocument = {
  name: string
  updateTime: string
  fields: Record<string, any>
}
let userDoc: RestDocument
let version: number
let patchCount: number

function profileDoc(
  used: number,
  monthKey = utcMonthKey(),
  routesCreatedThisMonth = 0,
): RestDocument {
  return {
    name: 'projects/pedalmap-circular-test/databases/(default)/documents/users/uid-circular-test',
    updateTime: 'u-1',
    fields: {
      plan: { stringValue: 'free' },
      usage: {
        mapValue: {
          fields: {
            monthKey: { stringValue: monthKey },
            freeCircularUsedThisMonth: { integerValue: String(used) },
            routesCreatedThisMonth: { integerValue: String(routesCreatedThisMonth) },
            routesSaved: { integerValue: '0' },
          },
        },
      },
    },
  }
}

function previousUtcMonthKey(): string {
  const date = new Date(`${utcMonthKey()}-01T00:00:00.000Z`)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return date.toISOString().slice(0, 7)
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  globalThis.crypto.subtle.importKey = (async () => ({})) as typeof globalThis.crypto.subtle.importKey
  globalThis.crypto.subtle.sign = (async () => new ArrayBuffer(0)) as typeof globalThis.crypto.subtle.sign
  userDoc = profileDoc(0)
  version = 1
  patchCount = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    if (url.hostname === 'oauth2.googleapis.com') {
      return response({ access_token: 'local-test-token' })
    }
    if (url.pathname.endsWith('/documents/users/uid-circular-test') && method === 'GET') {
      return response(JSON.parse(JSON.stringify(userDoc)))
    }
    if (url.pathname.endsWith('/documents/users/uid-circular-test') && method === 'PATCH') {
      patchCount += 1
      const expected = url.searchParams.get('currentDocument.updateTime')
      if (!expected || expected !== userDoc.updateTime) {
        return response({ error: { status: 'FAILED_PRECONDITION' } }, 412)
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        fields?: { usage?: { mapValue?: { fields?: Record<string, any> } }; updatedAt?: unknown }
      }
      if (body.fields?.usage?.mapValue?.fields) {
        userDoc.fields.usage = { mapValue: { fields: body.fields.usage.mapValue.fields } }
      }
      if (body.fields?.updatedAt) userDoc.fields.updatedAt = body.fields.updatedAt
      userDoc.updateTime = `u-${++version}`
      return response({ updateTime: userDoc.updateTime })
    }
    return response({ error: `Unexpected mocked request ${method} ${url}` }, 500)
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.crypto.subtle.importKey = originalImportKey
  globalThis.crypto.subtle.sign = originalSign
  globalThis.fetch = originalFetch
})

describe('atomic circular objective quota consumption', () => {
  it('rejects consumption if another request used the Free slot while routing was in progress', async () => {
    userDoc = profileDoc(FREE_MAX_CIRCULAR_PER_MONTH)

    await expect(consumeFreeCircular(env, 'uid-circular-test')).rejects.toBeInstanceOf(
      QuotaLimitReachedError,
    )
    expect(patchCount).toBe(0)
    expect(userDoc.fields.usage.mapValue.fields.freeCircularUsedThisMonth.integerValue).toBe('1')
  })

  it('consumes only one slot and uses CAS for racing requests', async () => {
    const results = await Promise.allSettled([
      consumeFreeCircular(env, 'uid-circular-test'),
      consumeFreeCircular(env, 'uid-circular-test'),
    ])
    const successful = results.filter((result) => result.status === 'fulfilled')
    const denied = results.filter((result) => result.status === 'rejected')

    expect(successful).toHaveLength(1)
    expect(denied).toHaveLength(1)
    expect(denied[0]?.status === 'rejected' && denied[0].reason).toBeInstanceOf(
      QuotaUnavailableError,
    )
    expect(userDoc.fields.usage.mapValue.fields.freeCircularUsedThisMonth.integerValue).toBe('1')
  })

  it('bypasses the circular counter for Premium at commit time', async () => {
    userDoc = profileDoc(FREE_MAX_CIRCULAR_PER_MONTH)
    userDoc.fields.plan = { stringValue: 'premium' }

    const result = await consumeFreeCircular(env, 'uid-circular-test')

    expect(result).toEqual({ allowed: true, remaining: Number.POSITIVE_INFINITY })
    expect(patchCount).toBe(0)
    expect(userDoc.fields.usage.mapValue.fields.freeCircularUsedThisMonth.integerValue).toBe('1')
  })

  it('resets the previous month route count when Objetivo is the first use of a new month', async () => {
    userDoc = profileDoc(1, previousUtcMonthKey(), 15)

    const result = await consumeFreeCircular(env, 'uid-circular-test')

    const usage = userDoc.fields.usage.mapValue.fields
    expect(result).toEqual({ allowed: true, remaining: 0 })
    expect(usage.monthKey.stringValue).toBe(utcMonthKey())
    expect(usage.routesCreatedThisMonth.integerValue).toBe('0')
    expect(usage.freeCircularUsedThisMonth.integerValue).toBe('1')
    expect(patchCount).toBe(1)
  })
})
