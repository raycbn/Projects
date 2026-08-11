import type { Env } from './types'

/**
 * Ops Premium allowlist (Firebase Auth email match).
 * Default is the brand inbox only — never commit personal Gmail here.
 * Override with env PREMIUM_ALLOWLIST (Cloudflare var/secret, comma-separated).
 */
const DEFAULT_PREMIUM_EMAILS = ['premium@pedalmap.es']

export function premiumAllowlistEmails(env: Env): Set<string> {
  const raw = (env.PREMIUM_ALLOWLIST || '').trim()
  const list = raw
    ? raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_PREMIUM_EMAILS.map((e) => e.toLowerCase())
  return new Set(list)
}

export function isAllowlistedPremiumEmail(env: Env, email: string | null | undefined): boolean {
  if (!email) return false
  return premiumAllowlistEmails(env).has(email.trim().toLowerCase())
}
