import type { Env } from './types'
import { json } from './types'
import type { FirebaseIdentity } from './firebaseAuth'
import { isAllowlistedPremiumEmail } from './premiumAllowlist'
import { readUserEntitlements, writeUserPlan } from './firestore'

const FREE_MAX_SAVED = 5

/**
 * Persist allowlist Premium to Firestore (Admin) and return effective entitlements.
 * Spark-friendly: no Cloud Functions / custom claims required.
 */
export async function handleSyncPlan(
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  const email = identity.email ?? null
  const allowlisted = isAllowlistedPremiumEmail(env, email)
  const current = await readUserEntitlements(env, identity.uid)
  let plan: 'free' | 'premium' = current?.plan ?? 'free'

  if (allowlisted && plan !== 'premium') {
    await writeUserPlan(env, identity.uid, 'premium')
    plan = 'premium'
  }

  return json({
    ok: true,
    uid: identity.uid,
    email,
    plan,
    allowlisted,
    gpxExport: plan === 'premium',
    maxRoutesSaved: plan === 'premium' ? null : FREE_MAX_SAVED,
    routesSaved: current?.routesSaved ?? 0,
  })
}

export async function handleEntitlements(
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  const email = identity.email ?? null
  const allowlisted = isAllowlistedPremiumEmail(env, email)
  const current = await readUserEntitlements(env, identity.uid)
  const plan: 'free' | 'premium' =
    allowlisted || current?.plan === 'premium' ? 'premium' : 'free'

  // Soft-heal: if allowlisted but Firestore still free, sync now.
  if (allowlisted && current?.plan !== 'premium') {
    try {
      await writeUserPlan(env, identity.uid, 'premium')
    } catch (error) {
      console.warn('[entitlements] allowlist sync failed', error)
    }
  }

  return json({
    ok: true,
    uid: identity.uid,
    email,
    plan,
    allowlisted,
    gpxExport: plan === 'premium',
    maxRoutesSaved: plan === 'premium' ? null : FREE_MAX_SAVED,
    routesSaved: current?.routesSaved ?? 0,
    canSaveRoute:
      plan === 'premium' || (current?.routesSaved ?? 0) < FREE_MAX_SAVED,
  })
}
