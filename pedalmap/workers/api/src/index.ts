import type { Env } from './types'
import { corsHeaders, json } from './types'
import { handleOrsProxy } from './ors'
import { handleValhallaProxy } from './valhalla'
import { handleBikeRoute } from './bikeRoute'
import { handleCheckout, handlePortal, handleWebhook, handleStripeReadiness } from './stripe'
import {
  handleWindAlertEmail,
  handleFollowAlertEmail,
  handleRouteSavedEmail,
  handleCheersAlertEmail,
} from './alerts'
import { enforceRateLimit } from './rateLimit'
import { verifyFirebaseIdToken, type FirebaseIdentity } from './firebaseAuth'
import { handleMintCustomToken } from './customToken'
import { handleEntitlements, handleClaimGpx, handleSyncPlan } from './entitlements'
import { handleGetGrupetaPack, handleSetGrupetaSeats } from './grupetaPack'
import { handleReconcile } from './reconcile'
import {
  handleStravaDisconnect,
  handleStravaImportActivity,
  handleStravaListActivities,
  handleStravaOAuthCallback,
  handleStravaOAuthStart,
  handleStravaStatus,
} from './strava'
import {
  handleGpsDisconnect,
  handleGpsOAuthCallback,
  handleGpsOAuthStart,
  handleGpsStatus,
  handleGpsSync,
  handleGpsWebhook,
  isGpsProvider,
} from './gps'
import { handlePublishRoute } from './publishRoute'
import { handleSetWindAlert } from './windAlert'
import { handleInstagramPublish, handleInstagramStatus } from './instagram'
import {
  handleInstagramScheduleRun,
  handleInstagramScheduleStatus,
  runScheduledSocialPost,
} from './socialSchedule'
import { runRetentionNudges } from './retentionCron'
import { handleWaterSources } from './waterSources'
import { handleWeatherForecast } from './weatherForecast'
import {
  assertFilterLimitAllowed,
  assertRoutingCreateAllowed,
  bumpRoutesCreatedThisMonth,
  checkFreeCircularLimit,
  consumeFreeCircular,
  ensureAnonymousIdentityForIp,
  cleanupExpiredGuestIdentityMarkers,
  readUserEntitlements,
  QuotaLimitReachedError,
  QuotaUnavailableError,
} from './firestore'

function withCors(env: Env, request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  const cors = corsHeaders(env, request)
  for (const [k, v] of Object.entries(cors)) headers.set(k, String(v))
  return new Response(response.body, { status: response.status, headers })
}

/**
 * Reserve a single anonymous UID per public IP and UTC month. Cloudflare supplies
 * CF-Connecting-IP; X-Forwarded-For is intentionally not trusted for this gate.
 */
async function enforceAnonymousIdentityGate(
  env: Env,
  request: Request,
  identity: FirebaseIdentity,
): Promise<Response | null> {
  if (!identity.isAnonymous) return null
  try {
    await ensureAnonymousIdentityForIp(
      env,
      identity.uid,
      request.headers.get('CF-Connecting-IP'),
    )
    return null
  } catch (error) {
    if (error instanceof QuotaLimitReachedError) {
      return json({ error: error.message, code: error.code }, 403)
    }
    if (error instanceof QuotaUnavailableError) {
      console.error('[guest-quota] identity check unavailable', error.message)
      return json({ error: 'Guest quota check unavailable', code: 'quota_unavailable' }, 503)
    }
    throw error
  }
}

/**
 * ORS payloads normally contain provider-specific options, not the original
 * PedalMap preference list. The client sends that list as metadata for this
 * Worker; validate it before calculating and strip it before upstream forwarding.
 */
export async function enforceOrsFilterLimit(
  env: Env,
  request: Request,
  identity: FirebaseIdentity,
): Promise<Response | null> {
  let body: unknown
  try {
    body = await request.clone().json()
  } catch {
    // Keep malformed-body handling with the ORS proxy itself.
    return null
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null

  const preferences = (body as Record<string, unknown>).pedalmapPreferences
  if (!Array.isArray(preferences) || preferences.some((item) => typeof item !== 'string')) {
    return json(
      { error: 'Routing preference metadata missing or invalid', code: 'quota_unavailable' },
      503,
    )
  }

  try {
    const blocked = await assertFilterLimitAllowed(env, identity.uid, identity.isAnonymous, preferences)
    return blocked ? json(blocked, 403) : null
  } catch (error) {
    if (error instanceof QuotaUnavailableError) {
      return json({ error: 'Filter quota check unavailable', code: 'quota_unavailable' }, 503)
    }
    throw error
  }
}

async function getRouteOptionLimit(
  env: Env,
  identity: FirebaseIdentity,
): Promise<2 | 3 | Response> {
  try {
    const entitlements = await readUserEntitlements(env, identity.uid)
    if (!entitlements) {
      return json({ error: 'Route option entitlement unavailable', code: 'quota_unavailable' }, 503)
    }
    return entitlements.plan === 'premium' ? 3 : 2
  } catch (error) {
    console.error('[route-options] entitlement lookup failed', error)
    return json({ error: 'Route option entitlement unavailable', code: 'quota_unavailable' }, 503)
  }
}

/** Apply server-owned option and circular-trial limits before/after ORS. */
export async function handleOrsProxyWithEntitlements(
  env: Env,
  identity: FirebaseIdentity,
  request: Request,
  path: string,
): Promise<Response> {
  const maxRouteOptions = await getRouteOptionLimit(env, identity)
  if (maxRouteOptions instanceof Response) return maxRouteOptions

  let isCircularRequest = false
  try {
    const body = await request.clone().json() as unknown
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const options = (body as Record<string, unknown>).options
      isCircularRequest = Boolean(
        options &&
        typeof options === 'object' &&
        !Array.isArray(options) &&
        (options as Record<string, unknown>).round_trip &&
        typeof (options as Record<string, unknown>).round_trip === 'object',
      )
    }
  } catch {
    // handleOrsProxy remains responsible for returning the provider's malformed-body response.
  }

  if (isCircularRequest && maxRouteOptions === 2) {
    try {
      const blocked = await checkFreeCircularLimit(env, identity.uid)
      if (blocked) return json(blocked, 403)
    } catch (error) {
      if (error instanceof QuotaUnavailableError) {
        return json({ error: 'Circular quota check unavailable', code: 'quota_unavailable' }, 503)
      }
      throw error
    }
  }

  const response = await handleOrsProxy(request, env, path, maxRouteOptions)
  if (!response.ok) return response

  // ORS can return HTTP 200 with an empty feature list. That is not a route
  // creation, so normalize it to non-2xx before the monthly counter is bumped.
  let payload: Record<string, unknown>
  try {
    const parsed = await response.clone().json() as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Invalid ORS route response', code: 'provider_error' }, 502)
    }
    payload = parsed as Record<string, unknown>
    if (!Array.isArray(payload.features)) {
      return json({ error: 'ORS response did not include route features', code: 'provider_error' }, 502)
    }
  } catch {
    return json({ error: 'Invalid ORS route response', code: 'provider_error' }, 502)
  }
  if (payload.features.length === 0) {
    return json({ error: 'No route found', code: 'no_route' }, 404)
  }

  if (!isCircularRequest || maxRouteOptions === 3) return response

  // A circular trial is consumed only when ORS actually returns a route. The
  // Firestore CAS protects concurrent requests racing for the same monthly credit.
  try {
    await consumeFreeCircular(env, identity.uid)
  } catch (error) {
    if (error instanceof QuotaLimitReachedError) {
      return json({ error: error.message, code: error.code }, 403)
    }
    if (error instanceof QuotaUnavailableError) {
      console.error('[route-options] circular quota consumption failed', error.message)
      return json({ error: 'Circular quota consumption unavailable', code: 'quota_unavailable' }, 503)
    }
    throw error
  }

  // Tell the ORS client to return this first valid Free trial route immediately;
  // it must not launch a second seed/profile attempt that would spend the trial again.
  try {
    const payload = await response.json() as Record<string, unknown>
    payload.pedalmapQuotaConsumed = true
    const headers = new Headers(response.headers)
    headers.delete('content-length')
    headers.delete('content-encoding')
    headers.set('Content-Type', 'application/json')
    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch {
    return response
  }
}

/** Enforce anonymous identity + Free monthly quota; bump after a successful route. */
export function withRoutingCreateQuota(
  env: Env,
  identity: FirebaseIdentity,
  request: Request,
  run: () => Promise<Response>,
): Promise<Response>
/** Legacy registered-user call shape; anonymous calls without a Request fail closed. */
export function withRoutingCreateQuota(
  env: Env,
  identity: FirebaseIdentity,
  run: () => Promise<Response>,
): Promise<Response>
export async function withRoutingCreateQuota(
  env: Env,
  identity: FirebaseIdentity,
  requestOrRun: Request | (() => Promise<Response>),
  maybeRun?: () => Promise<Response>,
): Promise<Response> {
  const request = requestOrRun instanceof Request ? requestOrRun : null
  const run = typeof requestOrRun === 'function' ? requestOrRun : maybeRun
  if (!run) return json({ error: 'Quota check unavailable', code: 'quota_unavailable' }, 503)
  if (identity.isAnonymous) {
    if (!request) {
      return json({ error: 'Guest quota check requires the client IP', code: 'quota_unavailable' }, 503)
    }
    const guestIdentityBlock = await enforceAnonymousIdentityGate(env, request, identity)
    if (guestIdentityBlock) return guestIdentityBlock
  }
  let blocked: { error: string; code: string } | null
  try {
    blocked = await assertRoutingCreateAllowed(env, identity.uid, identity.isAnonymous)
  } catch (e) {
    if (e instanceof QuotaUnavailableError) {
      return json({ error: 'Quota check unavailable', code: 'quota_unavailable' }, 503)
    }
    throw e
  }
  if (blocked) return json(blocked, 403)
  const response = await run()
  if (response.ok) {
    try {
      await bumpRoutesCreatedThisMonth(env, identity.uid, identity.isAnonymous)
    } catch (e) {
      if (e instanceof QuotaLimitReachedError) {
        return json({ error: e.message, code: e.code }, 403)
      }
      if (e instanceof QuotaUnavailableError) {
        console.error('[create-quota] quota bump unavailable', e.message)
        return json({ error: 'Quota update unavailable', code: 'quota_unavailable' }, 503)
      }
      console.warn('[create-quota] bump failed', e)
      return json({ error: 'Quota update unavailable', code: 'quota_unavailable' }, 503)
    }
  }
  return response
}

async function requireFirebaseUser(
  env: Env,
  request: Request,
): Promise<FirebaseIdentity | Response> {
  try {
    return await verifyFirebaseIdToken(env, request.headers.get('Authorization'))
  } catch {
    return json(
      {
        error: 'Authentication required',
        code: 'auth_required',
        hint: 'Send Authorization: Bearer <Firebase ID token> (anonymous guests OK)',
      },
      401,
    )
  }
}

/** Account-only features must be protected by the Worker, not just UI controls. */
export function requireRegisteredAccount(identity: FirebaseIdentity): Response | null {
  if (!identity.isAnonymous) return null
  return json(
    {
      error: 'Crea una cuenta gratis para guardar rutas públicas y activar avisos de viento.',
      code: 'registration_required',
    },
    403,
  )
}

/** Per-uid limit, plus a tighter shared IP bucket for anonymous churn. */
async function enforceRoutingRateLimit(
  request: Request,
  identity: FirebaseIdentity,
  opts: { limit: number; windowSec: number; prefix: string; anonIpLimit?: number },
): Promise<Response | null> {
  const uidLimited = await enforceRateLimit(request, {
    limit: opts.limit,
    windowSec: opts.windowSec,
    prefix: opts.prefix,
    key: identity.uid,
  })
  if (uidLimited) return uidLimited
  if (!identity.isAnonymous) return null
  return enforceRateLimit(request, {
    limit: opts.anonIpLimit ?? Math.min(20, opts.limit),
    windowSec: opts.windowSec,
    prefix: `${opts.prefix}-anon-ip`,
  })
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      const deleted = await cleanupExpiredGuestIdentityMarkers(env, 100)
      console.log('[cron guest marker cleanup]', JSON.stringify({ deleted }))
    } catch (err) {
      console.error('[cron guest marker cleanup]', err instanceof Error ? err.message : err)
    }
    try {
      const result = await runScheduledSocialPost(env)
      console.log('[cron social]', JSON.stringify(result))
    } catch (err) {
      console.error('[cron social]', err instanceof Error ? err.message : err)
    }
    try {
      const nudges = await runRetentionNudges(env)
      console.log('[cron retention]', JSON.stringify(nudges))
    } catch (err) {
      console.error('[cron retention]', err instanceof Error ? err.message : err)
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) })
    }

    try {
      if (path === '/' && request.method === 'GET') {
        return withCors(
          env,
          request,
          json({
            ok: true,
            service: 'pedalmap-api',
            hint: 'ORS + Valhalla bike routing proxies (auth required)',
            health: '/health',
          }),
        )
      }

      if (path === '/osm/water-sources' && request.method === 'GET') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 30,
          windowSec: 60,
          prefix: 'osm-water',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleWaterSources(request, env))
      }

      if (path === '/osm/weather-forecast' && request.method === 'GET') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 30,
          windowSec: 60,
          prefix: 'osm-weather',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleWeatherForecast(request, env))
      }

      if (path === '/health' && request.method === 'GET') {
        return withCors(
          env,
          request,
          json({
            ok: true,
            service: 'pedalmap-api',
            stack: 'cloudflare-workers',
          }),
        )
      }

      if (path === '/health/stripe' && request.method === 'GET') {
        const limited = await enforceRateLimit(request, {
          limit: 5,
          windowSec: 60,
          prefix: 'stripe-readiness',
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleStripeReadiness(env))
      }

      if (path.startsWith('/v2/directions/') && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRoutingRateLimit(request, identity, {
          limit: 40,
          windowSec: 60,
          prefix: 'ors',
          anonIpLimit: 20,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(
          env,
          request,
          await withRoutingCreateQuota(env, identity, request, async () => {
            const filterBlock = await enforceOrsFilterLimit(env, request, identity)
            if (filterBlock) return filterBlock
            return handleOrsProxyWithEntitlements(env, identity, request, path)
          }),
        )
      }

      if (path === '/valhalla/bike-route' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRoutingRateLimit(request, identity, {
          limit: 30,
          windowSec: 60,
          prefix: 'valhalla-bike',
          anonIpLimit: 15,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(
          env,
          request,
          await withRoutingCreateQuota(env, identity, request, () =>
            handleBikeRoute(request, env, undefined, identity),
          ),
        )
      }

      if (path === '/valhalla/route' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRoutingRateLimit(request, identity, {
          limit: 40,
          windowSec: 60,
          prefix: 'valhalla',
          anonIpLimit: 20,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(
          env,
          request,
          await withRoutingCreateQuota(env, identity, request, () =>
            handleValhallaProxy(request, env, 'route'),
          ),
        )
      }

      if (path === '/valhalla/trace_attributes' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 60,
          windowSec: 60,
          prefix: 'valhalla-attr',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(
          env,
          request,
          await handleValhallaProxy(request, env, 'trace_attributes'),
        )
      }

      if (path === '/valhalla/height' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 60,
          windowSec: 60,
          prefix: 'valhalla-height',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleValhallaProxy(request, env, 'height'))
      }

      if (path === '/auth/custom-token' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 30,
          windowSec: 60,
          prefix: 'custom-token',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleMintCustomToken(env, identity))
      }

      if (path === '/me/sync-plan' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 20,
          windowSec: 60,
          prefix: 'sync-plan',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleSyncPlan(env, identity))
      }

      if (path === '/me/entitlements' && request.method === 'GET') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 60,
          windowSec: 60,
          prefix: 'entitlements',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleEntitlements(env, identity))
      }

      if (path === '/me/claim-gpx' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 20,
          windowSec: 60,
          prefix: 'claim-gpx',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        const guestIdentityBlock = await enforceAnonymousIdentityGate(env, request, identity)
        if (guestIdentityBlock) return withCors(env, request, guestIdentityBlock)
        return withCors(env, request, await handleClaimGpx(env, identity))
      }

      if (path === '/grupeta/pack' && request.method === 'GET') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 60,
          windowSec: 60,
          prefix: 'grupeta-pack',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleGetGrupetaPack(env, identity))
      }

      if (path === '/grupeta/seats' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 10,
          windowSec: 3600,
          prefix: 'grupeta-seats',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleSetGrupetaSeats(request, env, identity))
      }

      if (path === '/routes/publish' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 20,
          windowSec: 60,
          prefix: 'routes-publish',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        const accountRequired = requireRegisteredAccount(identity)
        if (accountRequired) return withCors(env, request, accountRequired)
        return withCors(env, request, await handlePublishRoute(request, env, identity))
      }

      if (path === '/routes/wind-alert' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 20,
          windowSec: 60,
          prefix: 'wind-alert',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        const accountRequired = requireRegisteredAccount(identity)
        if (accountRequired) return withCors(env, request, accountRequired)
        return withCors(env, request, await handleSetWindAlert(request, env, identity))
      }

      if (path === '/stripe/checkout' && request.method === 'POST') {
        const limited = await enforceRateLimit(request, {
          limit: 20,
          windowSec: 60,
          prefix: 'stripe',
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleCheckout(request, env))
      }

      if (path === '/stripe/portal' && request.method === 'POST') {
        const limited = await enforceRateLimit(request, {
          limit: 20,
          windowSec: 60,
          prefix: 'stripe',
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handlePortal(request, env))
      }

      if (path === '/stripe/webhook' && request.method === 'POST') {
        return handleWebhook(request, env)
      }

      if (path === '/alerts/email' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 10,
          windowSec: 60,
          prefix: 'alerts-email',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleWindAlertEmail(request, env, identity))
      }

      if (path === '/alerts/follow' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 20,
          windowSec: 60,
          prefix: 'alerts-follow',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleFollowAlertEmail(request, env, identity))
      }

      if (path === '/alerts/route-saved' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 12,
          windowSec: 60,
          prefix: 'alerts-route-saved',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleRouteSavedEmail(request, env, identity))
      }

      if (path === '/alerts/cheers' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 30,
          windowSec: 60,
          prefix: 'alerts-cheers',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleCheersAlertEmail(request, env, identity))
      }

      if (path === '/strava/oauth/start' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 20,
          windowSec: 60,
          prefix: 'strava-oauth',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleStravaOAuthStart(request, env, identity))
      }

      if (path === '/strava/oauth/callback' && request.method === 'GET') {
        // Browser redirect from Strava — no CORS wrapper needed.
        return handleStravaOAuthCallback(request, env)
      }

      if (path === '/strava/status' && request.method === 'GET') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        return withCors(env, request, await handleStravaStatus(env, identity))
      }

      if (path === '/strava/disconnect' && request.method === 'POST') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        return withCors(env, request, await handleStravaDisconnect(env, identity))
      }

      if (path === '/strava/activities' && request.method === 'GET') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        const limited = await enforceRateLimit(request, {
          limit: 30,
          windowSec: 60,
          prefix: 'strava-list',
          key: identity.uid,
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleStravaListActivities(env, identity, request))
      }

      {
        const importMatch = path.match(/^\/strava\/activities\/(\d+)\/import$/)
        if (importMatch && request.method === 'POST') {
          const identity = await requireFirebaseUser(env, request)
          if (identity instanceof Response) return withCors(env, request, identity)
          const limited = await enforceRateLimit(request, {
            limit: 20,
            windowSec: 60,
            prefix: 'strava-import',
            key: identity.uid,
          })
          if (limited) return withCors(env, request, limited)
          return withCors(
            env,
            request,
            await handleStravaImportActivity(env, identity, importMatch[1]),
          )
        }
      }

      if (path === '/gps/status' && request.method === 'GET') {
        const identity = await requireFirebaseUser(env, request)
        if (identity instanceof Response) return withCors(env, request, identity)
        return withCors(env, request, await handleGpsStatus(env, identity))
      }

      {
        const m = path.match(/^\/gps\/([a-z]+)\/oauth\/start$/)
        if (m && request.method === 'POST' && isGpsProvider(m[1])) {
          const identity = await requireFirebaseUser(env, request)
          if (identity instanceof Response) return withCors(env, request, identity)
          const limited = await enforceRateLimit(request, {
            limit: 20,
            windowSec: 60,
            prefix: 'gps-oauth',
            key: identity.uid,
          })
          if (limited) return withCors(env, request, limited)
          return withCors(env, request, await handleGpsOAuthStart(request, env, identity, m[1]))
        }
      }

      {
        const m = path.match(/^\/gps\/([a-z]+)\/oauth\/callback$/)
        if (m && request.method === 'GET' && isGpsProvider(m[1])) {
          return handleGpsOAuthCallback(request, env, m[1])
        }
      }

      {
        const m = path.match(/^\/gps\/([a-z]+)\/disconnect$/)
        if (m && request.method === 'POST' && isGpsProvider(m[1])) {
          const identity = await requireFirebaseUser(env, request)
          if (identity instanceof Response) return withCors(env, request, identity)
          return withCors(env, request, await handleGpsDisconnect(env, identity, m[1]))
        }
      }

      {
        const m = path.match(/^\/gps\/([a-z]+)\/sync$/)
        if (m && request.method === 'POST' && isGpsProvider(m[1])) {
          const identity = await requireFirebaseUser(env, request)
          if (identity instanceof Response) return withCors(env, request, identity)
          const limited = await enforceRateLimit(request, {
            limit: 10,
            windowSec: 60,
            prefix: 'gps-sync',
            key: identity.uid,
          })
          if (limited) return withCors(env, request, limited)
          return withCors(env, request, await handleGpsSync(env, identity, m[1]))
        }
      }

      {
        const m = path.match(/^\/gps\/([a-z]+)\/webhook$/)
        if (m && request.method === 'POST' && isGpsProvider(m[1])) {
          return handleGpsWebhook(request, env, m[1])
        }
      }

      if (path === '/ops/instagram/status' && request.method === 'GET') {
        return withCors(env, request, await handleInstagramStatus(request, env))
      }
      if (path === '/ops/instagram/publish' && request.method === 'POST') {
        return withCors(env, request, await handleInstagramPublish(request, env))
      }
      if (path === '/ops/instagram/schedule' && request.method === 'GET') {
        return withCors(env, request, await handleInstagramScheduleStatus(request, env))
      }
      if (path === '/ops/instagram/schedule/run' && request.method === 'POST') {
        return withCors(env, request, await handleInstagramScheduleRun(request, env))
      }

      if (path === '/ops/reconcile' && request.method === 'POST') {
        return withCors(env, request, await handleReconcile(request, env))
      }

      return withCors(env, request, json({ error: 'Not found', path }, 404))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unhandled error'
      const status = message.includes('Bearer') || message.includes('token') ? 401 : 500
      console.error('[worker]', message)
      return withCors(
        env,
        request,
        json(
          status === 401
            ? { error: 'Authentication required', code: 'auth_required' }
            : { error: 'Internal error', code: 'internal' },
          status,
        ),
      )
    }
  },
}
