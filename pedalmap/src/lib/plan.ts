import type { UserProfile } from '@/domain/types'

/** True when the signed-in profile has an active Premium plan. */
export function isPremiumUser(
  profile: Pick<UserProfile, 'plan'> | null | undefined,
): boolean {
  return profile?.plan === 'premium'
}
