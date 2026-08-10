/**
 * Garmin Connect Developer Program — OAuth2 PKCE (partner approval required).
 * https://developerportal.garmin.com/
 */
import type { Env } from '../types'
import { json } from '../types'
import type { FirebaseIdentity } from '../firebaseAuth'
import { writeGpsConnection, writeGpsProviderIndex } from '../firestore'
import { appRedirect, workerCallbackUrl } from './oauthState'
import { makeGarminState, parseGarminState } from './garminState'
import { persistProviderActivity } from './persist'
import { resolveUidForProviderUser } from './lookup'

const AUTH = 'https://connect.garmin.com/oauth2Confirm'
const TOKEN = 'https://diauth.garmin.com/di-oauth2-service/oauth/token'

function secrets(env: Env) {
  if (!env.GARMIN_CLIENT_ID || !env.GARMIN_CLIENT_SECRET) return null
  return { id: env.GARMIN_CLIENT_ID, secret: env.GARMIN_CLIENT_SECRET }
}

function randomVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function challengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function handleGarminOAuthStart(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  const s = secrets(env)
  if (!s) {
    return json(
      {
        error: 'Garmin pendiente de Developer Program',
        code: 'gps_not_configured',
        hint: 'Aplica en developerportal.garmin.com (docs/GPS_OFFICIAL_SYNC.md)',
      },
      503,
    )
  }
  const verifier = randomVerifier()
  const challenge = await challengeS256(verifier)
  const state = await makeGarminState(s.secret, identity.uid, verifier)
  const params = new URLSearchParams({
    client_id: s.id,
    response_type: 'code',
    redirect_uri: workerCallbackUrl(request, 'garmin'),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  })
  return json({ ok: true, url: `${AUTH}?${params}` })
}

export async function handleGarminOAuthCallback(request: Request, env: Env): Promise<Response> {
  const s = secrets(env)
  if (!s) return appRedirect(env, false, 'garmin', 'not_configured')
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return appRedirect(env, false, 'garmin', 'missing_code')

  const parsed = await parseGarminState(s.secret, state)
  if (!parsed) return appRedirect(env, false, 'garmin', 'bad_state')

  const tokenRes = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: s.id,
      client_secret: s.secret,
      code,
      code_verifier: parsed.verifier,
      redirect_uri: workerCallbackUrl(request, 'garmin'),
    }),
  })
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.refresh_token) {
    console.error('[garmin] token', tokenJson)
    return appRedirect(env, false, 'garmin', 'token')
  }

  const externalUserId = `pending:${parsed.uid}`
  await writeGpsConnection(env, parsed.uid, {
    provider: 'garmin',
    externalUserId,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(tokenJson.expires_in || 86400),
  })
  await writeGpsProviderIndex(env, 'garmin', externalUserId, parsed.uid)
  return appRedirect(env, true, 'garmin')
}

export async function handleGarminWebhook(request: Request, env: Env): Promise<Response> {
  const expected = env.GARMIN_WEBHOOK_TOKEN
  if (expected) {
    const hdr = request.headers.get('Authorization') || ''
    if (!hdr.includes(expected)) return json({ error: 'invalid webhook token' }, 401)
  }
  const body = (await request.json()) as {
    userId?: string
    activities?: Array<Record<string, unknown>>
    activityDetails?: Array<Record<string, unknown>>
  }
  const garminUser = String(body.userId || '')
  if (!garminUser) return json({ ok: true, empty: true })
  const uid = await resolveUidForProviderUser(env, 'garmin', garminUser)
  if (!uid) return json({ ok: true, unmatched: true })

  const items = body.activities || body.activityDetails || []
  let imported = 0
  for (const a of items) {
    const id = String(a.activityId || a.summaryId || '')
    if (!id) continue
    const distance = Number(a.distanceInMeters || a.distance || 0)
    const duration = Number(a.durationInSeconds || a.movingDurationInSeconds || 0)
    const startedAt = String(
      a.startTimeInSeconds
        ? new Date(Number(a.startTimeInSeconds) * 1000).toISOString()
        : a.startTime || new Date().toISOString(),
    )
    const result = await persistProviderActivity(env, uid, {
      provider: 'garmin',
      externalId: `garmin:${id}`,
      title: String(a.activityName || a.activityType || `Garmin #${id}`),
      bikeType: 'road',
      startedAt,
      finishedAt: duration
        ? new Date(Date.parse(startedAt) + duration * 1000).toISOString()
        : undefined,
      track: [],
      stats: {
        distanceMeters: Math.round(distance),
        durationSeconds: Math.round(duration),
        movingTimeSeconds: Math.round(Number(a.movingDurationInSeconds || duration)),
        elevationGainMeters: Math.round(Number(a.totalElevationGainInMeters || 0)),
        averageHeartRateBpm: a.averageHeartRateInBeatsPerMinute
          ? Math.round(Number(a.averageHeartRateInBeatsPerMinute))
          : undefined,
        averagePowerWatts: a.averagePowerInWatts
          ? Math.round(Number(a.averagePowerInWatts))
          : undefined,
        averageSpeedMetersPerSecond: a.averageSpeedInMetersPerSecond
          ? Number(a.averageSpeedInMetersPerSecond)
          : undefined,
      },
    })
    if (result.created) imported += 1
  }
  return json({ ok: true, imported })
}
