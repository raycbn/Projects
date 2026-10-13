import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureAnonymousIdentityForIp,
  QuotaUnavailableError,
} from './firestore'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'guest-quota-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-guest-quota-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-guest-quota-test',
} as Env

type Marker = {
  name: string
  updateTime: string
  fields: Record<string, { stringValue?: string; timestampValue?: string }>
}

let markers: Map<string, Marker>
let tokenCalls: number
let patchPaths: string[]

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installCryptoMocks() {
  globalThis.crypto.subtle.importKey = (async () => ({}) as CryptoKey) as typeof globalThis.crypto.subtle.importKey
  globalThis.crypto.subtle.sign = (async (_algorithm, _key, data) => {
    const message = new TextDecoder().decode(data as BufferSource)
    let marker = 0x11
    if (message.startsWith('guest-ip:')) {
      marker = message.endsWith('192.0.2.10') ? 0x10 : 0x20
    } else if (message.endsWith('anon-a')) {
      marker = 0xa1
    } else if (message.endsWith('anon-b')) {
      marker = 0xb2
    }
    return new Uint8Array(32).fill(marker).buffer
  }) as typeof globalThis.crypto.subtle.sign
}

function installFirestoreMock() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'

    if (url.hostname === 'oauth2.googleapis.com') {
      tokenCalls += 1
      return response({ access_token: 'guest-quota-test-token' })
    }

    const match = url.pathname.match(/\/documents\/(guestIdentityLimits\/[^/]+)$/)
    if (!match) return response({ error: `Unexpected mocked request: ${method} ${url.pathname}` }, 500)
    const path = match[1]!

    if (method === 'GET') {
      const marker = markers.get(path)
      return marker ? response(marker) : response({ error: { status: 'NOT_FOUND' } }, 404)
    }

    if (method === 'PATCH') {
      patchPaths.push(path)
      if (markers.has(path)) return response({ error: { status: 'FAILED_PRECONDITION' } }, 412)
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        fields?: Marker['fields']
      }
      markers.set(path, {
        name: `projects/pedalmap-guest-quota-test/databases/(default)/documents/${path}`,
        updateTime: '2026-10-12T00:00:00.000000Z',
        fields: body.fields ?? {},
      })
      return response({ updateTime: '2026-10-12T00:00:00.000000Z' })
    }

    return response({ error: `Unexpected method ${method}` }, 405)
  }) as typeof globalThis.fetch
}

beforeEach(() => {
  vi.clearAllMocks()
  markers = new Map()
  tokenCalls = 0
  patchPaths = []
  installCryptoMocks()
  installFirestoreMock()
})

afterEach(() => {
  globalThis.crypto.subtle.importKey = originalImportKey
  globalThis.crypto.subtle.sign = originalSign
  globalThis.fetch = originalFetch
})

describe('monthly anonymous identity marker', () => {
  it('reserves one pseudonymous marker for the first guest on an IP', async () => {
    await expect(ensureAnonymousIdentityForIp(env, 'anon-a', '192.0.2.10')).resolves.toBeUndefined()

    expect(markers.size).toBe(1)
    expect(patchPaths).toHaveLength(1)
    expect(patchPaths[0]).toMatch(/^guestIdentityLimits\/\d{4}-\d{2}_[a-f0-9]{64}$/)
    expect(patchPaths[0]).not.toContain('192.0.2.10')
    const marker = [...markers.values()][0]!
    expect(marker.fields.identityHash?.stringValue).not.toBe('anon-a')
    expect(marker.fields.expiresAt?.timestampValue).toBeTypeOf('string')
  })

  it('allows the same persistent anonymous UID to continue on the same IP', async () => {
    await ensureAnonymousIdentityForIp(env, 'anon-a', '192.0.2.10')

    await expect(ensureAnonymousIdentityForIp(env, 'anon-a', '192.0.2.10')).resolves.toBeUndefined()
    expect(markers.size).toBe(1)
    expect(patchPaths).toHaveLength(1)
  })

  it('rejects a new incognito UID on an IP already bound this month', async () => {
    await ensureAnonymousIdentityForIp(env, 'anon-a', '192.0.2.10')

    await expect(
      ensureAnonymousIdentityForIp(env, 'anon-b', '192.0.2.10'),
    ).rejects.toMatchObject({ code: 'guest_identity_limit_reached' })
    expect(markers.size).toBe(1)
    expect(patchPaths).toHaveLength(1)
  })

  it('allows a first guest from a different public IP', async () => {
    await ensureAnonymousIdentityForIp(env, 'anon-a', '192.0.2.10')
    await expect(ensureAnonymousIdentityForIp(env, 'anon-b', '198.51.100.14')).resolves.toBeUndefined()
    expect(markers.size).toBe(2)
  })

  it('resolves concurrent first-use races without granting a second UID', async () => {
    const results = await Promise.allSettled([
      ensureAnonymousIdentityForIp(env, 'anon-a', '192.0.2.10'),
      ensureAnonymousIdentityForIp(env, 'anon-b', '192.0.2.10'),
    ])

    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1)
    expect(results.find((item) => item.status === 'rejected')).toMatchObject({
      reason: expect.objectContaining({ code: 'guest_identity_limit_reached' }),
    })
    expect(markers.size).toBe(1)
  })

  it('fails closed when Cloudflare does not provide the trusted client IP', async () => {
    await expect(ensureAnonymousIdentityForIp(env, 'anon-a', null)).rejects.toBeInstanceOf(
      QuotaUnavailableError,
    )
    expect(tokenCalls).toBe(0)
    expect(markers.size).toBe(0)
  })
})
