/**
 * Wahoo Cloud API — official OAuth2 + workout_summary webhooks (auto-upload).
 * Docs: https://cloud-api.wahooligan.com/
 */
import type { Env } from '../types'
import { json } from '../types'
import type { FirebaseIdentity } from '../firebaseAuth'
import {
  readGpsConnection,
  writeGpsConnection,
  writeGpsProviderIndex,
  type GpsConnection,
} from '../firestore'
import { appRedirect, makeOAuthState, parseOAuthState, workerCallbackUrl } from './oauthState'
import { persistProviderActivity } from './persist'
import { resolveUidForProviderUser } from './lookup'

const WAHOO_API = 'https://api.wahooligan.com'
const SCOPE = 'user_read workouts_read offline_data'

function secrets(env: Env): { id: string; secret: string } | null {
  if (!env.WAHOO_CLIENT_ID || !env.WAHOO_CLIENT_SECRET) return null
  return { id: env.WAHOO_CLIENT_ID, secret: env.WAHOO_CLIENT_SECRET }
}

export async function handleWahooOAuthStart(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  const s = secrets(env)
  if (!s) return json({ error: 'Wahoo no configurado', code: 'gps_not_configured' }, 503)
  const state = await makeOAuthState(s.secret, identity.uid, 'wahoo')
  const params = new URLSearchParams({
    client_id: s.id,
    redirect_uri: workerCallbackUrl(request, 'wahoo'),
    scope: SCOPE,
    response_type: 'code',
  })
  // state is not always documented on Wahoo authorize but we append for CSRF
  params.set('state', state)
  return json({ ok: true, url: `${WAHOO_API}/oauth/authorize?${params}` })
}

export async function handleWahooOAuthCallback(request: Request, env: Env): Promise<Response> {
  const s = secrets(env)
  if (!s) return appRedirect(env, false, 'wahoo', 'not_configured')
  const url = new URL(request.url)
  if (url.searchParams.get('error')) {
    return appRedirect(env, false, 'wahoo', url.searchParams.get('error') || 'denied')
  }
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return appRedirect(env, false, 'wahoo', 'missing_code')
  const uid = await parseOAuthState(s.secret, state, 'wahoo')
  if (!uid) return appRedirect(env, false, 'wahoo', 'bad_state')

  const tokenUrl = new URL(`${WAHOO_API}/oauth/token`)
  tokenUrl.searchParams.set('client_id', s.id)
  tokenUrl.searchParams.set('client_secret', s.secret)
  tokenUrl.searchParams.set('code', code)
  tokenUrl.searchParams.set('grant_type', 'authorization_code')
  tokenUrl.searchParams.set('redirect_uri', workerCallbackUrl(request, 'wahoo'))

  const tokenRes = await fetch(tokenUrl.toString(), { method: 'POST' })
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
  }
  if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.refresh_token) {
    console.error('[wahoo] token', tokenJson)
    return appRedirect(env, false, 'wahoo', 'token')
  }

  const userRes = await fetch(`${WAHOO_API}/v1/user`, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  })
  const userJson = (await userRes.json()) as { id?: number | string }
  const externalUserId = String(userJson.id ?? '')
  const expiresAt = Math.floor(Date.now() / 1000) + Number(tokenJson.expires_in || 7200)

  await writeGpsConnection(env, uid, {
    provider: 'wahoo',
    externalUserId,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresAt,
    scope: SCOPE,
  })
  if (externalUserId) await writeGpsProviderIndex(env, 'wahoo', externalUserId, uid)

  return appRedirect(env, true, 'wahoo')
}

async function refreshIfNeeded(env: Env, uid: string, conn: GpsConnection): Promise<GpsConnection> {
  const s = secrets(env)
  if (!s) throw new Error('Wahoo not configured')
  if (conn.expiresAt > Math.floor(Date.now() / 1000) + 60) return conn
  const tokenUrl = new URL(`${WAHOO_API}/oauth/token`)
  tokenUrl.searchParams.set('client_id', s.id)
  tokenUrl.searchParams.set('client_secret', s.secret)
  tokenUrl.searchParams.set('grant_type', 'refresh_token')
  tokenUrl.searchParams.set('refresh_token', conn.refreshToken)
  const res = await fetch(tokenUrl.toString(), { method: 'POST' })
  const body = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new Error('Wahoo refresh failed')
  }
  const next: GpsConnection = {
    ...conn,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(body.expires_in || 7200),
  }
  await writeGpsConnection(env, uid, next)
  return next
}

type WahooSummary = {
  id?: number
  ascent_accum?: number | string
  cadence_avg?: number | string
  calories_accum?: number | string
  distance_accum?: number | string
  duration_active_accum?: number | string
  duration_paused_accum?: number | string
  duration_total_accum?: number | string
  heart_rate_avg?: number | string
  power_avg?: number | string
  speed_avg?: number | string
  file?: { url?: string }
}

type WahooWorkout = {
  id: number
  name?: string
  starts?: string
  minutes?: number
  workout_summary?: WahooSummary | null
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

function summaryToActivity(workout: WahooWorkout, summary: WahooSummary) {
  const distance = Math.round(num(summary.distance_accum) || 0)
  const elapsed = Math.round(num(summary.duration_total_accum) || (workout.minutes || 0) * 60)
  const moving = Math.round(num(summary.duration_active_accum) || elapsed)
  const paused = Math.round(num(summary.duration_paused_accum) || 0)
  const startedAt = workout.starts || new Date().toISOString()
  const startMs = Date.parse(startedAt)
  const finishedAt = Number.isFinite(startMs)
    ? new Date(startMs + elapsed * 1000).toISOString()
    : undefined
  return {
    provider: 'wahoo' as const,
    externalId: `wahoo:${workout.id}`,
    title: workout.name || `Salida Wahoo #${workout.id}`,
    bikeType: 'road' as const,
    startedAt,
    finishedAt,
    track: [] as Array<{
      position: { lat: number; lng: number }
      recordedAt: string
    }>,
    stats: {
      distanceMeters: distance,
      durationSeconds: elapsed,
      movingTimeSeconds: moving,
      stoppedTimeSeconds: paused,
      elevationGainMeters: Math.round(num(summary.ascent_accum) || 0),
      averageHeartRateBpm: num(summary.heart_rate_avg)
        ? Math.round(num(summary.heart_rate_avg)!)
        : undefined,
      averageCadenceRpm: num(summary.cadence_avg)
        ? Math.round(num(summary.cadence_avg)!)
        : undefined,
      averagePowerWatts: num(summary.power_avg) ? Math.round(num(summary.power_avg)!) : undefined,
      averageSpeedMetersPerSecond: num(summary.speed_avg),
      estimatedCaloriesKcal: num(summary.calories_accum)
        ? Math.round(num(summary.calories_accum)!)
        : undefined,
    },
  }
}

export async function syncWahooRecent(env: Env, identity: FirebaseIdentity): Promise<Response> {
  const conn0 = await readGpsConnection(env, identity.uid, 'wahoo')
  if (!conn0) return json({ error: 'Wahoo no conectado', code: 'gps_not_connected' }, 401)
  let conn: GpsConnection
  try {
    conn = await refreshIfNeeded(env, identity.uid, conn0)
  } catch {
    return json({ error: 'Sesión Wahoo caducada; vuelve a conectar', code: 'gps_reauth' }, 401)
  }

  const listRes = await fetch(`${WAHOO_API}/v1/workouts?per_page=20`, {
    headers: { Authorization: `Bearer ${conn.accessToken}` },
  })
  const listJson = (await listRes.json()) as { workouts?: WahooWorkout[]; message?: string }
  if (!listRes.ok) {
    return json({ error: listJson.message || 'Wahoo list failed' }, 502)
  }

  let imported = 0
  let skipped = 0
  for (const w of listJson.workouts || []) {
    let summary = w.workout_summary
    if (!summary) {
      const sRes = await fetch(`${WAHOO_API}/v1/workouts/${w.id}/workout_summary`, {
        headers: { Authorization: `Bearer ${conn.accessToken}` },
      })
      if (sRes.ok) summary = (await sRes.json()) as WahooSummary
    }
    if (!summary || !(num(summary.distance_accum) || 0)) {
      skipped += 1
      continue
    }
    const payload = summaryToActivity(w, summary)
    const result = await persistProviderActivity(env, identity.uid, payload)
    if (result.created) imported += 1
    else skipped += 1
  }
  return json({ ok: true, imported, skipped })
}

export async function handleWahooWebhook(request: Request, env: Env): Promise<Response> {
  const expected = env.WAHOO_WEBHOOK_TOKEN
  const body = (await request.json()) as {
    event_type?: string
    webhook_token?: string
    user?: { id?: number | string }
    workout_summary?: WahooSummary & { workout_id?: number; name?: string; starts?: string }
  }
  if (expected && body.webhook_token !== expected) {
    return json({ error: 'invalid webhook token' }, 401)
  }
  if (body.event_type && body.event_type !== 'workout_summary') {
    return json({ ok: true, ignored: true })
  }
  const externalUserId = String(body.user?.id ?? '')
  if (!externalUserId) return json({ error: 'missing user' }, 400)
  const uid = await resolveUidForProviderUser(env, 'wahoo', externalUserId)
  if (!uid) return json({ ok: true, unmatched: true })

  const summary = body.workout_summary
  if (!summary) return json({ ok: true, empty: true })
  const workoutId = summary.workout_id || summary.id
  if (!workoutId) return json({ error: 'missing workout id' }, 400)

  const workout: WahooWorkout = {
    id: Number(workoutId),
    name: summary.name,
    starts: summary.starts,
    workout_summary: summary,
  }
  const payload = summaryToActivity(workout, summary)
  const result = await persistProviderActivity(env, uid, payload)
  return json({ ok: true, ...result })
}
