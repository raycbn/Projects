/** Shared OAuth state (HMAC) for GPS provider connect flows. */
export function b64url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

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

export async function makeOAuthState(
  secret: string,
  uid: string,
  provider: string,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 600
  const body = `${provider}.${uid}.${exp}`
  const sig = await hmacSign(secret, body)
  return `${b64url(body)}.${sig}`
}

export async function parseOAuthState(
  secret: string,
  state: string,
  expectProvider: string,
): Promise<string | null> {
  const [bodyB64, sig] = state.split('.')
  if (!bodyB64 || !sig) return null
  const body = fromB64url(bodyB64)
  const expect = await hmacSign(secret, body)
  if (expect !== sig) return null
  const [provider, uid, expRaw] = body.split('.')
  const exp = Number(expRaw)
  if (provider !== expectProvider || !uid || !Number.isFinite(exp)) return null
  if (exp < Math.floor(Date.now() / 1000)) return null
  return uid
}

export function workerCallbackUrl(request: Request, provider: string): string {
  const origin = new URL(request.url).origin
  return `${origin}/gps/${provider}/oauth/callback`
}

export function appRedirect(env: { APP_URL?: string }, ok: boolean, provider: string, reason?: string): Response {
  const appUrl = (env.APP_URL || 'https://pedalmap-79b3a.web.app').replace(/\/+$/, '')
  if (ok) {
    return Response.redirect(`${appUrl}/actividades?gps=connected&provider=${provider}`, 302)
  }
  return Response.redirect(
    `${appUrl}/actividades?gps=error&provider=${provider}&reason=${encodeURIComponent(reason || 'error')}`,
    302,
  )
}
