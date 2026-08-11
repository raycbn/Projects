/** Canonical production site — use for SEO, shares, and absolute links. */
export const SITE_ORIGIN = 'https://pedalmap.es'
export const SITE_HOST = 'pedalmap.es'

const PRODUCTION_HOSTS = new Set([
  'pedalmap.es',
  'www.pedalmap.es',
  'pedalmap-79b3a.web.app',
  'pedalmap-79b3a.firebaseapp.com',
])

function currentHostname(): string | null {
  if (typeof window === 'undefined') return null
  return window.location.hostname
}

/** True when the page is served from a known PedalMap production host. */
export function isProductionHost(hostname = currentHostname()): boolean {
  return Boolean(hostname && PRODUCTION_HOSTS.has(hostname))
}

/**
 * Absolute public origin for user-facing links.
 * On production hosts → always apex `https://pedalmap.es`.
 * Local / preview → current origin.
 */
export function publicSiteOrigin(): string {
  if (isProductionHost()) return SITE_ORIGIN
  if (typeof window !== 'undefined') return window.location.origin
  return SITE_ORIGIN
}

export function publicSiteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${publicSiteOrigin()}${p}`
}

/** SEO / OG / canonical — always the definitive domain. */
export function canonicalSiteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${SITE_ORIGIN}${p}`
}

/** Hosts where Firebase authDomain should follow the page hostname. */
export function shouldUseHostAsAuthDomain(hostname: string): boolean {
  // Only Firebase Hosting defaults — custom domains (pedalmap.es) need the
  // Google OAuth redirect URI registered first or login fails with
  // redirect_uri_mismatch. Keep authDomain = *.web.app / *.firebaseapp.com.
  return hostname.endsWith('.web.app') || hostname.endsWith('.firebaseapp.com')
}
