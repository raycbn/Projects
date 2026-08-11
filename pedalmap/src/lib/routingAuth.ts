import { signInAnonymously, type User } from 'firebase/auth'
import { withAuthLock } from '@/lib/authLock'
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Routing calls to the Cloudflare Worker must carry a Firebase ID token
 * (anonymous guests included) so the Worker can rate-limit and bill by uid.
 *
 * Anonymous sign-in is locked and skipped when a real user is already present
 * so it cannot wipe email/Google sessions.
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
  let user: User | null = auth.currentUser
  if (!user) {
    try {
      user = await withAuthLock(async (): Promise<User> => {
        const existing = getFirebaseAuth().currentUser
        if (existing) return existing
        const result = await signInAnonymously(getFirebaseAuth())
        const after = getFirebaseAuth().currentUser as User | null
        if (after && !after.isAnonymous) return after
        return result.user
      })
    } catch (error) {
      console.warn('[routingAuth] anonymous sign-in failed', error)
      return headers
    }
  }
  user = getFirebaseAuth().currentUser ?? user
  if (!user) return headers
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
