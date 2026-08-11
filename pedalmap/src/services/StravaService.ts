import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import { track } from '@/lib/analytics'
import type { Activity } from '@/domain/types'

function apiBase(): string {
  const url =
    import.meta.env.VITE_PEDALMAP_API_URL ||
    import.meta.env.VITE_ROUTING_PROXY_URL ||
    ''
  return typeof url === 'string' ? url.replace(/\/+$/, '') : ''
}

async function authHeader(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser
  if (!user || user.isAnonymous) {
    throw new Error('Inicia sesión con una cuenta real para sincronizar el GPS')
  }
  const token = await user.getIdToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export type StravaActivitySummary = {
  id: number
  externalId: string
  name: string
  type: string
  startedAt: string
  durationSeconds: number
  distanceMeters: number
  elevationGainMeters: number
  averageHeartRateBpm?: number
  averageCadenceRpm?: number
  averagePowerWatts?: number
  averageSpeedMetersPerSecond?: number
}

/**
 * Strava via Cloudflare Worker — free OAuth bridge (iGPSPORT / Garmin → Strava → PedalMap).
 */
export class StravaService {
  isApiReady(): boolean {
    return isFirebaseConfigured() && Boolean(apiBase())
  }

  async status(): Promise<{ configured: boolean; connected: boolean; athleteId: number | null }> {
    if (!this.isApiReady()) return { configured: false, connected: false, athleteId: null }
    const res = await fetch(`${apiBase()}/strava/status`, { headers: await authHeader() })
    const data = (await res.json()) as {
      configured?: boolean
      connected?: boolean
      athleteId?: number | null
      error?: string
    }
    if (!res.ok) throw new Error(data.error || 'No se pudo consultar la sincronización GPS')
    return {
      configured: Boolean(data.configured),
      connected: Boolean(data.connected),
      athleteId: data.athleteId ?? null,
    }
  }

  async startConnect(): Promise<{ url: string }> {
    const res = await fetch(`${apiBase()}/strava/oauth/start`, {
      method: 'POST',
      headers: await authHeader(),
      body: '{}',
    })
    const data = (await res.json()) as { url?: string; error?: string; code?: string }
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'No se pudo iniciar la autorización de sincronización')
    }
    track('strava_connect_started')
    return { url: data.url }
  }

  async disconnect(): Promise<void> {
    const res = await fetch(`${apiBase()}/strava/disconnect`, {
      method: 'POST',
      headers: await authHeader(),
      body: '{}',
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error || 'No se pudo desactivar la sincronización')
    }
    track('strava_disconnected')
  }

  async listRecent(perPage = 20): Promise<StravaActivitySummary[]> {
    const res = await fetch(`${apiBase()}/strava/activities?per_page=${perPage}`, {
      headers: await authHeader(),
    })
    const data = (await res.json()) as { activities?: StravaActivitySummary[]; error?: string }
    if (!res.ok) throw new Error(data.error || 'No se pudieron listar las salidas a importar')
    return data.activities ?? []
  }

  async fetchImportPayload(
    stravaActivityId: number,
  ): Promise<Omit<Activity, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> {
    const res = await fetch(`${apiBase()}/strava/activities/${stravaActivityId}/import`, {
      method: 'POST',
      headers: await authHeader(),
      body: '{}',
    })
    const data = (await res.json()) as {
      activity?: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>
      error?: string
    }
    if (!res.ok || !data.activity) {
      throw new Error(data.error || 'No se pudo importar la actividad')
    }
    track('strava_activity_imported', { strava_id: stravaActivityId })
    const { userId: _ignored, ...rest } = data.activity
    return rest
  }

  /**
   * Pull recent bike rides into PedalMap activities.
   * Destination is always PedalMap — Strava is only the transport.
   */
  async syncRecentToPedalMap(
    userId: string,
    importFinished: (
      userId: string,
      input: Omit<Activity, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    ) => Promise<{ created: boolean }>,
    limit = 12,
  ): Promise<{ imported: number; skipped: number }> {
    const list = await this.listRecent(Math.min(30, Math.max(limit, 8)))
    const bike = /ride|virtual|ebike|gravel|mountain|cycl/i
    let imported = 0
    let skipped = 0
    for (const item of list) {
      if (!bike.test(item.type || '')) {
        skipped += 1
        continue
      }
      try {
        const payload = await this.fetchImportPayload(item.id)
        const result = await importFinished(userId, payload)
        if (result.created) imported += 1
        else skipped += 1
      } catch (error) {
        console.warn('[strava] import skip', item.id, error)
        skipped += 1
      }
    }
    track('strava_sync_completed', { imported, skipped })
    return { imported, skipped }
  }
}

export const stravaService = new StravaService()
