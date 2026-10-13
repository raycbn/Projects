import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupExpiredGuestIdentityMarkers } from './firestore'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'guest-cleanup-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-guest-cleanup-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-guest-cleanup-test',
} as Env

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let requests: Array<{ url: string; method: string; body?: Record<string, unknown> }>
let deletePaths: string[]

beforeEach(() => {
  vi.clearAllMocks()
  requests = []
  deletePaths = []
  globalThis.crypto.subtle.importKey = (async () => ({}) as CryptoKey) as typeof globalThis.crypto.subtle.importKey
  globalThis.crypto.subtle.sign = (async () => new Uint8Array(256).fill(7).buffer) as typeof globalThis.crypto.subtle.sign
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    let body: Record<string, unknown> | undefined
    if (typeof init?.body === 'string') body = JSON.parse(init.body) as Record<string, unknown>
    requests.push({ url, method, body })

    if (url.includes('oauth2.googleapis.com/token')) {
      return response({ access_token: 'guest-cleanup-test-token' })
    }
    if (url.endsWith('/documents:runQuery') && method === 'POST') {
      return response([
        {
          document: {
            name: 'projects/pedalmap-guest-cleanup-test/databases/(default)/documents/guestIdentityLimits/2026-01_expired',
            fields: { expiresAt: { timestampValue: '2000-01-01T00:00:00.000Z' } },
          },
        },
        {
          document: {
            name: 'projects/pedalmap-guest-cleanup-test/databases/(default)/documents/guestIdentityLimits/2026-01_future',
            fields: { expiresAt: { timestampValue: '2099-01-01T00:00:00.000Z' } },
          },
        },
        {
          document: {
            name: 'projects/pedalmap-guest-cleanup-test/databases/(default)/documents/users/should-never-delete',
            fields: { expiresAt: { timestampValue: '2000-01-01T00:00:00.000Z' } },
          },
        },
        { readTime: '2026-10-13T00:00:00.000Z' },
      ])
    }
    if (method === 'DELETE' && url.includes('/documents/guestIdentityLimits/')) {
      deletePaths.push(url)
      return new Response(null, { status: 200 })
    }
    return response({ error: 'Unexpected mocked request' }, 500)
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.crypto.subtle.importKey = originalImportKey
  globalThis.crypto.subtle.sign = originalSign
  globalThis.fetch = originalFetch
})

describe('Spark-compatible guest marker retention', () => {
  it('deletes only expired guest markers in a bounded batch', async () => {
    await expect(cleanupExpiredGuestIdentityMarkers(env, 1000)).resolves.toBe(1)

    const query = requests.find(request => request.url.endsWith('/documents:runQuery'))
    expect(query?.body?.structuredQuery).toMatchObject({ limit: 500 })
    expect(deletePaths).toHaveLength(1)
    expect(deletePaths[0]).toContain('guestIdentityLimits/2026-01_expired')
    expect(deletePaths[0]).not.toContain('guestIdentityLimits/2026-01_future')
    expect(deletePaths[0]).not.toContain('should-never-delete')
  })

  it('returns zero when the query has no expired documents', async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) return response({ access_token: 'guest-cleanup-test-token' })
      if (url.endsWith('/documents:runQuery')) return response([{ readTime: '2026-10-13T00:00:00.000Z' }])
      return original(input, init)
    }) as typeof globalThis.fetch

    await expect(cleanupExpiredGuestIdentityMarkers(env)).resolves.toBe(0)
  })
})
