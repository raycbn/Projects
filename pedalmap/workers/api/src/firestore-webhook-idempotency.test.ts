import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { claimWebhookEvent } from './firestore'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'webhook-lease-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-webhook-lease-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-webhook-lease-test',
} as Env

type WebhookDoc = {
  name: string
  updateTime: string
  fields: Record<string, { stringValue?: string; timestampValue?: string }>
}

let doc: WebhookDoc
let createConflict = true
let reclaimStatus = 200
let patchBodies: Array<{ url: string; body: Record<string, any> }>

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function processingDoc(claimedAt: string, status = 'processing'): WebhookDoc {
  return {
    name: 'projects/pedalmap-webhook-lease-test/databases/(default)/documents/webhookEvents/evt_lease_test',
    updateTime: 'webhook-v1',
    fields: {
      eventId: { stringValue: 'evt_lease_test' },
      eventType: { stringValue: 'customer.subscription.updated' },
      claimedAt: { timestampValue: claimedAt },
      status: { stringValue: status },
    },
  }
}

beforeEach(() => {
  globalThis.crypto.subtle.importKey = (async () => ({})) as typeof globalThis.crypto.subtle.importKey
  globalThis.crypto.subtle.sign = (async () => new ArrayBuffer(0)) as typeof globalThis.crypto.subtle.sign
  doc = processingDoc('2000-01-01T00:00:00.000Z')
  createConflict = true
  reclaimStatus = 200
  patchBodies = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'

    if (url.hostname === 'oauth2.googleapis.com') {
      return response({ access_token: 'local-test-token' })
    }

    if (url.pathname.endsWith('/documents/webhookEvents/evt_lease_test') && method === 'PATCH') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, any>
      patchBodies.push({ url: url.toString(), body })

      if (url.searchParams.has('currentDocument.exists')) {
        return createConflict ? response({ error: 'exists' }, 409) : response({}, 200)
      }

      if (url.searchParams.has('currentDocument.updateTime')) {
        if (reclaimStatus !== 200) return response({ error: 'precondition failed' }, reclaimStatus)
        const fields = body.fields ?? {}
        doc.fields.status = fields.status ?? doc.fields.status
        doc.fields.claimedAt = fields.claimedAt ?? doc.fields.claimedAt
        doc.updateTime = 'webhook-v2'
        return response({ updateTime: doc.updateTime })
      }
    }

    if (url.pathname.endsWith('/documents/webhookEvents/evt_lease_test') && method === 'GET') {
      return response(JSON.parse(JSON.stringify(doc)))
    }

    return response({ error: `unexpected request ${method} ${url}` }, 500)
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.crypto.subtle.importKey = originalImportKey
  globalThis.crypto.subtle.sign = originalSign
  globalThis.fetch = originalFetch
})

describe('Stripe webhook event lease and idempotency', () => {
  it('reclaims an expired event with CAS and refreshes claimedAt', async () => {
    doc = processingDoc('2000-01-01T00:00:00.000Z')

    const firstClaim = await claimWebhookEvent(env, 'evt_lease_test', 'customer.subscription.updated')

    expect(firstClaim).toBe('claimed')
    const reclaim = patchBodies.find((entry) => entry.url.includes('currentDocument.updateTime'))
    expect(reclaim).toBeDefined()
    expect(reclaim?.url).toContain('updateMask.fieldPaths=status')
    expect(reclaim?.url).toContain('updateMask.fieldPaths=claimedAt')
    expect(reclaim?.url).toContain('currentDocument.updateTime=')
    expect(reclaim?.body.fields.status.stringValue).toBe('processing')
    expect(new Date(reclaim?.body.fields.claimedAt.timestampValue).getTime()).toBeGreaterThan(
      new Date('2000-01-01T00:00:00.000Z').getTime(),
    )

    const secondClaim = await claimWebhookEvent(env, 'evt_lease_test', 'customer.subscription.updated')
    expect(secondClaim).toBe('in_progress')
    expect(patchBodies.filter((entry) => entry.url.includes('currentDocument.updateTime'))).toHaveLength(1)
  })

  it('asks Stripe to retry when another worker holds a live lease', async () => {
    doc = processingDoc(new Date().toISOString())

    await expect(claimWebhookEvent(env, 'evt_lease_test', 'customer.subscription.updated')).resolves.toBe(
      'in_progress',
    )
    expect(patchBodies.filter((entry) => entry.url.includes('currentDocument.updateTime'))).toHaveLength(0)
  })

  it('acknowledges an event as duplicate only after it was completed', async () => {
    doc = processingDoc(new Date().toISOString(), 'completed')

    await expect(claimWebhookEvent(env, 'evt_lease_test', 'customer.subscription.updated')).resolves.toBe(
      'duplicate',
    )
    expect(patchBodies.filter((entry) => entry.url.includes('currentDocument.updateTime'))).toHaveLength(0)
  })

  it('returns in_progress if another worker wins the expired-lease CAS race', async () => {
    doc = processingDoc('2000-01-01T00:00:00.000Z')
    reclaimStatus = 412

    await expect(claimWebhookEvent(env, 'evt_lease_test', 'customer.subscription.updated')).resolves.toBe(
      'in_progress',
    )
  })

  it('fails closed on an unknown event state instead of acknowledging a possible lost event', async () => {
    doc = processingDoc(new Date().toISOString(), 'unknown-state')

    await expect(claimWebhookEvent(env, 'evt_lease_test', 'customer.subscription.updated')).resolves.toBe(
      'failed',
    )
  })
})
