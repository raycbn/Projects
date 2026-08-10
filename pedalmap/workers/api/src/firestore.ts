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
