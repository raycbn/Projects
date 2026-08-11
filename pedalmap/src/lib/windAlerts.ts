import { parseMeteoLocal } from '@/lib/weatherFormat'

/** In-app / email wind-alert thresholds. */
export const WIND_ALERT = {
  minScore: 80,
  maxHoursAhead: 36,
} as const

const DISMISS_PREFIX = 'pedalmap_wind_alert_dismiss_'
const EMAIL_SENT_PREFIX = 'pedalmap_wind_alert_email_'

export function hoursUntilMeteo(iso: string, now = new Date()): number {
  return (parseMeteoLocal(iso).getTime() - now.getTime()) / 3_600_000
}

export function isAlertableWindow(
  window: { score: number; startHour: string },
  now = new Date(),
): boolean {
  if (window.score < WIND_ALERT.minScore) return false
  const hours = hoursUntilMeteo(window.startHour, now)
  return hours >= 0 && hours <= WIND_ALERT.maxHoursAhead
}

export function alertDismissKey(routeId: string, startHour: string): string {
  return `${DISMISS_PREFIX}${routeId}_${startHour}`
}

export function isAlertDismissed(routeId: string, startHour: string): boolean {
  try {
    return localStorage.getItem(alertDismissKey(routeId, startHour)) === '1'
  } catch {
    return false
  }
}

export function dismissAlert(routeId: string, startHour: string): void {
  try {
    localStorage.setItem(alertDismissKey(routeId, startHour), '1')
  } catch {
    /* ignore */
  }
}

export function alertEmailSentKey(routeId: string, startHour: string): string {
  return `${EMAIL_SENT_PREFIX}${routeId}_${startHour}`
}

export function wasAlertEmailSent(routeId: string, startHour: string): boolean {
  try {
    return localStorage.getItem(alertEmailSentKey(routeId, startHour)) === '1'
  } catch {
    return false
  }
}

export function markAlertEmailSent(routeId: string, startHour: string): void {
  try {
    localStorage.setItem(alertEmailSentKey(routeId, startHour), '1')
  } catch {
    /* ignore */
  }
}

export interface WindAlertCandidate {
  routeId: string
  routeTitle: string
  startHour: string
  endHour: string
  score: number
  label: string
  caption: string
}

/** Pick the soonest excellent window among candidates (not dismissed). */
export function pickBestWindAlert(
  candidates: WindAlertCandidate[],
  now = new Date(),
): WindAlertCandidate | null {
  const open = candidates
    .filter((c) => isAlertableWindow(c, now) && !isAlertDismissed(c.routeId, c.startHour))
    .sort((a, b) => a.startHour.localeCompare(b.startHour) || b.score - a.score)
  return open[0] ?? null
}
