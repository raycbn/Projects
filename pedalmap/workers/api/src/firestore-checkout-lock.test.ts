import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  claimCheckoutLock,
  finalizeCheckoutLock,
  releaseCheckoutLock,
} from './firestore'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'checkout-lock-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-checkout-lock-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-checkout-lock-test',
} as Env

type FirestoreDocument = {
  name: string
  updateTime: string
  fields: Record<string, { stringValue?: string; timestampValue?: string; booleanValue?: boolean }>
}

let lockDoc: FirestoreDocument | null
let version: number
let patchRequests: Array<{ url: URL; body: Record<string, any> }>
let deleteCount: number

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeLock(
  status: 'creating' | 'open',
  overrides: Record<string, { stringValue?: string; timestampValue?: string; booleanValue?: boolean }> = {},
): FirestoreDocument {
  return {
    name: 'projects/pedalmap-checkout-lock-test/databases/(default)/documents/checkoutLocks/uid-lock-test',
    updateTime: 'lock-v1',
    fields: {
      uid: { stringValue: 'uid-lock-test' },
      status: { stringValue: status },
      product: { stringValue: 'solo' },
      interval: { stringValue: 'year' },
      lockToken: { stringValue: 'previous-lock-token' },
      claimedAt: { timestampValue: '2000-01-01T00:00:00.000Z' },
      updatedAt: { timestampValue: '2000-01-01T00:00:00.000Z' },
      ...overrides,
    },
  }
}

beforeEach(() => {
  globalThis.crypto.subtle.importKey = (async () => ({})) as typeof globalThis.crypto.subtle.importKey
  globalThis.crypto.subtle.sign = (async () => new ArrayBuffer(0)) as typeof globalThis.crypto.subtle.sign
  lockDoc = null
  version = 1
  patchRequests = []
  deleteCount = 0

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'

    if (url.hostname === 'oauth2.googleapis.com') {
      return response({ access_token: 'local-test-token' })
    }

    if (url.pathname.endsWith('/documents/checkoutLocks/uid-lock-test') && method === 'GET') {
      return lockDoc ? response(JSON.parse(JSON.stringify(lockDoc))) : response({ error: 'not found' }, 404)
    }

    if (url.pathname.endsWith('/documents/checkoutLocks/uid-lock-test') && method === 'PATCH') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, any>
      patchRequests.push({ url, body })

      if (url.searchParams.get('currentDocument.exists') === 'false') {
        if (lockDoc) return response({ error: { status: 'ALREADY_EXISTS' } }, 409)
        lockDoc = {
          name: 'projects/pedalmap-checkout-lock-test/databases/(default)/documents/checkoutLocks/uid-lock-test',
          updateTime: `lock-v${++version}`,
          fields: body.fields,
        }
        return response({ updateTime: lockDoc.updateTime })
      }

      const expected = url.searchParams.get('currentDocument.updateTime')
      if (!lockDoc || !expected || expected !== lockDoc.updateTime) {
        return response({ error: { status: 'FAILED_PRECONDITION' } }, 412)
      }

      const masks = url.searchParams.getAll('updateMask.fieldPaths')
      for (const field of masks) {
        if (Object.prototype.hasOwnProperty.call(body.fields ?? {}, field)) {
          lockDoc.fields[field] = body.fields[field]
        } else {
          delete lockDoc.fields[field]
        }
      }
      lockDoc.updateTime = `lock-v${++version}`
      return response({ updateTime: lockDoc.updateTime })
    }

    if (url.pathname.endsWith('/documents/checkoutLocks/uid-lock-test') && method === 'DELETE') {
      deleteCount += 1
      const expected = url.searchParams.get('currentDocument.updateTime')
      if (!lockDoc || !expected || expected !== lockDoc.updateTime) {
        return response({ error: { status: 'FAILED_PRECONDITION' } }, 412)
      }
      lockDoc = null
      return response({})
    }

    return response({ error: `unexpected request ${method} ${url}` }, 500)
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.crypto.subtle.importKey = originalImportKey
  globalThis.crypto.subtle.sign = originalSign
  globalThis.fetch = originalFetch
})

describe('server-side checkout lock', () => {
  it('creates the per-user lock conditionally', async () => {
    const result = await claimCheckoutLock(env, 'uid-lock-test', 'solo', 'year')

    expect(result.kind).toBe('claimed')
    expect(lockDoc?.fields.status.stringValue).toBe('creating')
    expect(patchRequests[0]?.url.searchParams.get('currentDocument.exists')).toBe('false')
    expect(lockDoc?.fields.product.stringValue).toBe('solo')
    expect(lockDoc?.fields.interval.stringValue).toBe('year')
  })

  it('allows only one winner when two different checkout intents race to create the lock', async () => {
    const results = await Promise.all([
      claimCheckoutLock(env, 'uid-lock-test', 'solo', 'month'),
      claimCheckoutLock(env, 'uid-lock-test', 'grupeta', 'year'),
    ])

    expect(results.filter((result) => result.kind === 'claimed')).toHaveLength(1)
    expect(results.filter((result) => result.kind === 'in_progress')).toHaveLength(1)
    expect(lockDoc?.fields.status.stringValue).toBe('creating')
  })

  it('rejects a second concurrent checkout while the creating lease is live', async () => {
    lockDoc = makeLock('creating', { claimedAt: { timestampValue: new Date().toISOString() } })

    await expect(claimCheckoutLock(env, 'uid-lock-test', 'grupeta', 'month')).resolves.toEqual({
      kind: 'in_progress',
    })
    expect(patchRequests).toHaveLength(0)
  })

  it('reclaims an expired creating lease using updateTime CAS', async () => {
    lockDoc = makeLock('creating')

    const result = await claimCheckoutLock(env, 'uid-lock-test', 'grupeta', 'month')

    expect(result.kind).toBe('claimed')
    const reclaim = patchRequests.find((request) => request.url.searchParams.has('currentDocument.updateTime'))
    expect(reclaim?.url.searchParams.get('currentDocument.updateTime')).toBe('lock-v1')
    expect(reclaim?.body.fields.status.stringValue).toBe('creating')
    expect(reclaim?.body.fields.product.stringValue).toBe('grupeta')
    expect(reclaim?.body.fields.checkoutSessionId).toBeUndefined()
    expect(lockDoc?.fields.lockToken.stringValue).not.toBe('previous-lock-token')
  })

  it('returns an unexpired session for reuse, preserving its trial flag', async () => {
    lockDoc = makeLock('open', {
      checkoutSessionId: { stringValue: 'cs_existing' },
      checkoutUrl: { stringValue: 'https://checkout.stripe.com/cs_existing' },
      expiresAt: { timestampValue: new Date(Date.now() + 60_000).toISOString() },
      trial: { booleanValue: true },
    })

    const result = await claimCheckoutLock(env, 'uid-lock-test', 'solo', 'year')

    expect(result).toMatchObject({
      kind: 'existing_session',
      sessionId: 'cs_existing',
      checkoutUrl: 'https://checkout.stripe.com/cs_existing',
      product: 'solo',
      interval: 'year',
      trial: true,
      updateTime: 'lock-v1',
    })
    expect(patchRequests).toHaveLength(0)
  })

  it('reclaims a stored session after its lock expiry', async () => {
    lockDoc = makeLock('open', {
      checkoutSessionId: { stringValue: 'cs_expired' },
      checkoutUrl: { stringValue: 'https://checkout.stripe.com/cs_expired' },
      expiresAt: { timestampValue: '2000-01-01T00:00:00.000Z' },
      trial: { booleanValue: false },
    })

    const result = await claimCheckoutLock(env, 'uid-lock-test', 'grupeta', 'month')

    expect(result.kind).toBe('claimed')
    expect(lockDoc?.fields.status.stringValue).toBe('creating')
    expect(lockDoc?.fields.checkoutSessionId).toBeUndefined()
    expect(lockDoc?.fields.checkoutUrl).toBeUndefined()
  })

  it('finalizes a claimed lease to a single reusable open session', async () => {
    lockDoc = makeLock('creating', {
      lockToken: { stringValue: 'owned-lock-token' },
      claimedAt: { timestampValue: new Date().toISOString() },
    })

    await finalizeCheckoutLock(env, 'uid-lock-test', 'owned-lock-token', {
      product: 'solo',
      interval: 'year',
      sessionId: 'cs_final',
      checkoutUrl: 'https://checkout.stripe.com/cs_final',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      trial: true,
    })

    expect(lockDoc?.fields.status.stringValue).toBe('open')
    expect(lockDoc?.fields.checkoutSessionId.stringValue).toBe('cs_final')
    expect(lockDoc?.fields.trial.booleanValue).toBe(true)
    expect(lockDoc?.fields.expiresAt.timestampValue).toBeTruthy()
    expect(patchRequests.at(-1)?.url.searchParams.has('currentDocument.updateTime')).toBe(true)
  })

  it('refuses to finalize if the lock was already reclaimed by another request', async () => {
    lockDoc = makeLock('creating', { lockToken: { stringValue: 'other-owner' } })

    await expect(
      finalizeCheckoutLock(env, 'uid-lock-test', 'stale-owner', {
        product: 'solo',
        interval: 'month',
        sessionId: 'cs_stale',
        checkoutUrl: 'https://checkout.stripe.com/cs_stale',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        trial: false,
      }),
    ).rejects.toThrow('Checkout lock lease was lost')
    expect(patchRequests).toHaveLength(0)
  })

  it('releases a lock only when the session or token matches', async () => {
    lockDoc = makeLock('open', { checkoutSessionId: { stringValue: 'cs_expected' } })

    await releaseCheckoutLock(env, 'uid-lock-test', { sessionId: 'cs_not_expected' })
    expect(deleteCount).toBe(0)
    expect(lockDoc).not.toBeNull()

    await releaseCheckoutLock(env, 'uid-lock-test', { sessionId: 'cs_expected' })
    expect(deleteCount).toBe(1)
    expect(lockDoc).toBeNull()
  })

  it('releases a failed create only for the owner of the lease', async () => {
    lockDoc = makeLock('creating', { lockToken: { stringValue: 'owned-lock-token' } })

    await releaseCheckoutLock(env, 'uid-lock-test', { lockToken: 'wrong-owner' })
    expect(deleteCount).toBe(0)
    expect(lockDoc).not.toBeNull()

    await releaseCheckoutLock(env, 'uid-lock-test', { lockToken: 'owned-lock-token' })
    expect(deleteCount).toBe(1)
    expect(lockDoc).toBeNull()
  })
})
