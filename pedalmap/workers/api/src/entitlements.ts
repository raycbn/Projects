import type { Env } from './types'
import { json } from './types'
import type { FirebaseIdentity } from './firebaseAuth'
import { isAllowlistedPremiumEmail } from './premiumAllowlist'
import {
  claimFreeGpxExport,
  FREE_GPX_PER_WEEK,
  isoWeekKey,
  readSeatIndex,
  readSubscriptionCustomerId,
  readSubscriptionRecord,
  readUserEntitlements,
  revokePremiumUnlessProtected,
  upsertSubscriptionAndPlan,
  writeUserPlan,
} from './firestore'
import { listCustomerSubscriptions } from './stripe'
import {
  emailDocId,
  grantPremiumFromGrupetaSeat,
  packIsBillable,
} from './grupetaPack'
import { evaluatePlan, type EvaluatePlanInput } from './entitlementRules'

const FREE_MAX_SAVED = 5

async function resolveEffectivePlan(
  env: Env,
  identity: FirebaseIdentity,
): Promise<{ plan: 'free' | 'premium'; allowlisted: boolean; grupetaSeat: boolean }> {
  const email = identity.email ?? null
  const allowlisted = isAllowlistedPremiumEmail(env, email)
  if (allowlisted) {
    await writeUserPlan(env, identity.uid, 'premium')
    return { plan: 'premium', allowlisted: true, grupetaSeat: false }
  }

  const sub = await readSubscriptionRecord(env, identity.uid)
  const customerId = await readSubscriptionCustomerId(env, identity.uid)
  let stripeSubs: Array<{ status: string; product: 'solo' | 'grupeta'; id: string; hasTrialed: boolean }> = []
  if (customerId) {
    try {
      stripeSubs = await listCustomerSubscriptions(env, customerId)
    } catch (error) {
      console.warn('[plan] stripe fallback failed', error)
    }
  }

  const input: EvaluatePlanInput = {
    allowlisted: false,
    sub: sub ?? null,
    customerId,
    stripeSubs,
    email,
    emailVerified: identity.emailVerified,
    hasGrupetaSeat: false,
    annualTrialUsed: sub?.annualTrialUsed,
  }

  const evaluated = evaluatePlan(input)

  if (evaluated.shouldUpsert) {
    await upsertSubscriptionAndPlan(env, {
      uid: identity.uid,
      plan: evaluated.plan,
      status: evaluated.status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: evaluated.stripeSubscriptionId,
      product: evaluated.product,
      soloSubscriptionId: evaluated.soloSubscriptionId,
      soloStatus: evaluated.soloStatus,
      grupetaSubscriptionId: evaluated.grupetaSubscriptionId,
      grupetaStatus: evaluated.grupetaStatus,
      annualTrialUsed: evaluated.annualTrialUsed,
    })
  }

  if (evaluated.shouldWritePlan) {
    await writeUserPlan(env, identity.uid, evaluated.plan)
  }

  // Seat grant requires verified email (blocks unverified register-to-steal).
  let grupetaSeat = false
  if (identity.email && identity.emailVerified) {
    try {
      grupetaSeat = await grantPremiumFromGrupetaSeat(env, identity)
    } catch (error) {
      console.warn('[plan] grupeta seat', error)
    }
    if (grupetaSeat) return { plan: 'premium', allowlisted: false, grupetaSeat: true }
  } else if (identity.email && !identity.emailVerified) {
    const idx = await readSeatIndex(env, await emailDocId(identity.email))
    if (idx && packIsBillable(idx.status)) {
      console.info('[plan] seat pending email verification', identity.uid)
    }
  }

  // Reconcile downgrade: Firestore said premium but no paying source.
  const current = await readUserEntitlements(env, identity.uid)
  if (current?.plan === 'premium') {
    await revokePremiumUnlessProtected(env, identity.uid, {
      email,
    })
    const after = await readUserEntitlements(env, identity.uid)
    return {
      plan: after?.plan === 'premium' ? 'premium' : 'free',
      allowlisted: false,
      grupetaSeat: false,
    }
  }

  return { plan: evaluated.plan, allowlisted: false, grupetaSeat }
}

export async function handleSyncPlan(
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  const email = identity.email ?? null
  const { plan, allowlisted, grupetaSeat } = await resolveEffectivePlan(env, identity)
  const current = await readUserEntitlements(env, identity.uid)

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
    emailVerified: identity.emailVerified,
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
  const { plan, allowlisted, grupetaSeat } = await resolveEffectivePlan(env, identity)
  const current = await readUserEntitlements(env, identity.uid)

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
    emailVerified: identity.emailVerified,
    gpxExport: plan === 'premium' || (freeGpxRemaining ?? 0) > 0,
    freeGpxRemaining,
    maxRoutesSaved: plan === 'premium' ? null : FREE_MAX_SAVED,
    routesSaved: current?.routesSaved ?? 0,
    canSaveRoute:
      plan === 'premium' || (current?.routesSaved ?? 0) < FREE_MAX_SAVED,
  })
}

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
