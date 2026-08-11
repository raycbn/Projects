import type { Env } from './types'

type ServiceAccount = {
  client_email: string
  private_key: string
  project_id?: string
  token_uri?: string
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) buf[i] = raw.charCodeAt(i)
  return buf.buffer
}

function base64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${base64url(signature)}`
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  })
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as { access_token?: string; error?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(`Service account token failed: ${json.error || res.status}`)
  }
  return json.access_token
}

function parseServiceAccount(env: Env): ServiceAccount | null {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return null
  try {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON')
  }
}

/** Patch Firestore docs via REST (no Cloud Functions / no Blaze). */
export async function upsertSubscriptionAndPlan(
  env: Env,
  input: {
    uid: string
    plan: 'free' | 'premium'
    status: string
    stripeCustomerId?: string
    stripeSubscriptionId?: string
  },
): Promise<void> {
  const sa = parseServiceAccount(env)
  if (!sa) {
    console.warn('[firestore] FIREBASE_SERVICE_ACCOUNT missing — webhook verified but not persisted')
    return
  }
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const now = new Date().toISOString()

  const subUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/subscriptions/${input.uid}`
  const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${input.uid}?updateMask.fieldPaths=plan&updateMask.fieldPaths=updatedAt`

  const subBody = {
    fields: {
      userId: { stringValue: input.uid },
      status: { stringValue: input.status },
      plan: { stringValue: input.plan },
      ...(input.stripeCustomerId
        ? { stripeCustomerId: { stringValue: input.stripeCustomerId } }
        : {}),
      ...(input.stripeSubscriptionId
        ? { stripeSubscriptionId: { stringValue: input.stripeSubscriptionId } }
        : {}),
      updatedAt: { timestampValue: now },
    },
  }

  const userBody = {
    fields: {
      plan: { stringValue: input.plan },
      updatedAt: { timestampValue: now },
    },
  }

  const [subRes, userRes] = await Promise.all([
    fetch(subUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subBody),
    }),
    fetch(userUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userBody),
    }),
  ])

  if (!subRes.ok) {
    const t = await subRes.text()
    throw new Error(`subscriptions write failed: ${subRes.status} ${t.slice(0, 300)}`)
  }
  if (!userRes.ok) {
    const t = await userRes.text()
    throw new Error(`users.plan write failed: ${userRes.status} ${t.slice(0, 300)}`)
  }
}

export async function readSubscriptionCustomerId(
  env: Env,
  uid: string,
): Promise<string | undefined> {
  const sa = parseServiceAccount(env)
  if (!sa) return undefined
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/subscriptions/${uid}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return undefined
  const json = (await res.json()) as {
    fields?: { stripeCustomerId?: { stringValue?: string } }
  }
  return json.fields?.stripeCustomerId?.stringValue
}

/** Read users/{uid}.plan + usage via Admin REST. */
export async function readUserEntitlements(
  env: Env,
  uid: string,
): Promise<{ plan: 'free' | 'premium'; routesSaved: number } | null> {
  const sa = parseServiceAccount(env)
  if (!sa) return null
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return { plan: 'free', routesSaved: 0 }
  if (!res.ok) return null
  const json = (await res.json()) as {
    fields?: {
      plan?: { stringValue?: string }
      usage?: {
        mapValue?: {
          fields?: {
            routesSaved?: { integerValue?: string; doubleValue?: number }
          }
        }
      }
    }
  }
  const planRaw = json.fields?.plan?.stringValue
  const plan: 'free' | 'premium' = planRaw === 'premium' ? 'premium' : 'free'
  const savedField = json.fields?.usage?.mapValue?.fields?.routesSaved
  const routesSaved = Number(savedField?.integerValue ?? savedField?.doubleValue ?? 0) || 0
  return { plan, routesSaved }
}

/** Admin-only: set users.plan (allowlist / Stripe). Client rules freeze plan. */
export async function writeUserPlan(
  env: Env,
  uid: string,
  plan: 'free' | 'premium',
): Promise<void> {
  const sa = parseServiceAccount(env)
  if (!sa) {
    console.warn('[firestore] FIREBASE_SERVICE_ACCOUNT missing — plan not persisted')
    return
  }
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const now = new Date().toISOString()
  const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=plan&updateMask.fieldPaths=updatedAt`
  const res = await fetch(userUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        plan: { stringValue: plan },
        updatedAt: { timestampValue: now },
      },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`users.plan write failed: ${res.status} ${t.slice(0, 300)}`)
  }
}

export async function writeSubscriptionCustomerId(
  env: Env,
  uid: string,
  customerId: string,
): Promise<void> {
  const sa = parseServiceAccount(env)
  if (!sa) {
    console.warn('[firestore] FIREBASE_SERVICE_ACCOUNT missing — customer id not persisted')
    return
  }
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const now = new Date().toISOString()
  // Only touch subscriptions — never force users.plan to free (ops/allowlist premium).
  const subUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/subscriptions/${uid}?updateMask.fieldPaths=userId&updateMask.fieldPaths=stripeCustomerId&updateMask.fieldPaths=updatedAt`
  const res = await fetch(subUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        userId: { stringValue: uid },
        stripeCustomerId: { stringValue: customerId },
        updatedAt: { timestampValue: now },
      },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`subscriptions customer write failed: ${res.status} ${t.slice(0, 300)}`)
  }
}

export type StravaConnection = {
  athleteId: number
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope?: string
}

export async function readStravaConnection(
  env: Env,
  uid: string,
): Promise<StravaConnection | null> {
  const sa = parseServiceAccount(env)
  if (!sa) return null
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stravaConnections/${uid}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const json = (await res.json()) as {
    fields?: {
      athleteId?: { integerValue?: string; doubleValue?: number }
      accessToken?: { stringValue?: string }
      refreshToken?: { stringValue?: string }
      expiresAt?: { integerValue?: string; doubleValue?: number }
      scope?: { stringValue?: string }
    }
  }
  const accessToken = json.fields?.accessToken?.stringValue
  const refreshToken = json.fields?.refreshToken?.stringValue
  const expiresAt = Number(
    json.fields?.expiresAt?.integerValue ?? json.fields?.expiresAt?.doubleValue ?? 0,
  )
  const athleteId = Number(
    json.fields?.athleteId?.integerValue ?? json.fields?.athleteId?.doubleValue ?? 0,
  )
  if (!accessToken || !refreshToken || !expiresAt) return null
  return {
    athleteId,
    accessToken,
    refreshToken,
    expiresAt,
    scope: json.fields?.scope?.stringValue,
  }
}

export async function writeStravaConnection(
  env: Env,
  uid: string,
  conn: StravaConnection,
): Promise<void> {
  const sa = parseServiceAccount(env)
  if (!sa) {
    console.warn('[firestore] FIREBASE_SERVICE_ACCOUNT missing — Strava tokens not persisted')
    return
  }
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const now = new Date().toISOString()
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stravaConnections/${uid}?updateMask.fieldPaths=athleteId&updateMask.fieldPaths=accessToken&updateMask.fieldPaths=refreshToken&updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=scope&updateMask.fieldPaths=updatedAt`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        athleteId: { integerValue: String(conn.athleteId) },
        accessToken: { stringValue: conn.accessToken },
        refreshToken: { stringValue: conn.refreshToken },
        expiresAt: { integerValue: String(Math.floor(conn.expiresAt)) },
        ...(conn.scope ? { scope: { stringValue: conn.scope } } : {}),
        updatedAt: { timestampValue: now },
      },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`stravaConnections write failed: ${res.status} ${t.slice(0, 300)}`)
  }
}

export async function deleteStravaConnection(env: Env, uid: string): Promise<void> {
  const sa = parseServiceAccount(env)
  if (!sa) return
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stravaConnections/${uid}`
  await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}

export type GpsProvider = 'wahoo' | 'igpsport' | 'garmin'

export type GpsConnection = {
  provider: GpsProvider
  externalUserId: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope?: string
}

function gpsDocId(uid: string, provider: GpsProvider): string {
  return `${uid}__${provider}`
}

function providerIndexId(provider: GpsProvider, externalUserId: string): string {
  return `${provider}__${externalUserId}`.replace(/[/\\]/g, '_')
}

function importIndexId(externalId: string): string {
  return externalId.replace(/[/\\]/g, '_')
}

export async function readGpsConnection(
  env: Env,
  uid: string,
  provider: GpsProvider,
): Promise<GpsConnection | null> {
  const sa = parseServiceAccount(env)
  if (!sa) return null
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/gpsConnections/${gpsDocId(uid, provider)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const json = (await res.json()) as {
    fields?: {
      provider?: { stringValue?: string }
      externalUserId?: { stringValue?: string }
      accessToken?: { stringValue?: string }
      refreshToken?: { stringValue?: string }
      expiresAt?: { integerValue?: string; doubleValue?: number }
      scope?: { stringValue?: string }
    }
  }
  const accessToken = json.fields?.accessToken?.stringValue
  const refreshToken = json.fields?.refreshToken?.stringValue
  const expiresAt = Number(
    json.fields?.expiresAt?.integerValue ?? json.fields?.expiresAt?.doubleValue ?? 0,
  )
  const externalUserId = json.fields?.externalUserId?.stringValue || ''
  if (!accessToken || !refreshToken || !expiresAt) return null
  return {
    provider,
    externalUserId,
    accessToken,
    refreshToken,
    expiresAt,
    scope: json.fields?.scope?.stringValue,
  }
}

export async function listGpsConnections(env: Env, uid: string): Promise<GpsConnection[]> {
  const providers: GpsProvider[] = ['wahoo', 'igpsport', 'garmin']
  const out: GpsConnection[] = []
  for (const p of providers) {
    const c = await readGpsConnection(env, uid, p)
    if (c) out.push(c)
  }
  return out
}

export async function writeGpsConnection(
  env: Env,
  uid: string,
  conn: GpsConnection,
): Promise<void> {
  const sa = parseServiceAccount(env)
  if (!sa) {
    console.warn('[firestore] FIREBASE_SERVICE_ACCOUNT missing — GPS tokens not persisted')
    return
  }
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const now = new Date().toISOString()
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/gpsConnections/${gpsDocId(uid, conn.provider)}?updateMask.fieldPaths=provider&updateMask.fieldPaths=uid&updateMask.fieldPaths=externalUserId&updateMask.fieldPaths=accessToken&updateMask.fieldPaths=refreshToken&updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=scope&updateMask.fieldPaths=updatedAt`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        provider: { stringValue: conn.provider },
        uid: { stringValue: uid },
        externalUserId: { stringValue: conn.externalUserId },
        accessToken: { stringValue: conn.accessToken },
        refreshToken: { stringValue: conn.refreshToken },
        expiresAt: { integerValue: String(Math.floor(conn.expiresAt)) },
        ...(conn.scope ? { scope: { stringValue: conn.scope } } : {}),
        updatedAt: { timestampValue: now },
      },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`gpsConnections write failed: ${res.status} ${t.slice(0, 300)}`)
  }
}

export async function deleteGpsConnection(
  env: Env,
  uid: string,
  provider: GpsProvider,
): Promise<void> {
  const sa = parseServiceAccount(env)
  if (!sa) return
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/gpsConnections/${gpsDocId(uid, provider)}`
  await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}

/** Map provider athlete id → PedalMap uid (for webhooks). Pass uid=null to delete. */
export async function writeGpsProviderIndex(
  env: Env,
  provider: GpsProvider,
  externalUserId: string,
  uid: string | null,
): Promise<void> {
  const sa = parseServiceAccount(env)
  if (!sa || !externalUserId) return
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const docPath = `gpsProviderIndex/${providerIndexId(provider, externalUserId)}`
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`
  if (!uid) {
    await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    return
  }
  const patchUrl = `${url}?updateMask.fieldPaths=uid&updateMask.fieldPaths=provider&updateMask.fieldPaths=externalUserId&updateMask.fieldPaths=updatedAt`
  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        uid: { stringValue: uid },
        provider: { stringValue: provider },
        externalUserId: { stringValue: externalUserId },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`gpsProviderIndex write failed: ${res.status} ${t.slice(0, 300)}`)
  }
}

export async function readGpsUidByProviderUser(
  env: Env,
  provider: GpsProvider,
  externalUserId: string,
): Promise<string | null> {
  const sa = parseServiceAccount(env)
  if (!sa || !externalUserId) return null
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/gpsProviderIndex/${providerIndexId(provider, externalUserId)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const json = (await res.json()) as { fields?: { uid?: { stringValue?: string } } }
  return json.fields?.uid?.stringValue || null
}

export async function findActivityByExternalId(
  env: Env,
  uid: string,
  externalId: string,
): Promise<string | null> {
  const sa = parseServiceAccount(env)
  if (!sa) return null
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/gpsImportIndex/${importIndexId(externalId)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const json = (await res.json()) as {
    fields?: { activityId?: { stringValue?: string }; userId?: { stringValue?: string } }
  }
  if (json.fields?.userId?.stringValue && json.fields.userId.stringValue !== uid) return null
  return json.fields?.activityId?.stringValue || null
}

/** Encode JSON-ish values for Firestore REST (skips undefined / non-finite numbers). */
export function toFirestoreValue(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { nullValue: null }
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map((x) => toFirestoreValue(x)) } }
  }
  if (typeof v === 'object') {
    const fields: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === undefined) continue
      if (typeof val === 'number' && !Number.isFinite(val)) continue
      fields[k] = toFirestoreValue(val)
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function createShareSlug(title: string): string {
  const base =
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'ruta'
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}-${suffix}`
}

export type PublishShareInput = {
  title: string
  description?: string
  type: string
  bikeType: string
  preferences?: unknown[]
  waypoints: unknown[]
  geometry: unknown
  elevationProfile?: unknown[]
  stats: Record<string, unknown>
  circularDistanceMeters?: number
  shareSlug?: string
  /** When set, mark this existing route public instead of creating a new one. */
  routeId?: string
}

/**
 * Admin publish for WhatsApp / public link sharing.
 * Bypasses client security-rule edge cases (missing usage, stale free plan, etc.).
 */
export async function publishPublicRouteShare(
  env: Env,
  uid: string,
  input: PublishShareInput,
): Promise<{ routeId: string; shareSlug: string }> {
  const sa = parseServiceAccount(env)
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT required to publish shared routes')
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const now = new Date().toISOString()
  const title = String(input.title || 'Ruta').slice(0, 120)
  const shareSlug = (input.shareSlug || createShareSlug(title)).slice(0, 80)

  const routeFields: Record<string, unknown> = {
    userId: { stringValue: uid },
    title: { stringValue: title },
    type: { stringValue: String(input.type || 'a_to_b') },
    bikeType: { stringValue: String(input.bikeType || 'road') },
    preferences: toFirestoreValue(input.preferences ?? []),
    waypoints: toFirestoreValue(input.waypoints ?? []),
    geometry: toFirestoreValue(input.geometry),
    elevationProfile: toFirestoreValue(input.elevationProfile ?? []),
    stats: toFirestoreValue(input.stats ?? {}),
    isPublic: { booleanValue: true },
    shareSlug: { stringValue: shareSlug },
    updatedAt: { timestampValue: now },
  }
  if (input.description) routeFields.description = { stringValue: String(input.description).slice(0, 500) }
  if (
    typeof input.circularDistanceMeters === 'number' &&
    Number.isFinite(input.circularDistanceMeters)
  ) {
    routeFields.circularDistanceMeters = { doubleValue: input.circularDistanceMeters }
  }

  let routeId = input.routeId?.trim() || ''

  if (routeId) {
    const mask = [
      'isPublic',
      'shareSlug',
      'title',
      'type',
      'bikeType',
      'preferences',
      'waypoints',
      'geometry',
      'elevationProfile',
      'stats',
      'updatedAt',
      'description',
      'circularDistanceMeters',
    ]
      .map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`)
      .join('&')
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/routes/${routeId}?${mask}`
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: routeFields }),
    })
    if (!patchRes.ok) {
      const t = await patchRes.text()
      throw new Error(`route patch failed: ${patchRes.status} ${t.slice(0, 400)}`)
    }
  } else {
    const createUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/routes`
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          ...routeFields,
          createdAt: { timestampValue: now },
        },
      }),
    })
    if (!createRes.ok) {
      const t = await createRes.text()
      throw new Error(`route create failed: ${createRes.status} ${t.slice(0, 400)}`)
    }
    const created = (await createRes.json()) as { name?: string }
    routeId = created.name?.split('/').pop() || ''
    if (!routeId) throw new Error('route create missing id')
  }

  // Public lookup + embedded snapshot (works even if routes/{id} read is flaky).
  const shareUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/routeShares/${encodeURIComponent(shareSlug)}?updateMask.fieldPaths=routeId&updateMask.fieldPaths=userId&updateMask.fieldPaths=createdAt&updateMask.fieldPaths=title&updateMask.fieldPaths=type&updateMask.fieldPaths=bikeType&updateMask.fieldPaths=preferences&updateMask.fieldPaths=waypoints&updateMask.fieldPaths=geometry&updateMask.fieldPaths=elevationProfile&updateMask.fieldPaths=stats&updateMask.fieldPaths=isPublic`
  const shareRes = await fetch(shareUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        routeId: { stringValue: routeId },
        userId: { stringValue: uid },
        createdAt: { timestampValue: now },
        title: { stringValue: title },
        type: { stringValue: String(input.type || 'a_to_b') },
        bikeType: { stringValue: String(input.bikeType || 'road') },
        preferences: toFirestoreValue(input.preferences ?? []),
        waypoints: toFirestoreValue(input.waypoints ?? []),
        geometry: toFirestoreValue(input.geometry),
        elevationProfile: toFirestoreValue(input.elevationProfile ?? []),
        stats: toFirestoreValue(input.stats ?? {}),
        isPublic: { booleanValue: true },
      },
    }),
  })
  if (!shareRes.ok) {
    const t = await shareRes.text()
    throw new Error(`routeShares write failed: ${shareRes.status} ${t.slice(0, 400)}`)
  }

  return { routeId, shareSlug }
}

export async function writeImportedActivity(
  env: Env,
  uid: string,
  input: {
    title: string
    bikeType: string
    source: string
    externalId: string
    startedAt: string
    finishedAt?: string
    track: unknown[]
    stats: Record<string, unknown>
  },
): Promise<string> {
  const sa = parseServiceAccount(env)
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT required for GPS auto-import')
  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const now = new Date().toISOString()
  const monthKey = `${new Date(input.startedAt).getUTCFullYear()}-${String(new Date(input.startedAt).getUTCMonth() + 1).padStart(2, '0')}`

  const createUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/activities`
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        userId: { stringValue: uid },
        title: { stringValue: input.title },
        bikeType: { stringValue: input.bikeType },
        source: { stringValue: input.source },
        externalId: { stringValue: input.externalId },
        status: { stringValue: 'finished' },
        startedAt: { stringValue: input.startedAt },
        ...(input.finishedAt ? { finishedAt: { stringValue: input.finishedAt } } : {}),
        track: toFirestoreValue(input.track),
        stats: toFirestoreValue(input.stats),
        monthKey: { stringValue: monthKey },
        createdAt: { timestampValue: now },
        updatedAt: { timestampValue: now },
      },
    }),
  })
  if (!createRes.ok) {
    const t = await createRes.text()
    throw new Error(`activity import failed: ${createRes.status} ${t.slice(0, 400)}`)
  }
  const created = (await createRes.json()) as { name?: string }
  const activityId = created.name?.split('/').pop()
  if (!activityId) throw new Error('activity import missing id')

  const indexUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/gpsImportIndex/${importIndexId(input.externalId)}?updateMask.fieldPaths=activityId&updateMask.fieldPaths=userId&updateMask.fieldPaths=externalId&updateMask.fieldPaths=updatedAt`
  await fetch(indexUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        activityId: { stringValue: activityId },
        userId: { stringValue: uid },
        externalId: { stringValue: input.externalId },
        updatedAt: { timestampValue: now },
      },
    }),
  })

  return activityId
}
