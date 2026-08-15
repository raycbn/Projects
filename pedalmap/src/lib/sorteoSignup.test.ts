import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { consumeSorteoSignup, isSorteoSignup, markSorteoSignup } from '@/lib/sorteoSignup'
import { googleBridgeReturnUrl, postLoginPath } from '@/lib/pendingAuthAction'

describe('sorteoSignup', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('marks and consumes once', () => {
    expect(isSorteoSignup()).toBe(false)
    markSorteoSignup()
    expect(isSorteoSignup()).toBe(true)
    expect(consumeSorteoSignup()).toBe(true)
    expect(isSorteoSignup()).toBe(false)
    expect(consumeSorteoSignup()).toBe(false)
  })

  it('sends post-login to the promo confirmation until consumed', () => {
    markSorteoSignup()
    expect(postLoginPath()).toBe('/sorteo?listo=1')
    expect(postLoginPath()).toBe('/sorteo?listo=1')
    expect(consumeSorteoSignup()).toBe(true)
    expect(postLoginPath()).toBe('/my-routes')
  })

  it('returns Google bridge to the promo register page', () => {
    markSorteoSignup()
    expect(googleBridgeReturnUrl('https://pedalmap.es')).toBe(
      'https://pedalmap.es/register?from=sorteo',
    )
  })
})
