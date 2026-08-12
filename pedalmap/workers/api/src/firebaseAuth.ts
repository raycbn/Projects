import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Env } from './types'

const jwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)

export type FirebaseIdentity = {
  uid: string
  email?: string
  emailVerified: boolean
  isAnonymous: boolean
}

/** Verify Firebase ID token without Admin SDK (Spark-friendly). */
export async function verifyFirebaseIdToken(
  env: Env,
  authHeader: string | null,
): Promise<FirebaseIdentity> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Bearer token')
  }
  const token = authHeader.slice('Bearer '.length)
  const projectId = env.FIREBASE_PROJECT_ID
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })
  const uid = payload.sub
  if (!uid || typeof uid !== 'string') throw new Error('Invalid token subject')
  const firebaseClaim = payload.firebase as { sign_in_provider?: string } | undefined
  return {
    uid,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    isAnonymous: firebaseClaim?.sign_in_provider === 'anonymous',
  }
}
