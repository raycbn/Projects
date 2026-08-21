import type { Env } from './types'
import { json } from './types'
import { resolveEffectivePlan } from './entitlements'
import { upsertSubscriptionAndPlan, writeUserPlan } from './firestore'

function requireOpsAuth(request: Request, env: Env): Response | null {
  const expected = (env.RECONCILE_OPS_TOKEN || '').trim()
  if (!expected) return json({ error: 'RECONCILE_OPS_TOKEN not configured' }, 503)
  const got = request.headers.get('X-PedalMap-Ops-Token') || ''
  if (got !== expected) return json({ error: 'Unauthorized' }, 401)
  return null
}

export async function handleReconcile(request: Request, env: Env): Promise<Response> {
  const denied = requireOpsAuth(request, env)
  if (denied) return denied

  let body: { uid?: string; dryRun?: boolean } = {}
  if (request.method === 'POST') {
    const raw = await request.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }
    if (!parsed || typeof parsed !== 'object') {
      return json({ error: 'Invalid JSON body' }, 400)
    }
    const obj = parsed as Record<string, unknown>
    if (typeof obj.uid !== 'string' || typeof obj.dryRun !== 'boolean') {
      return json({ error: 'Invalid JSON body' }, 400)
    }
    body = {
      uid: obj.uid,
      dryRun: obj.dryRun,
    }
  }

  const uid = typeof body.uid === 'string' ? body.uid.trim() : ''
  if (!uid || uid.length < 10 || uid.length > 128) {
    return json({ error: 'Invalid uid' }, 400)
  }

  const dryRun = body.dryRun === true

  const identity = {
    uid,
    email: undefined,
    emailVerified: true,
    isAnonymous: false,
  }

  const result = await resolveEffectivePlan(env, identity)
  const plan = result.plan

  if (plan !== 'premium') {
    return json({
      plan,
      dryRun,
      updated: false,
      wouldUpdate: [],
    })
  }

  if (dryRun) {
    return json({
      plan,
      dryRun: true,
      updated: false,
      wouldUpdate: [
        `subscriptions/${uid}`,
        `users/${uid}.plan`,
      ],
    })
  }

  await upsertSubscriptionAndPlan(env, {
    uid,
    plan: 'premium',
    status: 'active',
  })
  await writeUserPlan(env, uid, 'premium')

  return json({
    plan,
    dryRun: false,
    updated: true,
    wouldUpdate: [
      `subscriptions/${uid}`,
      `users/${uid}.plan`,
    ],
  })
}
