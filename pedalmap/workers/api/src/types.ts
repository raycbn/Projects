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
  /** Optional: Stadia Maps API key → commercial Valhalla hosting. */
  STADIA_API_KEY?: string
  /** Optional: self-hosted or public Valhalla base (default FOSSGIS). */
  VALHALLA_URL?: string
  /** Optional comma-separated emails granted Premium without Stripe. */
  PREMIUM_ALLOWLIST?: string
  /** Strava API application (free OAuth bridge for iGPSPORT / Garmin / etc.). */
  STRAVA_CLIENT_ID?: string
  STRAVA_CLIENT_SECRET?: string
}

export const ORS_BASE = 'https://api.heigit.org/openrouteservice'

export function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isOriginAllowed(env: Env, origin: string): boolean {
  if (!origin) return false
  const allowed = allowedOrigins(env)
  return allowed.includes('*') || allowed.includes(origin)
}

/** Prefer the browser Origin (Hosting) when allowlisted; else fall back to APP_URL. */
export function resolveAppUrl(env: Env, request: Request): string {
  const origin = request.headers.get('Origin') || ''
  if (isOriginAllowed(env, origin)) return origin.replace(/\/+$/, '')
  return (env.APP_URL || '').replace(/\/+$/, '')
}

export function corsHeaders(env: Env, request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || ''
  const allowed = allowedOrigins(env)
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
