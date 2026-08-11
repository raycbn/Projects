/**
 * Mint a Firebase Auth custom token (JWT) with the service account key.
 * Same format as Admin SDK createCustomToken — no Blaze / Cloud Functions.
 *
 * Used to move a Google session from *.web.app → pedalmap.es after redirect login.
 */

import { SignJWT, importPKCS8 } from 'jose'
import type { Env } from './types'
import { json } from './types'
import type { FirebaseIdentity } from './firebaseAuth'

type ServiceAccount = {
  client_email: string
  private_key: string
  project_id?: string
}

function parseServiceAccount(env: Env): ServiceAccount | null {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return null
  try {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON')
  }
}

export async function mintFirebaseCustomToken(env: Env, uid: string): Promise<string> {
  const sa = parseServiceAccount(env)
  if (!sa?.client_email || !sa.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT required to mint custom tokens')
  }
  const key = await importPKCS8(sa.private_key, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ uid })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(
      'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    )
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)
}

/** Exchange a verified Firebase ID token for a custom token (cross-domain session bridge). */
export async function handleMintCustomToken(
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  if (identity.isAnonymous) {
    return json({ error: 'Anonymous sessions cannot mint custom tokens', code: 'anonymous' }, 403)
  }
  const customToken = await mintFirebaseCustomToken(env, identity.uid)
  return json({ customToken, uid: identity.uid })
}
