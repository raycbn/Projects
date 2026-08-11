import { afterEach, describe, expect, it } from 'vitest'
import {
  hoursUntilMeteo,
  isAlertableWindow,
  pickBestWindAlert,
  WIND_ALERT,
  dismissAlert,
  isAlertDismissed,
} from '@/lib/windAlerts'

describe('windAlerts', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('flags excellent windows within the lookahead', () => {
    const now = new Date('2026-08-11T10:00:00')
    expect(
      isAlertableWindow({ score: WIND_ALERT.minScore, startHour: '2026-08-11T16:00' }, now),
    ).toBe(true)
    expect(isAlertableWindow({ score: 79, startHour: '2026-08-11T16:00' }, now)).toBe(false)
    expect(
      isAlertableWindow({ score: 90, startHour: '2026-08-14T08:00' }, now),
    ).toBe(false)
  })

  it('computes hours until a meteo stamp', () => {
    const now = new Date('2026-08-11T10:00:00')
    expect(hoursUntilMeteo('2026-08-11T16:00', now)).toBeCloseTo(6, 5)
  })

  it('picks the soonest non-dismissed candidate', () => {
    const now = new Date('2026-08-11T10:00:00')
    const best = pickBestWindAlert(
      [
        {
          routeId: 'a',
          routeTitle: 'A',
          startHour: '2026-08-12T07:00',
          endHour: '2026-08-12T10:00',
          score: 92,
          label: 'excelente',
          caption: 'jue · 07:00–10:00',
        },
        {
          routeId: 'b',
          routeTitle: 'B',
          startHour: '2026-08-11T15:00',
          endHour: '2026-08-11T18:00',
          score: 85,
          label: 'excelente',
          caption: 'mar · 15:00–18:00',
        },
      ],
      now,
    )
    expect(best?.routeId).toBe('b')

    dismissAlert('b', '2026-08-11T15:00')
    expect(isAlertDismissed('b', '2026-08-11T15:00')).toBe(true)
    const next = pickBestWindAlert(
      [
        {
          routeId: 'a',
          routeTitle: 'A',
          startHour: '2026-08-12T07:00',
          endHour: '2026-08-12T10:00',
          score: 92,
          label: 'excelente',
          caption: 'jue · 07:00–10:00',
        },
        {
          routeId: 'b',
          routeTitle: 'B',
          startHour: '2026-08-11T15:00',
          endHour: '2026-08-11T18:00',
          score: 85,
          label: 'excelente',
          caption: 'mar · 15:00–18:00',
        },
      ],
      now,
    )
    expect(next?.routeId).toBe('a')
  })
})
