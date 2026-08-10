/**
 * Hard-granted Premium accounts (ops allowlist).
 * Matched case-insensitively on the Firebase Auth email.
 */
const PREMIUM_EMAILS = new Set(
  ['rayvf2002@gmail.com', 'raymel.vb@gmail.com'].map((e) => e.toLowerCase()),
)

export function isAllowlistedPremiumEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return PREMIUM_EMAILS.has(email.trim().toLowerCase())
}

export function applyPremiumAllowlist<T extends { email?: string | null; plan: 'free' | 'premium' }>(
  profile: T,
): T {
  if (isAllowlistedPremiumEmail(profile.email)) {
    return { ...profile, plan: 'premium' }
  }
  return profile
}
