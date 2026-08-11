import { describe, expect, it } from 'vitest'
import {
  canonicalSiteUrl,
  publicSiteUrl,
  SITE_ORIGIN,
  shouldUseHostAsAuthDomain,
} from '@/lib/siteConfig'

describe('siteConfig', () => {
  it('canonical URLs always use pedalmap.es', () => {
    expect(canonicalSiteUrl('/')).toBe(`${SITE_ORIGIN}/`)
    expect(canonicalSiteUrl('premium')).toBe(`${SITE_ORIGIN}/premium`)
    expect(canonicalSiteUrl('/route/abc')).toBe(`${SITE_ORIGIN}/route/abc`)
  })

  it('publicSiteUrl falls back to window origin off production hosts', () => {
    // jsdom hostname is localhost → not production
    expect(publicSiteUrl('/ruta')).toBe(`${window.location.origin}/ruta`)
  })

  it('uses Firebase Hosting hosts for authDomain, not custom domain yet', () => {
    expect(shouldUseHostAsAuthDomain('pedalmap.es')).toBe(false)
    expect(shouldUseHostAsAuthDomain('www.pedalmap.es')).toBe(false)
    expect(shouldUseHostAsAuthDomain('pedalmap-79b3a.web.app')).toBe(true)
    expect(shouldUseHostAsAuthDomain('localhost')).toBe(false)
  })
})
