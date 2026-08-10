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
