/** Soft Free-trial helpers (1 GPX/semana, 1 Objetivo/mes). */

const GUEST_CIRCULAR_KEY = 'pedalmap_free_circular_v1'
const GUEST_GPX_KEY = 'pedalmap_free_gpx_v1'

export function utcMonthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** ISO week key like 2026-W33 (UTC). */
export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  // Thursday in current week decides the year.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

type GuestBucket = { key: string; used: number }

function readGuest(storageKey: string): GuestBucket | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw) as GuestBucket
  } catch {
    return null
  }
}

function writeGuest(storageKey: string, bucket: GuestBucket): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(bucket))
  } catch {
    /* ignore */
  }
}

export function guestCircularUsedThisMonth(): number {
  const b = readGuest(GUEST_CIRCULAR_KEY)
  const key = utcMonthKey()
  if (!b || b.key !== key) return 0
  return b.used
}

export function consumeGuestCircular(): void {
  const key = utcMonthKey()
  const used = guestCircularUsedThisMonth()
  writeGuest(GUEST_CIRCULAR_KEY, { key, used: used + 1 })
}

export function guestGpxUsedThisWeek(): number {
  const b = readGuest(GUEST_GPX_KEY)
  const key = isoWeekKey()
  if (!b || b.key !== key) return 0
  return b.used
}

export function consumeGuestGpx(): void {
  const key = isoWeekKey()
  const used = guestGpxUsedThisWeek()
  writeGuest(GUEST_GPX_KEY, { key, used: used + 1 })
}
