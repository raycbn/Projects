import { describe, expect, it } from 'vitest'
import { SORTEO_PREMIUM_50, sorteoStatus } from '@/content/sorteoPremium50'

describe('sorteoPremium50', () => {
  it('is open during the stated window', () => {
    expect(sorteoStatus(SORTEO_PREMIUM_50.startMs)).toBe('open')
    expect(sorteoStatus(SORTEO_PREMIUM_50.endMs)).toBe('open')
  })

  it('is soon before and closed after', () => {
    expect(sorteoStatus(SORTEO_PREMIUM_50.startMs - 1)).toBe('soon')
    expect(sorteoStatus(SORTEO_PREMIUM_50.endMs + 1)).toBe('closed')
  })
})
