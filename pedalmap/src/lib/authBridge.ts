/** Host where Google redirect works same-origin with Firebase authDomain. */
export const AUTH_BRIDGE_HOST = 'pedalmap-79b3a.web.app'
export const AUTH_BRIDGE_ORIGIN = `https://${AUTH_BRIDGE_HOST}`

const CUSTOM_TOKEN_HASH_KEY = 'pm_ct'

const RETURN_HOST_ALLOWLIST = new Set([
  'pedalmap.es',
  'www.pedalmap.es',
  'pedalmap-79b3a.web.app',
  'pedalmap-79b3a.firebaseapp.com',
  'localhost',
  '127.0.0.1',
])

function apiBase(): string {
  return String(
    import.meta.env.VITE_PEDALMAP_API_URL || import.meta.env.VITE_ROUTING_PROXY_URL || '',
  ).replace(/\/+$/, '')
}

/** True when Google login must hop through *.web.app (legacy / emergency). */
export function needsGoogleAuthBridge(hostname = window.location.hostname): boolean {
  // OAuth redirect URIs for pedalmap.es are registered → first-party authDomain.
  // Keep an escape hatch if Console config regresses.
  if (String(import.meta.env.VITE_FORCE_GOOGLE_AUTH_BRIDGE || '') !== 'true') {
    return false
  }
  if (hostname === AUTH_BRIDGE_HOST || hostname.endsWith('.firebaseapp.com')) return false
  return hostname === 'pedalmap.es' || hostname === 'www.pedalmap.es'
}

export function isAllowedAuthReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
      return null
    }
    if (!RETURN_HOST_ALLOWLIST.has(url.hostname)) return null
    return url.toString()
  } catch {
    return null
  }
}

export function buildAuthBridgeUrl(returnUrl: string): string {
  const safe = isAllowedAuthReturnUrl(returnUrl) || `${window.location.origin}/login`
  const url = new URL('/auth/bridge', AUTH_BRIDGE_ORIGIN)
  url.searchParams.set('return', safe)
  return url.toString()
}

export function startGoogleAuthBridge(returnUrl = window.location.href): void {
  window.location.assign(buildAuthBridgeUrl(returnUrl))
}

/** Read + clear `#pm_ct=<customToken>` from the current URL. */
export function consumeCustomTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return null
  const params = new URLSearchParams(hash.includes('=') ? hash : '')
  // Also support plain `#pm_ct=...` and query-style fragments with multiple keys.
  let token = params.get(CUSTOM_TOKEN_HASH_KEY)
  if (!token && hash.startsWith(`${CUSTOM_TOKEN_HASH_KEY}=`)) {
    token = decodeURIComponent(hash.slice(CUSTOM_TOKEN_HASH_KEY.length + 1))
  }
  if (!token) return null
  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState({}, '', url.toString())
  return token
}

export function attachCustomTokenHash(returnUrl: string, customToken: string): string {
  const url = new URL(returnUrl)
  url.hash = `${CUSTOM_TOKEN_HASH_KEY}=${encodeURIComponent(customToken)}`
  return url.toString()
}

export async function mintCustomTokenFromIdToken(idToken: string): Promise<string> {
  const base = apiBase()
  if (!base) throw new Error('Falta VITE_PEDALMAP_API_URL para completar el login con Google.')
  const res = await fetch(`${base}/auth/custom-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
  })
  const body = (await res.json().catch(() => ({}))) as { customToken?: string; error?: string }
  if (!res.ok || !body.customToken) {
    throw new Error(body.error || `No se pudo crear la sesión (${res.status})`)
  }
  return body.customToken
}
