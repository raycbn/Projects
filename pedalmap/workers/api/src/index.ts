import type { Env } from './types'
import { corsHeaders, json } from './types'
import { handleOrsProxy } from './ors'
import { handleValhallaProxy } from './valhalla'
import { handleBikeRoute } from './bikeRoute'
import { handleCheckout, handlePortal, handleWebhook } from './stripe'
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
import { handleInstagramPublish, handleInstagramStatus } from './instagram'
import {
  handleInstagramScheduleRun,
  handleInstagramScheduleStatus,
  runScheduledSocialPost,
} from './socialSchedule'
import { runRetentionNudges } from './retentionCron'
import {
  assertRoutingCreateAllowed,
  bumpRoutesCreatedThisMonth,
} from './firestore'

function withCors(env: Env, request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  const cors = corsHeaders(env, request)
  for (const [k, v] of Object.entries(cors)) headers.set(k, String(v))
  return new Response(response.body, { status: response.status, headers })
}

/** Enforce Free monthly create cap; bump usage after a successful routing response. */
async function withRoutingCreateQuota(
  env: Env,
  identity: FirebaseIdentity,
  run: () => Promise<Response>,
): Promise<Response> {
  const blocked = await assertRoutingCreateAllowed(env, identity.uid)
  if (blocked) return json(blocked, 403)
  const response = await run()
  if (response.ok) {
    void bumpRoutesCreatedThisMonth(env, identity.uid).catch((err) => {
      console.warn('[create-quota] bump failed', err)
    })
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
          await withRoutingCreateQuota(env, identity, () =>
            handleOrsProxy(request, env, path),
          ),
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
          await withRoutingCreateQuota(env, identity, () => handleBikeRoute(request, env)),
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
        return withCors(env, request, await handleValhallaProxy(request, env, 'route'))
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
        return withCors(env, request, await handlePublishRoute(request, env, identity))
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
