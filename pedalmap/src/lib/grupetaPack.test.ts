import { describe, expect, it } from 'vitest'
import {
  GRUPETA_MEMBER_SEATS,
  GRUPETA_PRICE_MONTH,
  GRUPETA_PRICE_YEAR,
  GRUPETA_SEAT_LIMIT,
} from '@/domain/types'

describe('grupeta product constants', () => {
  it('is 4 seats with 3 member invites', () => {
    expect(GRUPETA_SEAT_LIMIT).toBe(4)
    expect(GRUPETA_MEMBER_SEATS).toBe(3)
  })

  it('matches option B pricing copy', () => {
    expect(GRUPETA_PRICE_MONTH).toBe('14,99')
    expect(GRUPETA_PRICE_YEAR).toBe('119,99')
  })
})
