export interface Env {
  ORS_API_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET?: string
  FIREBASE_SERVICE_ACCOUNT?: string
  FIREBASE_PROJECT_ID: string
  STRIPE_PRICE_MONTHLY: string
  STRIPE_PRICE_YEARLY: string
  APP_URL: string
  ALLOWED_ORIGINS?: string
}

export const ORS_BASE = 'https://api.heigit.org/openrouteservice'

export function corsHeaders(env: Env, request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const allowOrigin =
    origin && (allowed.includes(origin) || allowed.includes('*')) ? origin : allowed[0] || '*'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
    'Access-Control-Max-Age': '86400',
  }
}

export function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(extra || {}),
    },
  })
}
