/** Instagram promo: first 50 new accounts get 3 months of Premium. */

export const SORTEO_PREMIUM_50 = {
  path: '/sorteo',
  registerPath: '/register?from=sorteo',
  winners: 50,
  months: 3,
  startLabel: '15 de agosto de 2026',
  endLabel: '23 de agosto de 2026, 23:59 (Madrid)',
  startMs: Date.parse('2026-08-15T00:00:00+02:00'),
  endMs: Date.parse('2026-08-23T23:59:59+02:00'),
  title: '50 Premium × 3 meses',
  description:
    'Los 50 primeros que creen una cuenta nueva en PedalMap se llevan Premium 3 meses. Hasta el 23 de agosto de 2026.',
} as const

export type SorteoStatus = 'soon' | 'open' | 'closed'

export function sorteoStatus(now = Date.now()): SorteoStatus {
  if (now < SORTEO_PREMIUM_50.startMs) return 'soon'
  if (now > SORTEO_PREMIUM_50.endMs) return 'closed'
  return 'open'
}
