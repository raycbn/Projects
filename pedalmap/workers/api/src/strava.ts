/**
 * Strava OAuth + activity import (free bridge for iGPSPORT / Garmin / Wahoo → Strava → PedalMap).
 * Secrets stay on the Worker — never in Vite.
 */
import type { Env } from './types'
import { json } from './types'
import type { FirebaseIdentity } from './firebaseAuth'
import {
  deleteStravaConnection,
  readStravaConnection,
  writeStravaConnection,
  type StravaConnection,
} from './firestore'

const STRAVA_AUTH = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN = 'https://www.strava.com/oauth/token'
const STRAVA_API = 'https://www.strava.com/api/v3'
const SCOPE = 'read,activity:read_all,profile:read_all'

function stravaConfigured(env: Env): boolean {
  return Boolean(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET)
}

function redirectUri(env: Env, request: Request): string {
  // Callback hits the Worker so client_secret never leaves the edge.
  const workerOrigin = new URL(request.url).origin
  return `${workerOrigin}/strava/oauth/callback`
}

function b64url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const bytes = new Uint8Array(sig)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function makeState(env: Env, uid: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 600
  const body = `${uid}.${exp}`
  const sig = await hmacSign(env.STRAVA_CLIENT_SECRET!, body)
  return `${b64url(body)}.${sig}`
}

async function parseState(env: Env, state: string): Promise<string | null> {
  const [bodyB64, sig] = state.split('.')
  if (!bodyB64 || !sig) return null
  const body = fromB64url(bodyB64)
  const expect = await hmacSign(env.STRAVA_CLIENT_SECRET!, body)
  if (expect !== sig) return null
  const [uid, expRaw] = body.split('.')
  const exp = Number(expRaw)
  if (!uid || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null
  return uid
}

function rejectAnonymous(identity: FirebaseIdentity): Response | null {
  if (!identity.isAnonymous) return null
  return json(
    {
      error: 'Inicia sesión con una cuenta real para Strava',
      code: 'strava_account_required',
    },
    403,
  )
}

export async function handleStravaOAuthStart(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  const anon = rejectAnonymous(identity)
  if (anon) return anon
  if (!stravaConfigured(env)) {
    return json(
      {
        error: 'Strava no configurado',
        code: 'strava_not_configured',
        hint: 'wrangler secret put STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET',
      },
      503,
    )
  }
  const state = await makeState(env, identity.uid)
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri(env, request),
    approval_prompt: 'auto',
    scope: SCOPE,
    state,
  })
  return json({ ok: true, url: `${STRAVA_AUTH}?${params}` })
}

export async function handleStravaOAuthCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const appUrl = (env.APP_URL || 'https://pedalmap-79b3a.web.app').replace(/\/+$/, '')
  if (!stravaConfigured(env)) {
    return Response.redirect(`${appUrl}/actividades?strava=error&reason=not_configured`, 302)
  }
  const url = new URL(request.url)
  const err = url.searchParams.get('error')
  if (err) {
    return Response.redirect(`${appUrl}/actividades?strava=error&reason=${encodeURIComponent(err)}`, 302)
  }
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return Response.redirect(`${appUrl}/actividades?strava=error&reason=missing_code`, 302)
  }
  const uid = await parseState(env, state)
  if (!uid) {
    return Response.redirect(`${appUrl}/actividades?strava=error&reason=bad_state`, 302)
  }

  const tokenRes = await fetch(STRAVA_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Number(env.STRAVA_CLIENT_ID),
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_at?: number
    athlete?: { id?: number }
    message?: string
    errors?: unknown
  }
  if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.refresh_token || !tokenJson.expires_at) {
    console.error('[strava] token exchange', tokenJson)
    return Response.redirect(`${appUrl}/actividades?strava=error&reason=token`, 302)
  }

  await writeStravaConnection(env, uid, {
    athleteId: tokenJson.athlete?.id ?? 0,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresAt: tokenJson.expires_at,
    scope: SCOPE,
  })

  return Response.redirect(`${appUrl}/actividades?strava=connected`, 302)
}

async function refreshIfNeeded(env: Env, uid: string, conn: StravaConnection): Promise<StravaConnection> {
  const skew = 60
  if (conn.expiresAt > Math.floor(Date.now() / 1000) + skew) return conn
  const res = await fetch(STRAVA_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Number(env.STRAVA_CLIENT_ID),
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: conn.refreshToken,
    }),
  })
  const jsonBody = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_at?: number
  }
  if (!res.ok || !jsonBody.access_token || !jsonBody.refresh_token || !jsonBody.expires_at) {
    throw new Error('Strava token refresh failed')
  }
  const next: StravaConnection = {
    ...conn,
    accessToken: jsonBody.access_token,
    refreshToken: jsonBody.refresh_token,
    expiresAt: jsonBody.expires_at,
  }
  await writeStravaConnection(env, uid, next)
  return next
}

async function requireStrava(
  env: Env,
  uid: string,
): Promise<StravaConnection | Response> {
  if (!stravaConfigured(env)) {
    return json({ error: 'Strava no configurado', code: 'strava_not_configured' }, 503)
  }
  const conn = await readStravaConnection(env, uid)
  if (!conn) return json({ error: 'Strava no conectado', code: 'strava_not_connected' }, 401)
  try {
    return await refreshIfNeeded(env, uid, conn)
  } catch (error) {
    console.error('[strava] refresh', error)
    return json({ error: 'Sesión Strava caducada; vuelve a conectar', code: 'strava_reauth' }, 401)
  }
}

export async function handleStravaStatus(
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  const anon = rejectAnonymous(identity)
  if (anon) return anon
  if (!stravaConfigured(env)) {
    return json({ ok: true, configured: false, connected: false })
  }
  const conn = await readStravaConnection(env, identity.uid)
  return json({
    ok: true,
    configured: true,
    connected: Boolean(conn),
    athleteId: conn?.athleteId ?? null,
  })
}

export async function handleStravaDisconnect(
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  const anon = rejectAnonymous(identity)
  if (anon) return anon
  await deleteStravaConnection(env, identity.uid)
  return json({ ok: true, connected: false })
}

type StravaSummary = {
  id: number
  name: string
  type: string
  sport_type?: string
  start_date: string
  elapsed_time: number
  distance: number
  total_elevation_gain: number
  average_heartrate?: number
  average_cadence?: number
  average_watts?: number
  average_speed?: number
}

export async function handleStravaListActivities(
  env: Env,
  identity: FirebaseIdentity,
  request: Request,
): Promise<Response> {
  const anon = rejectAnonymous(identity)
  if (anon) return anon
  const connOrErr = await requireStrava(env, identity.uid)
  if (connOrErr instanceof Response) return connOrErr
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page') || 20)))

  const res = await fetch(
    `${STRAVA_API}/athlete/activities?page=${page}&per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${connOrErr.accessToken}` } },
  )
  const data = (await res.json()) as StravaSummary[] | { message?: string }
  if (!res.ok) {
    return json({ error: (data as { message?: string }).message || 'Strava list failed' }, 502)
  }
  const activities = (data as StravaSummary[]).map((a) => ({
    id: a.id,
    externalId: `strava:${a.id}`,
    name: a.name,
    type: a.sport_type || a.type,
    startedAt: a.start_date,
    durationSeconds: a.elapsed_time,
    distanceMeters: Math.round(a.distance),
    elevationGainMeters: Math.round(a.total_elevation_gain || 0),
    averageHeartRateBpm: a.average_heartrate,
    averageCadenceRpm: a.average_cadence,
    averagePowerWatts: a.average_watts,
    averageSpeedMetersPerSecond: a.average_speed,
  }))
  return json({ ok: true, activities })
}

type StreamSet = Record<string, { data?: unknown[] }>

function bikeTypeFromStrava(type: string): 'road' | 'mtb' | 'gravel' | 'urban' | 'ebike' {
  const t = type.toLowerCase()
  if (t.includes('mountain') || t === 'mtb') return 'mtb'
  if (t.includes('gravel')) return 'gravel'
  if (t.includes('ebike') || t.includes('e-bike')) return 'ebike'
  if (t.includes('ride') || t.includes('virtual')) return 'road'
  return 'road'
}

export async function handleStravaImportActivity(
  env: Env,
  identity: FirebaseIdentity,
  activityId: string,
): Promise<Response> {
  const anon = rejectAnonymous(identity)
  if (anon) return anon
  const connOrErr = await requireStrava(env, identity.uid)
  if (connOrErr instanceof Response) return connOrErr
  const id = Number(activityId)
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'activity id inválido' }, 400)

  const metaRes = await fetch(`${STRAVA_API}/activities/${id}`, {
    headers: { Authorization: `Bearer ${connOrErr.accessToken}` },
  })
  const meta = (await metaRes.json()) as StravaSummary & { message?: string }
  if (!metaRes.ok) {
    return json({ error: meta.message || 'No se pudo leer la actividad Strava' }, 502)
  }

  const keys = ['latlng', 'altitude', 'time', 'heartrate', 'cadence', 'watts', 'velocity_smooth']
  const streamRes = await fetch(
    `${STRAVA_API}/activities/${id}/streams?keys=${keys.join(',')}&key_by_type=true`,
    { headers: { Authorization: `Bearer ${connOrErr.accessToken}` } },
  )
  const streams = (await streamRes.json()) as StreamSet | { message?: string }
  if (!streamRes.ok) {
    return json(
      { error: (streams as { message?: string }).message || 'No se pudieron leer streams' },
      502,
    )
  }

  const set = streams as StreamSet
  const latlng = (set.latlng?.data ?? []) as [number, number][]
  const altitude = (set.altitude?.data ?? []) as number[]
  const time = (set.time?.data ?? []) as number[]
  const heartrate = (set.heartrate?.data ?? []) as number[]
  const cadence = (set.cadence?.data ?? []) as number[]
  const watts = (set.watts?.data ?? []) as number[]
  const velocity = (set.velocity_smooth?.data ?? []) as number[]

  const startMs = Date.parse(meta.start_date)
  const n = latlng.length
  const track = []
  for (let i = 0; i < n; i += 1) {
    const [lat, lng] = latlng[i]
    const offsetSec = time[i] ?? i
    track.push({
      position: { lat, lng },
      elevationMeters: Number.isFinite(altitude[i]) ? altitude[i] : undefined,
      recordedAt: new Date(startMs + offsetSec * 1000).toISOString(),
      heartRateBpm: Number.isFinite(heartrate[i]) ? heartrate[i] : undefined,
      cadenceRpm: Number.isFinite(cadence[i]) ? cadence[i] : undefined,
      powerWatts: Number.isFinite(watts[i]) ? watts[i] : undefined,
      speedMetersPerSecond: Number.isFinite(velocity[i]) ? velocity[i] : undefined,
    })
  }

  // Downsample for Firestore size if huge
  const maxPts = 3500
  let capped = track
  if (track.length > maxPts) {
    const step = Math.ceil(track.length / maxPts)
    capped = track.filter((_, i) => i % step === 0 || i === track.length - 1)
  }

  const finishedAt = new Date(startMs + (meta.elapsed_time || 0) * 1000).toISOString()
  const activity = {
    userId: identity.uid,
    title: meta.name || 'Salida Strava',
    status: 'finished' as const,
    bikeType: bikeTypeFromStrava(meta.sport_type || meta.type || 'Ride'),
    source: 'strava' as const,
    externalId: `strava:${id}`,
    startedAt: meta.start_date,
    finishedAt,
    track: capped,
    stats: {
      distanceMeters: Math.round(meta.distance || 0),
      durationSeconds: meta.elapsed_time || 0,
      elevationGainMeters: Math.round(meta.total_elevation_gain || 0),
      averageHeartRateBpm: meta.average_heartrate,
      averageCadenceRpm: meta.average_cadence,
      averagePowerWatts: meta.average_watts,
      averageSpeedMetersPerSecond: meta.average_speed,
    },
  }

  return json({ ok: true, activity })
}
