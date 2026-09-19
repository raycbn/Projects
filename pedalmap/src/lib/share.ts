import { Capacitor } from '@capacitor/core'
import { shareRouteNative } from '@/lib/routeShare'

const PUBLIC_DOMAIN = 'pedalmap.es'

function routeSlugFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw, 'https://pedalmap.es')
    const match = url.pathname.match(/^\/(?:route|ruta)\/([^/]+)\/?$/)
    if (!match) return null
    const slug = decodeURIComponent(match[1]!)
    return slug && !slug.includes('/') ? slug : null
  } catch {
    return null
  }
}

/**
 * Canonical public route URL.
 * ALWAYS produces https://pedalmap.es/route/<slug> regardless of
 * the WebView origin (which may be localhost or capacitor://localhost).
 */
export function getPublicRouteUrl(slug: string): string {
  return `https://${PUBLIC_DOMAIN}/route/${slug}`
}

export function canonicalizePublicRouteUrl(input: string): string {
  const slug = routeSlugFromUrl(input)
  return slug ? getPublicRouteUrl(slug) : input
}

export function isPublicRouteUrl(input: string): boolean {
  return routeSlugFromUrl(input) !== null
}

export function createShareSlug(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ruta'

  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}-${suffix}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export async function shareUrl(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  console.log('[share-debug] branch=native-android-enter phase=before-check')
  const publicUrl = canonicalizePublicRouteUrl(url)
  console.log('[share-debug] function=shareUrl phase=before platform=' + Capacitor.getPlatform() + ' publicUrl=' + publicUrl)
  if (Capacitor.getPlatform() === 'android') {
    console.log('[share-debug] branch=native-route-share url=' + publicUrl)
    try {
      const shared = await shareRouteNative({ title, text: title, url: publicUrl })
      if (shared) {
        console.log('[share-debug] branch=completed result=shared route=native')
        return 'shared'
      }
      console.log('[share-debug] branch=share-fallback reason=native-unavailable')
    } catch (error) {
      console.log('[share-debug] branch=share-fallback reason=native-error error=' + (error as Error)?.message)
      // fall through to clipboard
    }
  }
  console.log('[share-debug] branch=navigator-share-check')
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    console.log('[share-debug] branch=navigator-share url=' + publicUrl)
    try {
      await navigator.share({ title, url: publicUrl, text: title })
      console.log('[share-debug] branch=completed result=shared route=navigator')
      return 'shared'
    } catch (error) {
      console.log('[share-debug] branch=share-fallback reason=navigator-share-error error=' + (error as Error)?.message)
      // fall through to clipboard
    }
  }
  console.log('[share-debug] branch=share-fallback method=clipboard')
  const ok = await copyToClipboard(publicUrl)
  console.log('[share-debug] branch=completed result=' + (ok ? 'copied' : 'failed') + ' route=clipboard')
  return ok ? 'copied' : 'failed'
}
