import type { Env } from './types'
import { json } from './types'
import type { FirebaseIdentity } from './firebaseAuth'
import { isAllowlistedPremiumEmail } from './premiumAllowlist'
import {
  claimFreeGpxExport,
  FREE_GPX_PER_WEEK,
  isoWeekKey,
  readUserEntitlements,
  writeUserPlan,
} from './firestore'
import { grantPremiumFromGrupetaSeat } from './grupetaPack'

const FREE_MAX_SAVED = 5

/**
 * Persist allowlist / Grupeta seat Premium to Firestore (Admin) and return effective entitlements.
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
  let grupetaSeat = false

  if (allowlisted && plan !== 'premium') {
    await writeUserPlan(env, identity.uid, 'premium')
    plan = 'premium'
  }

  if (plan !== 'premium') {
    try {
      grupetaSeat = await grantPremiumFromGrupetaSeat(env, identity)
      if (grupetaSeat) plan = 'premium'
    } catch (error) {
      console.warn('[sync-plan] grupeta seat', error)
    }
  }

  const week = isoWeekKey()
  const used =
    current?.freeGpxWeekKey === week ? (current.freeGpxUsedThisWeek ?? 0) : 0
  const freeGpxRemaining =
    plan === 'premium' ? null : Math.max(0, FREE_GPX_PER_WEEK - used)

  return json({
    ok: true,
    uid: identity.uid,
    email,
    plan,
    allowlisted,
    grupetaSeat,
    gpxExport: plan === 'premium' || (freeGpxRemaining ?? 0) > 0,
    freeGpxRemaining,
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
  let plan: 'free' | 'premium' =
    allowlisted || current?.plan === 'premium' ? 'premium' : 'free'
  let grupetaSeat = false

  if (allowlisted && current?.plan !== 'premium') {
    try {
      await writeUserPlan(env, identity.uid, 'premium')
    } catch (error) {
      console.warn('[entitlements] allowlist sync failed', error)
    }
  }

  if (plan !== 'premium') {
    try {
      grupetaSeat = await grantPremiumFromGrupetaSeat(env, identity)
      if (grupetaSeat) plan = 'premium'
    } catch (error) {
      console.warn('[entitlements] grupeta seat', error)
    }
  }

  const week = isoWeekKey()
  const used =
    current?.freeGpxWeekKey === week ? (current.freeGpxUsedThisWeek ?? 0) : 0
  const freeGpxRemaining =
    plan === 'premium' ? null : Math.max(0, FREE_GPX_PER_WEEK - used)

  return json({
    ok: true,
    uid: identity.uid,
    email,
    plan,
    allowlisted,
    grupetaSeat,
    gpxExport: plan === 'premium' || (freeGpxRemaining ?? 0) > 0,
    freeGpxRemaining,
    maxRoutesSaved: plan === 'premium' ? null : FREE_MAX_SAVED,
    routesSaved: current?.routesSaved ?? 0,
    canSaveRoute:
      plan === 'premium' || (current?.routesSaved ?? 0) < FREE_MAX_SAVED,
  })
}

/** Claim one Free weekly GPX export (or confirm Premium unlimited). */
export async function handleClaimGpx(
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  if (identity.isAnonymous) {
    return json({ error: 'Se requiere una cuenta real', code: 'auth_required' }, 401)
  }
  try {
    const result = await claimFreeGpxExport(env, identity.uid)
    if (!result.allowed) {
      return json(
        {
          ok: false,
          allowed: false,
          plan: result.plan,
          remaining: result.remaining,
          code: result.reason || 'gpx_week_limit',
          error: 'Tu GPX Free de esta semana ya está usado. Premium = ilimitado.',
        },
        403,
      )
    }
    return json({
      ok: true,
      allowed: true,
      plan: result.plan,
      remaining: result.remaining === Number.POSITIVE_INFINITY ? null : result.remaining,
    })
  } catch (error) {
    console.error('[claim-gpx]', error)
    return json({ error: 'No se pudo registrar el export GPX' }, 500)
  }
}
