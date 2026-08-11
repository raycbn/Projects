/** Canonical production origin — never use web.app / pedalmap.app in SEO signals. */
export const SITE_ORIGIN = 'https://pedalmap.es'
export const SITE_NAME = 'PedalMap'
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-default.jpg`

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${SITE_ORIGIN}${normalized === '/' ? '/' : normalized}`
}
