/**
 * Normalize Valhalla `alternates` into trip objects.
 * Official Valhalla returns `{ trip: {...} }` wrappers; some mirrors return bare trips.
 */
export type ValhallaTripLike = {
  legs?: unknown[]
  summary?: unknown
}

export function unwrapValhallaAlternates(alternates: unknown): ValhallaTripLike[] {
  if (!Array.isArray(alternates)) return []
  const out: ValhallaTripLike[] = []
  for (const item of alternates) {
    if (!item || typeof item !== 'object') continue
    const rec = item as { trip?: ValhallaTripLike; legs?: unknown }
    if (rec.trip && typeof rec.trip === 'object') {
      out.push(rec.trip)
    } else if (Array.isArray(rec.legs)) {
      out.push(item as ValhallaTripLike)
    }
  }
  return out
}
