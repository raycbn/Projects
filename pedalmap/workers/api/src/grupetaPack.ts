/**
 * Pack Grupeta — 4 Premium seats (owner + 3), assigned after payment.
 * All plan writes are Admin-only; clients never set users.plan.
 */
import type { Env } from './types'
import { json } from './types'
import type { FirebaseIdentity } from './firebaseAuth'
import {
  findUserUidByEmail,
  readGrupetaPack,
  readSeatIndex,
  revokePremiumUnlessProtected,
  writeGrupetaPack,
  writeSeatIndex,
  writeUserPlan,
  type GrupetaPack,
  type GrupetaSeat,
} from './firestore'

export const GRUPETA_SEAT_LIMIT = 4
export const GRUPETA_MEMBER_SEATS = GRUPETA_SEAT_LIMIT - 1

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  if (email.length < 5 || email.length > 120) return false
  // Practical validation — not full RFC.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function emailDocId(email: string): Promise<string> {
  const normalized = normalizeEmail(email)
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function packIsBillable(status: string): boolean {
  return status === 'active' || status === 'trialing'
}

/** Create/refresh pack when Stripe says the Grupeta subscription is paying. */
export async function activateGrupetaPack(
  env: Env,
  input: {
    ownerUid: string
    ownerEmail?: string | null
    status: string
    interval?: 'month' | 'year'
    stripeCustomerId?: string
    stripeSubscriptionId?: string
  },
): Promise<void> {
  const now = new Date().toISOString()
  const existing = await readGrupetaPack(env, input.ownerUid)
  const ownerEmail = normalizeEmail(input.ownerEmail || existing?.ownerEmail || '') || null
  const ownerSeat: GrupetaSeat = {
    email: ownerEmail || `owner:${input.ownerUid}`,
    role: 'owner',
    uid: input.ownerUid,
    assignedAt: existing?.seats?.find((s) => s.role === 'owner')?.assignedAt || now,
  }
  const memberSeats = (existing?.seats || []).filter((s) => s.role === 'member').slice(0, GRUPETA_MEMBER_SEATS)
  const pack: GrupetaPack = {
    ownerUid: input.ownerUid,
    ownerEmail,
    status: input.status,
    interval: input.interval || existing?.interval || 'year',
    seatLimit: GRUPETA_SEAT_LIMIT,
    stripeCustomerId: input.stripeCustomerId || existing?.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId || existing?.stripeSubscriptionId,
    seats: [ownerSeat, ...memberSeats],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    product: 'grupeta',
  }
  await writeGrupetaPack(env, pack)
  if (ownerEmail) {
    await writeSeatIndex(env, await emailDocId(ownerEmail), {
      packId: input.ownerUid,
      email: ownerEmail,
      role: 'owner',
      status: pack.status,
      updatedAt: now,
    })
  }
  // Re-index members with current pack status
  for (const seat of memberSeats) {
    if (!seat.email || seat.email.startsWith('owner:')) continue
    await writeSeatIndex(env, await emailDocId(seat.email), {
      packId: input.ownerUid,
      email: normalizeEmail(seat.email),
      role: 'member',
      status: pack.status,
      updatedAt: now,
    })
    if (packIsBillable(pack.status) && seat.uid) {
      await writeUserPlan(env, seat.uid, 'premium')
    }
  }
}

/** Cancel / unpaid — deactivate pack and revoke seat premiums carefully. */
export async function deactivateGrupetaPack(
  env: Env,
  ownerUid: string,
  status = 'canceled',
): Promise<void> {
  const pack = await readGrupetaPack(env, ownerUid)
  if (!pack) return
  const now = new Date().toISOString()
  const next: GrupetaPack = {
    ...pack,
    status,
    updatedAt: now,
  }
  await writeGrupetaPack(env, next)

  for (const seat of pack.seats || []) {
    const email = seat.email && !seat.email.startsWith('owner:') ? normalizeEmail(seat.email) : null
    if (email) {
      await writeSeatIndex(env, await emailDocId(email), {
        packId: ownerUid,
        email,
        role: seat.role,
        status,
        updatedAt: now,
      })
    }
    if (seat.uid) {
      await revokePremiumUnlessProtected(env, seat.uid, {
        keepIfSubscriptionId: undefined,
        ignoreSubscriptionId: pack.stripeSubscriptionId,
      })
    } else if (email) {
      const uid = await findUserUidByEmail(env, email)
      if (uid) {
        await revokePremiumUnlessProtected(env, uid, {
          ignoreSubscriptionId: pack.stripeSubscriptionId,
        })
      }
    }
  }
}

/** If this email sits on an active Grupeta pack, grant Premium (Admin). */
export async function grantPremiumFromGrupetaSeat(
  env: Env,
  identity: FirebaseIdentity,
): Promise<boolean> {
  const email = identity.email ? normalizeEmail(identity.email) : null
  if (!email) return false
  const idx = await readSeatIndex(env, await emailDocId(email))
  if (!idx || !packIsBillable(idx.status)) return false
  const pack = await readGrupetaPack(env, idx.packId)
  if (!pack || !packIsBillable(pack.status)) return false
  // Confirm email is still listed on the pack (index could be stale).
  const onPack = (pack.seats || []).some(
    (s) => normalizeEmail(s.email) === email || s.uid === identity.uid,
  )
  if (!onPack) return false

  await writeUserPlan(env, identity.uid, 'premium')
  // Backfill uid on seat
  const seats = (pack.seats || []).map((s) =>
    normalizeEmail(s.email) === email ? { ...s, uid: identity.uid } : s,
  )
  await writeGrupetaPack(env, { ...pack, seats, updatedAt: new Date().toISOString() })
  return true
}

export async function handleGetGrupetaPack(
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  if (identity.isAnonymous) {
    return json({ error: 'Se requiere una cuenta real' }, 401)
  }
  const asOwner = await readGrupetaPack(env, identity.uid)
  let asMember: GrupetaPack | null = null
  if (identity.email) {
    const idx = await readSeatIndex(env, await emailDocId(identity.email))
    if (idx && idx.packId !== identity.uid) {
      asMember = await readGrupetaPack(env, idx.packId)
    }
  }
  return json({
    ok: true,
    seatLimit: GRUPETA_SEAT_LIMIT,
    memberSeats: GRUPETA_MEMBER_SEATS,
    prices: {
      month: '14,99 €',
      year: '119,99 €',
    },
    pack: asOwner
      ? publicPack(asOwner)
      : asMember
        ? { ...publicPack(asMember), viewerRole: 'member' }
        : null,
  })
}

function publicPack(pack: GrupetaPack) {
  return {
    ownerUid: pack.ownerUid,
    status: pack.status,
    interval: pack.interval,
    seatLimit: pack.seatLimit,
    billable: packIsBillable(pack.status),
    seats: (pack.seats || []).map((s) => ({
      email: s.email.startsWith('owner:') ? null : s.email,
      role: s.role,
      hasUid: Boolean(s.uid),
      assignedAt: s.assignedAt,
    })),
    updatedAt: pack.updatedAt,
  }
}

/**
 * Owner assigns up to 3 member emails. Replaces previous members.
 * Only works while pack is billable (active/trialing) — webhook-owned status.
 */
export async function handleSetGrupetaSeats(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  if (identity.isAnonymous) {
    return json({ error: 'Se requiere una cuenta real' }, 401)
  }
  const pack = await readGrupetaPack(env, identity.uid)
  if (!pack) {
    return json({ error: 'No tienes Pack Grupeta activo. Contrátalo primero.', code: 'no_pack' }, 404)
  }
  if (!packIsBillable(pack.status)) {
    return json(
      { error: 'Tu Pack Grupeta no está activo. Revisa el pago en el portal.', code: 'pack_inactive' },
      403,
    )
  }

  const body = (await request.json().catch(() => ({}))) as { emails?: unknown }
  const rawList = Array.isArray(body.emails) ? body.emails : []
  const normalized: string[] = []
  for (const item of rawList) {
    if (typeof item !== 'string') continue
    const e = normalizeEmail(item)
    if (!e) continue
    if (!isValidEmail(e)) {
      return json({ error: `Email no válido: ${item}`, code: 'invalid_email' }, 400)
    }
    if (!normalized.includes(e)) normalized.push(e)
  }
  if (normalized.length > GRUPETA_MEMBER_SEATS) {
    return json(
      {
        error: `Máximo ${GRUPETA_MEMBER_SEATS} emails de compañeros (4 plazas contigo).`,
        code: 'too_many',
      },
      400,
    )
  }

  const ownerEmail = identity.email ? normalizeEmail(identity.email) : pack.ownerEmail
  if (ownerEmail && normalized.includes(ownerEmail)) {
    return json(
      { error: 'Tu email ya ocupa una plaza como dueño del pack.', code: 'owner_duplicate' },
      400,
    )
  }

  const now = new Date().toISOString()
  const prevMembers = (pack.seats || []).filter((s) => s.role === 'member')
  const prevEmails = new Set(prevMembers.map((s) => normalizeEmail(s.email)))

  const ownerSeat: GrupetaSeat = {
    email: ownerEmail || `owner:${identity.uid}`,
    role: 'owner',
    uid: identity.uid,
    assignedAt: pack.seats?.find((s) => s.role === 'owner')?.assignedAt || now,
  }

  const nextMembers: GrupetaSeat[] = []
  for (const email of normalized) {
    const prev = prevMembers.find((s) => normalizeEmail(s.email) === email)
    let uid = prev?.uid
    if (!uid) {
      uid = (await findUserUidByEmail(env, email)) || undefined
    }
    nextMembers.push({
      email,
      role: 'member',
      uid,
      assignedAt: prev?.assignedAt || now,
    })
    if (uid) {
      await writeUserPlan(env, uid, 'premium')
    }
    await writeSeatIndex(env, await emailDocId(email), {
      packId: identity.uid,
      email,
      role: 'member',
      status: pack.status,
      updatedAt: now,
    })
  }

  // Revoke removed members
  for (const prev of prevMembers) {
    const email = normalizeEmail(prev.email)
    if (normalized.includes(email)) continue
    await writeSeatIndex(env, await emailDocId(email), {
      packId: identity.uid,
      email,
      role: 'member',
      status: 'removed',
      updatedAt: now,
    })
    const uid = prev.uid || (await findUserUidByEmail(env, email))
    if (uid) {
      await revokePremiumUnlessProtected(env, uid, {
        ignoreSubscriptionId: pack.stripeSubscriptionId,
      })
    }
  }

  const nextPack: GrupetaPack = {
    ...pack,
    ownerEmail: ownerEmail || pack.ownerEmail,
    seats: [ownerSeat, ...nextMembers],
    updatedAt: now,
  }
  await writeGrupetaPack(env, nextPack)

  return json({
    ok: true,
    pack: publicPack(nextPack),
    grantedNow: nextMembers.filter((s) => s.uid).map((s) => s.email),
    pendingSignup: nextMembers.filter((s) => !s.uid).map((s) => s.email),
    removed: [...prevEmails].filter((e) => !normalized.includes(e)),
  })
}
