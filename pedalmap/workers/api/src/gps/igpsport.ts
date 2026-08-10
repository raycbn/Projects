/**
 * iGPSPORT OpenAPI — official partner API (apply via global@igpsport.com).
 * Endpoints are filled once credentials are issued; webhook callback is ready now.
 */
import type { Env } from '../types'
import { json } from '../types'
import type { FirebaseIdentity } from '../firebaseAuth'
import { writeGpsConnection, writeGpsProviderIndex } from '../firestore'
import { appRedirect, makeOAuthState, parseOAuthState, workerCallbackUrl } from './oauthState'
import { persistProviderActivity } from './persist'
import { resolveUidForProviderUser } from './lookup'

const AUTH_BASE = (env: Env) =>
  env.IGPSPORT_AUTH_URL || 'https://www.igpsport.com/oauth/authorize'
const TOKEN_URL = (env: Env) =>
  env.IGPSPORT_TOKEN_URL || 'https://www.igpsport.com/oauth/token'

function secrets(env: Env) {
  if (!env.IGPSPORT_CLIENT_ID || !env.IGPSPORT_CLIENT_SECRET) return null
  return { id: env.IGPSPORT_CLIENT_ID, secret: env.IGPSPORT_CLIENT_SECRET }
}

export async function handleIgpsportOAuthStart(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  const s = secrets(env)
  if (!s) {
    return json(
      {
        error: 'iGPSPORT pendiente de API oficial',
        code: 'gps_not_configured',
        hint: 'Solicita OpenAPI a global@igpsport.com (ver docs/GPS_OFFICIAL_SYNC.md)',
      },
      503,
    )
  }
  const state = await makeOAuthState(s.secret, identity.uid, 'igpsport')
  const params = new URLSearchParams({
    client_id: s.id,
    response_type: 'code',
    redirect_uri: workerCallbackUrl(request, 'igpsport'),
    state,
    scope: env.IGPSPORT_SCOPE || 'activity:read',
  })
  return json({ ok: true, url: `${AUTH_BASE(env)}?${params}` })
}

export async function handleIgpsportOAuthCallback(request: Request, env: Env): Promise<Response> {
  const s = secrets(env)
  if (!s) return appRedirect(env, false, 'igpsport', 'not_configured')
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return appRedirect(env, false, 'igpsport', 'missing_code')
  const uid = await parseOAuthState(s.secret, state, 'igpsport')
  if (!uid) return appRedirect(env, false, 'igpsport', 'bad_state')

  const tokenRes = await fetch(TOKEN_URL(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: s.id,
      client_secret: s.secret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: workerCallbackUrl(request, 'igpsport'),
    }),
  })
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    user_id?: string | number
    open_id?: string
  }
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error('[igpsport] token', tokenJson)
    return appRedirect(env, false, 'igpsport', 'token')
  }

  const externalUserId = String(tokenJson.user_id || tokenJson.open_id || '')
  await writeGpsConnection(env, uid, {
    provider: 'igpsport',
    externalUserId,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || tokenJson.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(tokenJson.expires_in || 7200),
  })
  if (externalUserId) await writeGpsProviderIndex(env, 'igpsport', externalUserId, uid)
  return appRedirect(env, true, 'igpsport')
}

/**
 * Sports data callback_url from iGPSPORT OpenAPI application.
 * Payload shape is confirmed after partner onboarding — we accept common fields.
 */
export async function handleIgpsportWebhook(request: Request, env: Env): Promise<Response> {
  const expected = env.IGPSPORT_WEBHOOK_TOKEN
  if (expected) {
    const hdr = request.headers.get('X-Igpsport-Token') || new URL(request.url).searchParams.get('token')
    if (hdr !== expected) return json({ error: 'invalid webhook token' }, 401)
  }

  const body = (await request.json()) as Record<string, unknown>
  const userId = String(
    body.userId || body.user_id || body.openId || body.open_id || (body.user as { id?: string })?.id || '',
  )
  if (!userId) return json({ error: 'missing user' }, 400)
  const uid = await resolveUidForProviderUser(env, 'igpsport', userId)
  if (!uid) return json({ ok: true, unmatched: true })

  const activity = (body.activity || body.data || body) as Record<string, unknown>
  const rideId = String(activity.rideId || activity.ride_id || activity.id || '')
  if (!rideId) return json({ error: 'missing activity id' }, 400)

  const distance = Number(activity.distance || activity.distanceMeters || 0)
  const duration = Number(activity.movingTime || activity.duration || activity.elapsedTime || 0)
  const elev = Number(activity.elevationGain || activity.ascent || 0)
  const startedAt = String(activity.startTime || activity.startedAt || new Date().toISOString())
  const title = String(activity.title || activity.name || `iGPSPORT #${rideId}`)

  const result = await persistProviderActivity(env, uid, {
    provider: 'igpsport',
    externalId: `igpsport:${rideId}`,
    title,
    bikeType: 'road',
    startedAt,
    finishedAt: duration
      ? new Date(Date.parse(startedAt) + duration * 1000).toISOString()
      : undefined,
    track: [],
    stats: {
      distanceMeters: Math.round(distance > 1000 ? distance : distance * 1000),
      durationSeconds: Math.round(duration),
      movingTimeSeconds: Math.round(duration),
      elevationGainMeters: Math.round(elev),
      averageHeartRateBpm: activity.avgHr ? Math.round(Number(activity.avgHr)) : undefined,
      averageCadenceRpm: activity.avgCadence
        ? Math.round(Number(activity.avgCadence))
        : undefined,
      averagePowerWatts: activity.avgPower ? Math.round(Number(activity.avgPower)) : undefined,
    },
  })
  return json({ ok: true, ...result })
}
