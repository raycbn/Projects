import { b64url, fromB64url } from './oauthState'

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const bytes = new Uint8Array(sig)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** State carries uid + PKCE verifier (Garmin requires code_verifier on token exchange). */
export async function makeGarminState(
  secret: string,
  uid: string,
  verifier: string,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 600
  const body = `garmin.${uid}.${exp}.${verifier}`
  const sig = await hmacSign(secret, body)
  return `${b64url(body)}.${sig}`
}

export async function parseGarminState(
  secret: string,
  state: string,
): Promise<{ uid: string; verifier: string } | null> {
  const [bodyB64, sig] = state.split('.')
  if (!bodyB64 || !sig) return null
  const body = fromB64url(bodyB64)
  const expect = await hmacSign(secret, body)
  if (expect !== sig) return null
  const [provider, uid, expRaw, verifier] = body.split('.')
  const exp = Number(expRaw)
  if (provider !== 'garmin' || !uid || !verifier || !Number.isFinite(exp)) return null
  if (exp < Math.floor(Date.now() / 1000)) return null
  return { uid, verifier }
}
