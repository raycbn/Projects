import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  bumpRoutesCreatedThisMonth,
  FREE_MAX_ROUTES_CREATED_PER_MONTH,
  QuotaLimitReachedError,
  utcMonthKey,
} from './firestore'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'create-quota-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-create-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-create-test',
} as Env

type RestDocument = {
  name: string
  updateTime: string
  fields: Record<string, any>
}

let userDoc: RestDocument
let version: number
let patchCount: number

function usageDoc(overrides: Record<string, unknown> = {}, monthKey = utcMonthKey()): RestDocument {
  return {
    name: 'projects/pedalmap-create-test/databases/(default)/documents/users/uid-create-test',
    updateTime: 'u-1',
    fields: {
      plan: { stringValue: 'free' },
      usage: {
        mapValue: {
          fields: {
            routesSaved: { integerValue: '0' },
            routesCreatedThisMonth: { integerValue: '0' },
            monthKey: { stringValue: monthKey },
            anonymousRoutesCreated: { integerValue: '0' },
            ...overrides,
          },
        },
      },
    },
  }
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function previousUtcMonthKey(): string {
  const date = new Date(`${utcMonthKey()}-01T00:00:00.000Z`)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return date.toISOString().slice(0, 7)
}

beforeEach(() => {
  globalThis.crypto.subtle.importKey = (async () => ({})) as typeof globalThis.crypto.subtle.importKey
  globalThis.crypto.subtle.sign = (async () => new ArrayBuffer(0)) as typeof globalThis.crypto.subtle.sign
  userDoc = usageDoc()
  version = 1
  patchCount = 0

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'

    if (url.hostname === 'oauth2.googleapis.com') {
      return response({ access_token: 'local-test-token' })
    }

    if (url.pathname.endsWith('/documents/users/uid-create-test') && method === 'GET') {
      return response(JSON.parse(JSON.stringify(userDoc)))
    }

    if (url.pathname.endsWith('/documents/users/uid-create-test') && method === 'PATCH') {
      patchCount += 1
      const expectedVersion = url.searchParams.get('currentDocument.updateTime')
      if (!expectedVersion || expectedVersion !== userDoc.updateTime) {
        return response({ error: { status: 'FAILED_PRECONDITION' } }, 412)
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        fields?: { usage?: { mapValue?: { fields?: Record<string, unknown> } }; updatedAt?: unknown }
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

describe('atomic monthly/anonymous route creation quota', () => {
  it('rejects a sequential Free creation when the monthly counter is already full', async () => {
    userDoc = usageDoc({
      routesCreatedThisMonth: { integerValue: String(FREE_MAX_ROUTES_CREATED_PER_MONTH) },
    })

    await expect(bumpRoutesCreatedThisMonth(env, 'uid-create-test', false)).rejects.toMatchObject({
      code: 'create_limit',
    })
    expect(patchCount).toBe(0)
  })

  it('rejects a sequential anonymous creation when the lifetime counter is already full', async () => {
    userDoc = usageDoc({
      anonymousRoutesCreated: { integerValue: '3' },
    })

    await expect(bumpRoutesCreatedThisMonth(env, 'uid-create-test', true)).rejects.toBeInstanceOf(
      QuotaLimitReachedError,
    )
    expect(patchCount).toBe(0)
  })

  it('does not apply the Free monthly ceiling to a Premium user', async () => {
    userDoc = usageDoc({
      routesCreatedThisMonth: { integerValue: String(FREE_MAX_ROUTES_CREATED_PER_MONTH) },
    })
    userDoc.fields.plan = { stringValue: 'premium' }

    await expect(bumpRoutesCreatedThisMonth(env, 'uid-create-test', false)).resolves.toBeUndefined()
    expect(userDoc.fields.usage.mapValue.fields.routesCreatedThisMonth.integerValue).toBe(
      String(FREE_MAX_ROUTES_CREATED_PER_MONTH + 1),
    )
    expect(patchCount).toBe(1)
  })

  it('does not let two concurrent requests overwrite the final monthly slot', async () => {
    userDoc = usageDoc({
      routesCreatedThisMonth: { integerValue: String(FREE_MAX_ROUTES_CREATED_PER_MONTH - 1) },
    })

    const outcomes = await Promise.allSettled([
      bumpRoutesCreatedThisMonth(env, 'uid-create-test', false),
      bumpRoutesCreatedThisMonth(env, 'uid-create-test', false),
    ])

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1)
    expect(userDoc.fields.usage.mapValue.fields.routesCreatedThisMonth.integerValue).toBe(
      String(FREE_MAX_ROUTES_CREATED_PER_MONTH),
    )
  })

  it('converts same-month anonymous creations only once when the user registers', async () => {
    userDoc = usageDoc({
      routesCreatedThisMonth: { integerValue: '3' },
      anonymousRoutesCreated: { integerValue: '3' },
    })

    await bumpRoutesCreatedThisMonth(env, 'uid-create-test', false)

    const fields = userDoc.fields.usage.mapValue.fields
    expect(fields.routesCreatedThisMonth.integerValue).toBe('4')
    expect(fields.preConversionAnonymousCreates.integerValue).toBe('3')
    expect(fields.convertedAt.timestampValue).toBeTypeOf('string')
  })

  it('resets the prior-month route and circular counters when a user creates a route in the new month', async () => {
    userDoc = usageDoc({
      routesCreatedThisMonth: { integerValue: '15' },
      freeCircularUsedThisMonth: { integerValue: '1' },
      anonymousRoutesCreated: { integerValue: '3' },
    }, previousUtcMonthKey())

    await bumpRoutesCreatedThisMonth(env, 'uid-create-test', false)

    const fields = userDoc.fields.usage.mapValue.fields
    expect(fields.monthKey.stringValue).toBe(utcMonthKey())
    expect(fields.routesCreatedThisMonth.integerValue).toBe('1')
    expect(fields.freeCircularUsedThisMonth.integerValue).toBe('0')
    expect(fields.preConversionAnonymousCreates.integerValue).toBe('3')
  })
})
