/**
 * Client no longer ships an email allowlist.
 * Premium ops grants are synced via Worker POST /me/sync-plan (Admin write to users.plan).
 * These helpers only trust the Firestore `plan` field after sync.
 */

export function applyPremiumAllowlist<T extends { email?: string | null; plan: 'free' | 'premium' }>(
  profile: T,
): T {
  // No client-side spoof: plan comes from Firestore (Worker/Stripe Admin writes).
  return profile
}

/** @deprecated Prefer server sync — kept for tests that still call the old name. */
export function isAllowlistedPremiumEmail(_email: string | null | undefined): boolean {
  return false
}
