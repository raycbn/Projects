import type { Env } from './types'
import { corsHeaders, json } from './types'
import { handleOrsProxy } from './ors'
import { handleCheckout, handlePortal, handleWebhook } from './stripe'

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
            hint: 'Use GET /health, POST /v2/directions/{profile}/geojson, POST /stripe/checkout',
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
            blaze: false,
            orsConfigured: Boolean(env.ORS_API_KEY),
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
        return withCors(env, request, await handleOrsProxy(request, env, path))
      }

      if (path === '/stripe/checkout' && request.method === 'POST') {
        return withCors(env, request, await handleCheckout(request, env))
      }

      if (path === '/stripe/portal' && request.method === 'POST') {
        return withCors(env, request, await handlePortal(request, env))
      }

      if (path === '/stripe/webhook' && request.method === 'POST') {
        // Stripe webhooks don't need CORS
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
