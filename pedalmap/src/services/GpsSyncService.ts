import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import { track } from '@/lib/analytics'

export type GpsProviderId = 'wahoo' | 'igpsport' | 'garmin'

export type GpsProviderStatus = {
  id: GpsProviderId
  label: string
  configured: boolean
  connected: boolean
  externalUserId: string | null
}

function apiBase(): string {
  const url =
    import.meta.env.VITE_PEDALMAP_API_URL ||
    import.meta.env.VITE_ROUTING_PROXY_URL ||
    ''
  return typeof url === 'string' ? url.replace(/\/+$/, '') : ''
}

async function authHeader(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser
  if (!user || user.isAnonymous) throw new Error('Inicia sesión con una cuenta real para conectar GPS')
  const token = await user.getIdToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

/** Official GPS cloud sync via Worker (Wahoo / iGPSPORT / Garmin). */
export class GpsSyncService {
  isApiReady(): boolean {
    return isFirebaseConfigured() && Boolean(apiBase())
  }

  async status(): Promise<GpsProviderStatus[]> {
    if (!this.isApiReady()) return []
    const res = await fetch(`${apiBase()}/gps/status`, { headers: await authHeader() })
    const data = (await res.json()) as { providers?: GpsProviderStatus[]; error?: string }
    if (!res.ok) throw new Error(data.error || 'No se pudo consultar GPS')
    return data.providers ?? []
  }

  async startConnect(provider: GpsProviderId): Promise<{ url: string }> {
    const res = await fetch(`${apiBase()}/gps/${provider}/oauth/start`, {
      method: 'POST',
      headers: await authHeader(),
      body: '{}',
    })
    const data = (await res.json()) as { url?: string; error?: string; hint?: string }
    if (!res.ok || !data.url) {
      throw new Error(data.error || data.hint || `No se pudo conectar ${provider}`)
    }
    track('gps_connect_started', { provider })
    return { url: data.url }
  }

  async disconnect(provider: GpsProviderId): Promise<void> {
    const res = await fetch(`${apiBase()}/gps/${provider}/disconnect`, {
      method: 'POST',
      headers: await authHeader(),
      body: '{}',
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error || 'No se pudo desconectar')
    }
    track('gps_disconnected', { provider })
  }

  async sync(provider: GpsProviderId): Promise<{ imported: number; skipped: number }> {
    const res = await fetch(`${apiBase()}/gps/${provider}/sync`, {
      method: 'POST',
      headers: await authHeader(),
      body: '{}',
    })
    const data = (await res.json()) as {
      imported?: number
      skipped?: number
      error?: string
    }
    if (!res.ok) throw new Error(data.error || 'Sync falló')
    track('gps_synced', { provider, imported: data.imported ?? 0 })
    return { imported: data.imported ?? 0, skipped: data.skipped ?? 0 }
  }
}

export const gpsSyncService = new GpsSyncService()
