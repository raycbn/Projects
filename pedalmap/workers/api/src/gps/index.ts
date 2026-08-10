/**
 * Official GPS cloud sync (Wahoo / iGPSPORT / Garmin).
 * Tokens + auto-import stay on the Worker — never in Vite.
 */
import type { Env } from '../types'
import { json } from '../types'
import type { FirebaseIdentity } from '../firebaseAuth'
import {
  deleteGpsConnection,
  listGpsConnections,
  readGpsConnection,
  writeGpsProviderIndex,
  type GpsProvider,
} from '../firestore'
import {
  handleWahooOAuthStart,
  handleWahooOAuthCallback,
  syncWahooRecent,
  handleWahooWebhook,
} from './wahoo'
import {
  handleIgpsportOAuthStart,
  handleIgpsportOAuthCallback,
  handleIgpsportWebhook,
} from './igpsport'
import {
  handleGarminOAuthStart,
  handleGarminOAuthCallback,
  handleGarminWebhook,
} from './garmin'

export const GPS_PROVIDERS: GpsProvider[] = ['wahoo', 'igpsport', 'garmin']

export function isGpsProvider(v: string): v is GpsProvider {
  return (GPS_PROVIDERS as string[]).includes(v)
}

function rejectAnonymous(identity: FirebaseIdentity): Response | null {
  if (!identity.isAnonymous) return null
  return json(
    {
      error: 'Inicia sesión con una cuenta real para conectar tu GPS',
      code: 'gps_account_required',
    },
    403,
  )
}

export function providerConfigured(env: Env, provider: GpsProvider): boolean {
  switch (provider) {
    case 'wahoo':
      return Boolean(env.WAHOO_CLIENT_ID && env.WAHOO_CLIENT_SECRET)
    case 'igpsport':
      return Boolean(env.IGPSPORT_CLIENT_ID && env.IGPSPORT_CLIENT_SECRET)
    case 'garmin':
      return Boolean(env.GARMIN_CLIENT_ID && env.GARMIN_CLIENT_SECRET)
    default:
      return false
  }
}

export async function handleGpsStatus(env: Env, identity: FirebaseIdentity): Promise<Response> {
  const anon = rejectAnonymous(identity)
  if (anon) return anon
  const connections = await listGpsConnections(env, identity.uid)
  const providers = GPS_PROVIDERS.map((id) => {
    const conn = connections.find((c) => c.provider === id)
    return {
      id,
      configured: providerConfigured(env, id),
      connected: Boolean(conn),
      externalUserId: conn?.externalUserId ?? null,
      label: id === 'wahoo' ? 'Wahoo' : id === 'igpsport' ? 'iGPSPORT' : 'Garmin',
    }
  })
  return json({ ok: true, providers })
}

export async function handleGpsOAuthStart(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
  provider: GpsProvider,
): Promise<Response> {
  const anon = rejectAnonymous(identity)
  if (anon) return anon
  if (!providerConfigured(env, provider)) {
    return json(
      {
        error: `${provider} aún no configurado`,
        code: 'gps_not_configured',
        hint: 'Ver docs/GPS_OFFICIAL_SYNC.md — solicita API y wrangler secret put',
      },
      503,
    )
  }
  if (provider === 'wahoo') return handleWahooOAuthStart(request, env, identity)
  if (provider === 'igpsport') return handleIgpsportOAuthStart(request, env, identity)
  return handleGarminOAuthStart(request, env, identity)
}

export async function handleGpsOAuthCallback(
  request: Request,
  env: Env,
  provider: GpsProvider,
): Promise<Response> {
  if (provider === 'wahoo') return handleWahooOAuthCallback(request, env)
  if (provider === 'igpsport') return handleIgpsportOAuthCallback(request, env)
  return handleGarminOAuthCallback(request, env)
}

export async function handleGpsDisconnect(
  env: Env,
  identity: FirebaseIdentity,
  provider: GpsProvider,
): Promise<Response> {
  const anon = rejectAnonymous(identity)
  if (anon) return anon
  const existing = await readGpsConnection(env, identity.uid, provider)
  await deleteGpsConnection(env, identity.uid, provider)
  if (existing?.externalUserId) {
    await writeGpsProviderIndex(env, provider, existing.externalUserId, null)
  }
  return json({ ok: true, provider, connected: false })
}

export async function handleGpsSync(
  env: Env,
  identity: FirebaseIdentity,
  provider: GpsProvider,
): Promise<Response> {
  const anon = rejectAnonymous(identity)
  if (anon) return anon
  if (provider === 'wahoo') return syncWahooRecent(env, identity)
  return json(
    {
      error: `Sync pull de ${provider} pendiente de credenciales / endpoints oficiales`,
      code: 'gps_sync_pending',
    },
    501,
  )
}

export async function handleGpsWebhook(
  request: Request,
  env: Env,
  provider: GpsProvider,
): Promise<Response> {
  if (provider === 'wahoo') return handleWahooWebhook(request, env)
  if (provider === 'igpsport') return handleIgpsportWebhook(request, env)
  return handleGarminWebhook(request, env)
}
