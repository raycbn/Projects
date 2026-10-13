import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
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

/**
 * Distinguish a true guest from an anonymous session that has since linked a durable
 * identity. Firebase may keep the original sign_in_provider claim on a linked session;
 * identities/email are also authoritative token claims and preserve the same UID/quota.
 */
export function firebaseIdentityFromPayload(payload: JWTPayload): FirebaseIdentity {
  const uid = payload.sub
  if (!uid || typeof uid !== 'string') throw new Error('Invalid token subject')
  const firebaseClaim = payload.firebase as {
    sign_in_provider?: string
    identities?: Record<string, unknown[]>
  } | undefined
  const linkedIdentity = Object.values(firebaseClaim?.identities ?? {}).some(
    (identifiers) => Array.isArray(identifiers) && identifiers.length > 0,
  )
  const hasEmailIdentity = typeof payload.email === 'string' && payload.email.length > 0
  const isAnonymous =
    firebaseClaim?.sign_in_provider === 'anonymous' && !linkedIdentity && !hasEmailIdentity
  return {
    uid,
    email: hasEmailIdentity ? payload.email as string : undefined,
    emailVerified: payload.email_verified === true,
    isAnonymous,
  }
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
  return firebaseIdentityFromPayload(payload)
}
