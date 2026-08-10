import type { Env } from './types'
import { corsHeaders, json } from './types'
import { handleOrsProxy } from './ors'
import { handleValhallaProxy } from './valhalla'
import { handleBikeRoute } from './bikeRoute'
import { handleCheckout, handlePortal, handleWebhook } from './stripe'
import { enforceRateLimit } from './rateLimit'

function withCors(env: Env, request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  const cors = corsHeaders(env, request)
  for (const [k, v] of Object.entries(cors)) headers.set(k, String(v))
  return new Response(response.body, { status: response.status, headers })
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
            hint: 'ORS + Valhalla bike routing proxies',
            health: '/health',
          }),
        )
      }

      if (path === '/health' && request.method === 'GET') {
        const stadia = Boolean(env.STADIA_API_KEY)
        const valhallaUrl = env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de'
        return withCors(
          env,
          request,
          json({
            ok: true,
            service: 'pedalmap-api',
            stack: 'cloudflare-workers',
            blaze: false,
            orsConfigured: Boolean(env.ORS_API_KEY),
            valhalla: {
              mode: stadia ? 'stadiamaps' : 'url',
              url: stadia ? 'https://api.stadiamaps.com' : valhallaUrl,
              commercialReady: stadia,
            },
            stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
            firestoreAdminConfigured: Boolean(env.FIREBASE_SERVICE_ACCOUNT),
            prices: {
              month: env.STRIPE_PRICE_MONTHLY,
              year: env.STRIPE_PRICE_YEARLY,
            },
          }),
        )
      }

      if (path.startsWith('/v2/directions/') && request.method === 'POST') {
        const limited = await enforceRateLimit(request, {
          limit: 40,
          windowSec: 60,
          prefix: 'ors',
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleOrsProxy(request, env, path))
      }

      if (path === '/valhalla/bike-route' && request.method === 'POST') {
        const limited = await enforceRateLimit(request, {
          limit: 30,
          windowSec: 60,
          prefix: 'valhalla-bike',
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleBikeRoute(request, env))
      }

      if (path === '/valhalla/route' && request.method === 'POST') {
        const limited = await enforceRateLimit(request, {
          limit: 40,
          windowSec: 60,
          prefix: 'valhalla',
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleValhallaProxy(request, env, 'route'))
      }

      if (path === '/valhalla/trace_attributes' && request.method === 'POST') {
        const limited = await enforceRateLimit(request, {
          limit: 60,
          windowSec: 60,
          prefix: 'valhalla-attr',
        })
        if (limited) return withCors(env, request, limited)
        return withCors(
          env,
          request,
          await handleValhallaProxy(request, env, 'trace_attributes'),
        )
      }

      if (path === '/valhalla/height' && request.method === 'POST') {
        const limited = await enforceRateLimit(request, {
          limit: 60,
          windowSec: 60,
          prefix: 'valhalla-height',
        })
        if (limited) return withCors(env, request, limited)
        return withCors(env, request, await handleValhallaProxy(request, env, 'height'))
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
