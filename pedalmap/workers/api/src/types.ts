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
  /** Strava API application (optional legacy bridge — not shown in primary UI). */
  STRAVA_CLIENT_ID?: string
  STRAVA_CLIENT_SECRET?: string
  /** Official GPS cloud APIs (wrangler secret put). */
  WAHOO_CLIENT_ID?: string
  WAHOO_CLIENT_SECRET?: string
  WAHOO_WEBHOOK_TOKEN?: string
  IGPSPORT_CLIENT_ID?: string
  IGPSPORT_CLIENT_SECRET?: string
  IGPSPORT_WEBHOOK_TOKEN?: string
  IGPSPORT_AUTH_URL?: string
  IGPSPORT_TOKEN_URL?: string
  IGPSPORT_SCOPE?: string
  GARMIN_CLIENT_ID?: string
  GARMIN_CLIENT_SECRET?: string
  GARMIN_WEBHOOK_TOKEN?: string
  /** Optional Resend API key for transactional mail (alerts stub). */
  RESEND_API_KEY?: string
  /** Optional From header, e.g. `PedalMap <aviso@pedalmap.es>`. */
  MAIL_FROM?: string
  /** Instagram Graph API (own PedalMap professional account). */
  INSTAGRAM_ACCESS_TOKEN?: string
  INSTAGRAM_IG_USER_ID?: string
  /** Shared secret for ops publish endpoint (header X-PedalMap-Ops-Token). */
  INSTAGRAM_OPS_TOKEN?: string
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
