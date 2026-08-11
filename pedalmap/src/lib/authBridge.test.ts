import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  attachCustomTokenHash,
  buildAuthBridgeUrl,
  isAllowedAuthReturnUrl,
  needsGoogleAuthBridge,
} from '@/lib/authBridge'

describe('needsGoogleAuthBridge', () => {
  it('bridges custom product domains', () => {
    expect(needsGoogleAuthBridge('pedalmap.es')).toBe(true)
    expect(needsGoogleAuthBridge('www.pedalmap.es')).toBe(true)
  })

  it('skips Firebase Hosting hosts where redirect already works', () => {
    expect(needsGoogleAuthBridge('pedalmap-79b3a.web.app')).toBe(false)
    expect(needsGoogleAuthBridge('pedalmap-79b3a.firebaseapp.com')).toBe(false)
  })
})

describe('isAllowedAuthReturnUrl', () => {
  it('allows product origins', () => {
    expect(isAllowedAuthReturnUrl('https://pedalmap.es/login')).toContain('pedalmap.es')
    expect(isAllowedAuthReturnUrl('https://www.pedalmap.es/my-routes')).toBeTruthy()
  })

  it('rejects foreign origins', () => {
    expect(isAllowedAuthReturnUrl('https://evil.example/phish')).toBeNull()
    expect(isAllowedAuthReturnUrl('javascript:alert(1)')).toBeNull()
  })
})

describe('buildAuthBridgeUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('points at the web.app bridge with a safe return', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://pedalmap.es', hostname: 'pedalmap.es', href: 'https://pedalmap.es/login' },
    })
    const url = buildAuthBridgeUrl('https://pedalmap.es/login')
    expect(url).toMatch(/^https:\/\/pedalmap-79b3a\.web\.app\/auth\/bridge\?/)
    expect(url).toContain(encodeURIComponent('https://pedalmap.es/login'))
  })
})

describe('attachCustomTokenHash', () => {
  it('stores the token in the URL hash', () => {
    const out = attachCustomTokenHash('https://pedalmap.es/login', 'tok.en')
    expect(out).toContain('#pm_ct=tok.en')
  })
})
