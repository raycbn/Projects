import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { claimFreeGpxExport, isoWeekKey, QuotaUnavailableError } from './firestore'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'gpx-quota-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-gpx-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-gpx-test',
} as Env

type RestDocument = {
  name: string
  updateTime: string
  fields: Record<string, any>
}

let userDoc: RestDocument
let version: number
let patchCount: number

function profileDoc(): RestDocument {
  return {
    name: 'projects/pedalmap-gpx-test/databases/(default)/documents/users/uid-gpx-test',
    updateTime: 'u-1',
    fields: {
      plan: { stringValue: 'free' },
      usage: { mapValue: { fields: { monthKey: { stringValue: '2026-10' }, routesSaved: { integerValue: '0' } } } },
    },
  }
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
  userDoc = profileDoc()
  version = 1
  patchCount = 0

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    if (url.hostname === 'oauth2.googleapis.com') {
      return response({ access_token: 'local-test-token' })
    }
    if (url.pathname.endsWith('/documents/users/uid-gpx-test') && method === 'GET') {
      return response(JSON.parse(JSON.stringify(userDoc)))
    }
    if (url.pathname.endsWith('/documents/users/uid-gpx-test') && method === 'PATCH') {
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

describe('atomic Free weekly GPX quota', () => {
  it('consumes the one weekly claim and rejects the next sequential claim', async () => {
    const first = await claimFreeGpxExport(env, 'uid-gpx-test')
    const second = await claimFreeGpxExport(env, 'uid-gpx-test')

    expect(first.allowed).toBe(true)
    expect(first.remaining).toBe(0)
    expect(second).toMatchObject({ allowed: false, reason: 'gpx_week_limit' })
    expect(userDoc.fields.usage.mapValue.fields.freeGpxWeekKey.stringValue).toBe(isoWeekKey())
    expect(userDoc.fields.usage.mapValue.fields.freeGpxUsedThisWeek.integerValue).toBe('1')
    expect(patchCount).toBe(1)
  })

  it('does not grant two successful claims when requests race', async () => {
    const results = await Promise.allSettled([
      claimFreeGpxExport(env, 'uid-gpx-test'),
      claimFreeGpxExport(env, 'uid-gpx-test'),
    ])
    const allowedCount = results.filter(
      (result) => result.status === 'fulfilled' && result.value.allowed,
    ).length

    expect(allowedCount).toBe(1)
    expect(userDoc.fields.usage.mapValue.fields.freeGpxUsedThisWeek.integerValue).toBe('1')
    expect(patchCount).toBeLessThanOrEqual(2)
  })

  it('fails closed when the server-side quota authority is missing', async () => {
    const noServiceAccount = {
      ...env,
      FIREBASE_SERVICE_ACCOUNT: undefined,
    } as unknown as Env
    await expect(claimFreeGpxExport(noServiceAccount, 'uid-gpx-test')).rejects.toBeInstanceOf(
      QuotaUnavailableError,
    )
  })
})
