import type { FreemiumLimits, RoutePreference, UserPlan, UserProfile } from '@/domain/types'
import { FREE_LIMITS, FREE_TRIALS, PREMIUM_LIMITS } from '@/domain/types'
import {
  guestCircularUsedThisMonth,
  guestGpxUsedThisWeek,
  isoWeekKey,
  utcMonthKey,
} from '@/lib/freemium'

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
  if (!profile) {
    // Offline / pre-auth guests share Free monthly create budget (not a harsh 3-try wall).
    if (guestCreates >= FREE_LIMITS.maxRoutesCreatedPerMonth) {
      return { ok: false, reason: 'guest_limit' }
    }
    return { ok: true }
  }
  const limits = getLimits(profile.plan)
  if (profile.usage.routesCreatedThisMonth >= limits.maxRoutesCreatedPerMonth) {
    return { ok: false, reason: 'create_limit' }
  }
  return { ok: true }
}

export function freeGpxRemaining(profile: UserProfile | null): number {
  if (!profile) {
    return Math.max(0, FREE_TRIALS.gpxPerWeek - guestGpxUsedThisWeek())
  }
  if (profile.plan === 'premium') return Number.POSITIVE_INFINITY
  const week = isoWeekKey()
  const used =
    profile.usage.freeGpxWeekKey === week ? (profile.usage.freeGpxUsedThisWeek ?? 0) : 0
  return Math.max(0, FREE_TRIALS.gpxPerWeek - used)
}

/** Premium unlimited, Free gets a soft weekly GPX taste. */
export function canExportGpx(profile: UserProfile | null): boolean {
  return freeGpxRemaining(profile) > 0
}

export function freeCircularRemaining(profile: UserProfile | null): number {
  if (!profile) {
    return Math.max(0, FREE_TRIALS.circularPerMonth - guestCircularUsedThisMonth())
  }
  if (profile.plan === 'premium') return Number.POSITIVE_INFINITY
  const key = utcMonthKey()
  const used =
    profile.usage.monthKey === key ? (profile.usage.freeCircularUsedThisMonth ?? 0) : 0
  return Math.max(0, FREE_TRIALS.circularPerMonth - used)
}

/**
 * Objetivo: Premium unlimited; Free/guest get 1 soft trial per month.
 * Paywall reason stays `circular_premium` when the trial is spent.
 */
export function canUseAdvancedCircular(profile: UserProfile | null): boolean {
  return freeCircularRemaining(profile) > 0
}

export function canUseAdvancedFilters(profile: UserProfile | null): boolean {
  // Guests (null profile) share Free limits — signing in must not reduce capability.
  if (!profile) return FREE_LIMITS.advancedFilters || FREE_LIMITS.maxActivePreferences > 0
  return getLimits(profile.plan).advancedFilters || getLimits(profile.plan).maxActivePreferences > 0
}

export function maxActivePreferences(profile: UserProfile | null): number {
  if (!profile) return FREE_LIMITS.maxActivePreferences
  return getLimits(profile.plan).maxActivePreferences
}

/**
 * Multi-select is always allowed. Free is capped by maxActivePreferences (2).
 * Premium is unlimited. Conflicting pairs are resolved by keeping the newest id.
 */
export function applyPreferenceToggle(
  current: RoutePreference[],
  id: RoutePreference,
  profile: UserProfile | null,
): { ok: true; next: RoutePreference[] } | { ok: false; reason: string; next: RoutePreference[] } {
  if (current.includes(id)) {
    return { ok: true, next: current.filter((v) => v !== id) }
  }

  let next = [...current, id]
  if (id === 'prefer_shorter') next = next.filter((v) => v !== 'prefer_faster')
  if (id === 'prefer_faster') next = next.filter((v) => v !== 'prefer_shorter')
  if (id === 'avoid_unpaved') next = next.filter((v) => v !== 'prefer_unpaved')
  if (id === 'prefer_unpaved') next = next.filter((v) => v !== 'avoid_unpaved')

  const limit = maxActivePreferences(profile)
  if (next.length > limit) {
    return { ok: false, reason: 'filter_limit', next: current }
  }
  return { ok: true, next }
}

export function clampPreferencesForPlan(
  preferences: RoutePreference[],
  profile: UserProfile | null,
): RoutePreference[] {
  const limit = maxActivePreferences(profile)
  if (preferences.length <= limit) return preferences
  return preferences.slice(0, limit)
}

/** @deprecated use clampPreferencesForPlan — kept for older tests */
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
  return clampPreferencesForPlan(preferences, profile)
}

/** How many saved routes Free/Premium may watch for wind alerts. */
export function windAlertRouteLimit(profile: UserProfile | null): number {
  if (!profile) return 0
  if (profile.plan === 'premium') return Number.POSITIVE_INFINITY
  return FREE_TRIALS.windAlertRoutes
}

export function windAlertRoutesRemaining(
  profile: UserProfile | null,
  routes: { windAlertEnabled?: boolean }[],
): number {
  const limit = windAlertRouteLimit(profile)
  if (!Number.isFinite(limit)) return Number.POSITIVE_INFINITY
  const used = routes.filter((r) => r.windAlertEnabled).length
  return Math.max(0, limit - used)
}

/**
 * Enable wind alert on a route. Turning off is always ok.
 * Requires profile.notifications.windAlertsEnabled.
 */
export function canEnableWindAlertOnRoute(
  profile: UserProfile | null,
  routes: { id: string; windAlertEnabled?: boolean }[],
  routeId: string,
): { ok: boolean; reason?: string } {
  if (!profile) return { ok: false, reason: 'auth_required' }
  if (!profile.notifications?.windAlertsEnabled) {
    return { ok: false, reason: 'alerts_off' }
  }
  const target = routes.find((r) => r.id === routeId)
  if (target?.windAlertEnabled) return { ok: true }
  if (windAlertRoutesRemaining(profile, routes) <= 0) {
    return { ok: false, reason: 'alert_route_limit' }
  }
  return { ok: true }
}
