import { describe, expect, it, beforeEach } from 'vitest'
import { isoWeekKey, utcMonthKey, guestCircularUsedThisMonth, consumeGuestCircular } from '@/lib/freemium'

describe('freemium keys', () => {
  it('formats UTC month and ISO week', () => {
    expect(utcMonthKey(new Date('2026-08-11T12:00:00Z'))).toBe('2026-08')
    expect(isoWeekKey(new Date('2026-08-11T12:00:00Z'))).toMatch(/^2026-W\d{2}$/)
  })
})

describe('guest circular trial', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts at 0 and increments', () => {
    expect(guestCircularUsedThisMonth()).toBe(0)
    consumeGuestCircular()
    expect(guestCircularUsedThisMonth()).toBe(1)
  })
})
