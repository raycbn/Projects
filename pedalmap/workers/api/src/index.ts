import type { Env } from './types'
import { corsHeaders, json } from './types'
import { handleOrsProxy } from './ors'
import { handleValhallaProxy } from './valhalla'
import { handleBikeRoute } from './bikeRoute'
import { handleCheckout, handlePortal, handleWebhook } from './stripe'
import { enforceRateLimit } from './rateLimit'
import { verifyFirebaseIdToken, type FirebaseIdentity } from './firebaseAuth'
import { handleMintCustomToken } from './customToken'
import { handleEntitlements, handleSyncPlan } from './entitlements'
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

export default {
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
        const limited = await enforceRateLimit(request, {
          limit: 40,
          windowSec: 60,
          prefix: 'ors',
          key: identity.uid,
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
        const limited = await enforceRateLimit(request, {
          limit: 30,
          windowSec: 60,
          prefix: 'valhalla-bike',
          key: identity.uid,
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
        const limited = await enforceRateLimit(request, {
          limit: 40,
          windowSec: 60,
          prefix: 'valhalla',
          key: identity.uid,
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

      return withCors(env, request, json({ error: 'Not found', path }, 404))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unhandled error'
      const status = message.includes('Bearer') || message.includes('token') ? 401 : 500
      console.error('[worker]', message)
      return withCors(env, request, json({ error: message }, status))
    }
  },
}
