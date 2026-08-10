import type { FreemiumLimits, RoutePreference, UserPlan, UserProfile } from '@/domain/types'
import { FREE_LIMITS, PREMIUM_LIMITS } from '@/domain/types'

export function getLimits(plan: UserPlan): FreemiumLimits {
  return plan === 'premium' ? PREMIUM_LIMITS : FREE_LIMITS
}

export function canSaveRoute(profile: UserProfile | null): { ok: boolean; reason?: string } {
  if (!profile) return { ok: false, reason: 'auth_required' }
  const limits = getLimits(profile.plan)
  if (profile.usage.routesSaved >= limits.maxRoutesSaved) {
    return { ok: false, reason: 'save_limit' }
  }
  return { ok: true }
}

export function canCreateRoute(profile: UserProfile | null, guestCreates: number): {
  ok: boolean
  reason?: string
} {
  // Guests can try a few routes without signup
  if (!profile) {
    if (guestCreates >= 3) return { ok: false, reason: 'guest_limit' }
    return { ok: true }
  }
  const limits = getLimits(profile.plan)
  if (profile.usage.routesCreatedThisMonth >= limits.maxRoutesCreatedPerMonth) {
    return { ok: false, reason: 'create_limit' }
  }
  return { ok: true }
}

export function canExportGpx(profile: UserProfile | null): boolean {
  if (!profile) return false
  return getLimits(profile.plan).gpxExport
}

export function canUseAdvancedFilters(profile: UserProfile | null): boolean {
  if (!profile) return true // guests can try filters in MVP; paywall on save/create limits
  return getLimits(profile.plan).advancedFilters
}

export function canUseAdvancedCircular(profile: UserProfile | null): boolean {
  if (!profile) return true
  return getLimits(profile.plan).advancedCircular
}

/** Preferences that require Premium when the user is on free + already signed in. */
export const PREMIUM_FILTER_PREFERENCES: RoutePreference[] = [
  'prefer_secondary_roads',
  'avoid_primary_roads',
  'prefer_unpaved',
  'avoid_unpaved',
]

export function filterPreferencesForPlan(
  preferences: RoutePreference[],
  profile: UserProfile | null,
): RoutePreference[] {
  if (canUseAdvancedFilters(profile)) return preferences
  return preferences.filter((p) => !PREMIUM_FILTER_PREFERENCES.includes(p))
}
