import { signInAnonymously } from 'firebase/auth'
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Routing calls to the Cloudflare Worker must carry a Firebase ID token
 * (anonymous guests included) so the Worker can rate-limit and bill by uid.
 */
export async function routingAuthHeaders(
  extra: HeadersInit = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  Object.assign(headers, normalizeHeaders(extra))

  if (!isFirebaseConfigured()) return headers

  const auth = getFirebaseAuth()
  let user = auth.currentUser
  if (!user) {
    try {
      const result = await signInAnonymously(auth)
      user = result.user
    } catch (error) {
      console.warn('[routingAuth] anonymous sign-in failed', error)
      return headers
    }
  }
  const token = await user.getIdToken()
  headers.Authorization = `Bearer ${token}`
  return headers
}

function normalizeHeaders(extra: HeadersInit): Record<string, string> {
  if (extra instanceof Headers) {
    const out: Record<string, string> = {}
    extra.forEach((v, k) => {
      out[k] = v
    })
    return out
  }
  if (Array.isArray(extra)) {
    return Object.fromEntries(extra)
  }
  return { ...extra }
}
