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

function withCors(env: Env, request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  const cors = corsHeaders(env, request)
  for (const [k, v] of Object.entries(cors)) headers.set(k, String(v))
  return new Response(response.body, { status: response.status, headers })
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
        return withCors(env, request, await handleOrsProxy(request, env, path))
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
        return withCors(env, request, await handleBikeRoute(request, env))
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

      return withCors(env, request, json({ error: 'Not found', path }, 404))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unhandled error'
      const status = message.includes('Bearer') || message.includes('token') ? 401 : 500
      console.error('[worker]', message)
      return withCors(env, request, json({ error: message }, status))
    }
  },
}
