import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { handleSetWindAlert, setWindAlertEnabledServerSide } from './windAlert'
import type { FirebaseIdentity } from './firebaseAuth'
import type { Env } from './types'

const originalImportKey = globalThis.crypto.subtle.importKey
const originalSign = globalThis.crypto.subtle.sign
const originalFetch = globalThis.fetch

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'wind-quota-test@example.invalid',
    private_key: '-----BEGIN PRIVATE KEY-----AQID-----END PRIVATE KEY-----',
    project_id: 'pedalmap-wind-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
  FIREBASE_PROJECT_ID: 'pedalmap-wind-test',
} as Env

type RestDoc = {
  name: string
  updateTime: string
  fields: Record<string, any>
}

let userDoc: RestDoc
let routes: Map<string, RestDoc>
let version: number
let forceOversizedRouteQuery: boolean

function routeDoc(id: string, windAlertEnabled = false): RestDoc {
  return {
    name: `projects/pedalmap-wind-test/databases/(default)/documents/routes/${id}`,
    updateTime: `r-${id}-1`,
    fields: {
      userId: { stringValue: 'uid-wind-test' },
      title: { stringValue: id },
      windAlertEnabled: { booleanValue: windAlertEnabled },
    },
  }
}

function profileDoc(plan: 'free' | 'premium' = 'free'): RestDoc {
  return {
    name: 'projects/pedalmap-wind-test/databases/(default)/documents/users/uid-wind-test',
    updateTime: 'u-1',
    fields: {
      plan: { stringValue: plan },
      usage: { mapValue: { fields: { routesSaved: { integerValue: '2' } } } },
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
  routes = new Map([
    ['route-a', routeDoc('route-a')],
    ['route-b', routeDoc('route-b')],
  ])
  version = 1
  forceOversizedRouteQuery = false

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url.includes('oauth2.googleapis.com/token')) {
      return response({ access_token: 'local-test-token' })
    }

    if (url.includes('/documents:runQuery') && method === 'POST') {
      if (forceOversizedRouteQuery) {
        return response(Array.from({ length: 1000 }, (_, index) => ({
          document: routeDoc(`legacy-route-${index}`, false),
        })))
      }
      const docs = [...routes.values()].filter((doc) =>
        doc.fields.userId?.stringValue === 'uid-wind-test' &&
        doc.fields.windAlertEnabled?.booleanValue === true,
      )
      return response(docs.map((document) => ({ document })))
    }

    if (url.includes('/documents:commit') && method === 'POST') {
      const request = JSON.parse(String(init?.body ?? '{}')) as {
        writes?: Array<{
          update: { name: string; fields: Record<string, any> }
          updateMask?: { fieldPaths?: string[] }
          currentDocument?: { updateTime?: string }
        }>
      }
      const writes = request.writes ?? []
      const targets = writes.map((write) => {
        if (write.update.name.endsWith('/users/uid-wind-test')) return userDoc
        const routeId = write.update.name.split('/').pop() ?? ''
        return routes.get(routeId)
      })
      if (targets.some((target, index) => !target || target.updateTime !== writes[index]?.currentDocument?.updateTime)) {
        return response({ error: { status: 'ABORTED' } }, 409)
      }

      // Validate all preconditions first, then apply all documents atomically.
      for (let index = 0; index < writes.length; index += 1) {
        const write = writes[index]!
        const target = targets[index]!
        for (const fieldPath of write.updateMask?.fieldPaths ?? Object.keys(write.update.fields)) {
          if (fieldPath === 'usage') {
            target.fields.usage = write.update.fields.usage
          } else {
            target.fields[fieldPath] = write.update.fields[fieldPath]
          }
        }
        target.updateTime = `v-${++version}`
      }
      return response({ writeResults: writes.map(() => ({})) })
    }

    if (url.includes('/documents/routes/')) {
      const id = url.split('/documents/routes/').pop() ?? ''
      const found = routes.get(id)
      return found ? response(found) : response({ error: 'not found' }, 404)
    }

    if (url.includes('/documents/users/')) {
      return userDoc ? response(userDoc) : response({ error: 'not found' }, 404)
    }

    return response({ error: `unexpected mocked request ${method} ${url}` }, 500)
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.crypto.subtle.importKey = originalImportKey
  globalThis.crypto.subtle.sign = originalSign
  globalThis.fetch = originalFetch
})

describe('server-side Wind Alerts quota', () => {
  it('allows only one of two concurrent Free route activations', async () => {
    const results = await Promise.all([
      setWindAlertEnabledServerSide(env, 'uid-wind-test', 'route-a', true),
      setWindAlertEnabledServerSide(env, 'uid-wind-test', 'route-b', true),
    ])

    expect(results.filter((result) => result.allowed)).toHaveLength(1)
    expect(results.filter((result) => !result.allowed)).toEqual([
      { allowed: false, code: 'wind_alert_limit' },
    ])
    expect([...routes.values()].filter((route) => route.fields.windAlertEnabled.booleanValue)).toHaveLength(1)
    expect(userDoc.fields.usage.mapValue.fields.windAlertRouteId.stringValue).toMatch(/^route-[ab]$/)
  })

  it('rejects another Free alert when a legacy active alert already exists', async () => {
    const active = routes.get('route-a')!
    active.fields.windAlertEnabled = { booleanValue: true }

    const result = await setWindAlertEnabledServerSide(env, 'uid-wind-test', 'route-b', true)

    expect(result).toEqual({ allowed: false, code: 'wind_alert_limit' })
    expect(routes.get('route-b')!.fields.windAlertEnabled.booleanValue).toBe(false)
  })

  it('does not apply the Free one-route cap to Premium', async () => {
    userDoc = profileDoc('premium')

    const results = await Promise.all([
      setWindAlertEnabledServerSide(env, 'uid-wind-test', 'route-a', true),
      setWindAlertEnabledServerSide(env, 'uid-wind-test', 'route-b', true),
    ])

    expect(results.every((result) => result.allowed)).toBe(true)
    expect([...routes.values()].filter((route) => route.fields.windAlertEnabled.booleanValue)).toHaveLength(2)
  })

  it('allows disabling an alert and releasing the per-user slot atomically', async () => {
    const active = routes.get('route-a')!
    active.fields.windAlertEnabled = { booleanValue: true }
    userDoc.fields.usage.mapValue.fields.windAlertRouteId = { stringValue: 'route-a' }

    const result = await setWindAlertEnabledServerSide(env, 'uid-wind-test', 'route-a', false)

    expect(result).toEqual({ allowed: true, enabled: false })
    expect(routes.get('route-a')!.fields.windAlertEnabled.booleanValue).toBe(false)
    expect(userDoc.fields.usage.mapValue.fields.windAlertRouteId).toBeUndefined()
  })

  it('returns 503 quota_unavailable rather than enabling an alert when Firestore cannot be checked', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('oauth2.googleapis.com/token')) {
        return response({ access_token: 'local-test-token' })
      }
      throw new TypeError('Firestore network unavailable')
    }) as typeof globalThis.fetch
    const identity: FirebaseIdentity = {
      uid: 'uid-wind-test',
      emailVerified: true,
      isAnonymous: false,
    }
    const request = new Request('https://worker.test/routes/wind-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId: 'route-a', enabled: true }),
    })

    const result = await handleSetWindAlert(request, env, identity)
    const body = await result.json() as { code?: string }

    expect(result.status).toBe(503)
    expect(body.code).toBe('quota_unavailable')
  })

  it('fails closed when legacy route reconciliation reaches the 1,000-document query ceiling', async () => {
    forceOversizedRouteQuery = true

    await expect(
      setWindAlertEnabledServerSide(env, 'uid-wind-test', 'route-a', true),
    ).rejects.toMatchObject({ name: 'QuotaUnavailableError' })

    expect(routes.get('route-a')!.fields.windAlertEnabled.booleanValue).toBe(false)
    expect(userDoc.fields.usage.mapValue.fields.windAlertRouteId).toBeUndefined()
  })
})
