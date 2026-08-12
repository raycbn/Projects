import type { PublicProfile } from '@/domain/types'

/** Prefer a real name; never publish the placeholder «Ciclista» as identity. */
export function resolvePublicDisplayName(
  displayName: string | null | undefined,
  email?: string | null,
): string | null {
  const name = displayName?.trim()
  if (name && name.toLowerCase() !== 'ciclista') return name
  const local = email?.split('@')[0]?.trim()
  if (local) return local
  return null
}

/**
 * Only show cyclists that look like real accounts (not lean follow stubs
 * with null/"Ciclista" names and no activity).
 */
export function isDiscoverableCyclist(profile: PublicProfile): boolean {
  if (profile.isPublic === false) return false
  const name = profile.displayName?.trim()
  const hasRealName = Boolean(name && name.toLowerCase() !== 'ciclista')
  const hasPhoto = Boolean(profile.photoURL)
  const hasRoutes = (profile.routesPublicCount ?? 0) > 0
  return hasRealName || hasPhoto || hasRoutes
}
