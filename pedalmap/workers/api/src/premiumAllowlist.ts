import type { Env } from './types'

/** Default ops allowlist — override with env PREMIUM_ALLOWLIST (comma-separated). */
const DEFAULT_PREMIUM_EMAILS = ['rayvf2002@gmail.com', 'raymel.vb@gmail.com']

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
