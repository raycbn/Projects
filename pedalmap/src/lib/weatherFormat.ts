/** Open-Meteo returns local wall-clock strings like "2026-08-10T07:00" (no offset). */

export function parseMeteoLocal(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) {
    const fallback = new Date(iso)
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback
  }
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 12),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0),
  )
}

/** Normalize to `YYYY-MM-DDTHH:mm` for lexicographic compares. */
export function normalizeMeteoStamp(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/)
  if (m) return `${m[1]}T${m[2]}:${m[3]}`
  const d = parseMeteoLocal(iso)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day}T${h}:${min}`
}

/** Current wall clock in an IANA zone as `YYYY-MM-DDTHH:mm`. */
export function nowWallClockInZone(timeZone: string, now = new Date()): string {
  try {
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts = Object.fromEntries(
      dtf
        .formatToParts(now)
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
  } catch {
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const h = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    return `${y}-${mo}-${day}T${h}:${min}`
  }
}

/**
 * True when the meteo stamp is still in the future in `timeZone`
 * (strictly after `now`, optionally requiring `minRemainingMinutes`).
 */
export function isMeteoStampUpcoming(
  isoLocal: string,
  timeZone: string,
  now = new Date(),
  minRemainingMinutes = 0,
): boolean {
  const cutoff = new Date(now.getTime() + Math.max(0, minRemainingMinutes) * 60_000)
  const wall = nowWallClockInZone(timeZone, cutoff)
  return normalizeMeteoStamp(isoLocal) > wall
}

export function formatWeatherDay(iso: string): string {
  const d = parseMeteoLocal(iso)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatWeatherDayLong(iso: string): string {
  const d = parseMeteoLocal(iso)
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatWeatherHour(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/)
  if (m) return `${m[1]}:${m[2]}`
  const d = parseMeteoLocal(iso)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatWeatherHourRange(start: string, end: string): string {
  return `${formatWeatherHour(start)}–${formatWeatherHour(end)}`
}

/** Map caption / summaries: "lun, 10 ago · 07:00–10:00". */
export function formatWeatherWindowCaption(start: string, end: string): string {
  return `${formatWeatherDay(start)} · ${formatWeatherHourRange(start, end)}`
}

export function formatWeatherHourCaption(iso: string): string {
  return `${formatWeatherDay(iso)} · ${formatWeatherHour(iso)}`
}

export function meteoDayKey(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = parseMeteoLocal(iso)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}
