import type { FreemiumLimits, UserPlan, UserProfile } from '@/domain/types'
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
