import { describe, expect, it, vi, afterEach } from 'vitest'
import { authErrorMessage, prefersGoogleRedirect } from '@/services/AuthService'

describe('authErrorMessage', () => {
  it('maps popup cancel codes', () => {
    expect(authErrorMessage({ code: 'auth/popup-closed-by-user' }, 'x')).toMatch(/cancelado/i)
    expect(authErrorMessage({ code: 'auth/cancelled-popup-request' }, 'x')).toMatch(/cancelado/i)
  })

  it('maps unauthorized domain', () => {
    expect(authErrorMessage({ code: 'auth/unauthorized-domain' }, 'x')).toMatch(/autorizado/i)
  })

  it('falls back', () => {
    expect(authErrorMessage({ code: 'auth/other' }, 'fallback')).toBe('fallback')
  })
})

describe('prefersGoogleRedirect', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefers redirect on mobile UA', () => {
    vi.stubGlobal('window', {
      navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
      matchMedia: () => ({ matches: false }),
    })
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })
    expect(prefersGoogleRedirect()).toBe(true)
  })

  it('uses popup on desktop fine pointer', () => {
    vi.stubGlobal('window', {
      navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)' },
      matchMedia: () => ({ matches: false }),
    })
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)' })
    expect(prefersGoogleRedirect()).toBe(false)
  })
})
