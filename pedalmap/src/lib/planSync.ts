import { routingAuthHeaders } from '@/lib/routingAuth'

function apiBase(): string | undefined {
  const proxy =
    import.meta.env.VITE_PEDALMAP_API_URL || import.meta.env.VITE_ROUTING_PROXY_URL
  if (typeof proxy !== 'string' || !proxy.trim()) return undefined
  return proxy.trim().replace(/\/+$/, '')
}

export type ServerEntitlements = {
  ok: boolean
  plan: 'free' | 'premium'
  allowlisted: boolean
  gpxExport: boolean
  freeGpxRemaining?: number | null
  maxRoutesSaved: number | null
  routesSaved: number
  canSaveRoute?: boolean
}

/**
 * Persist ops allowlist Premium into Firestore via Worker Admin write.
 * Call after login so client entitlements match server plan.
 */
export async function syncServerPlan(): Promise<ServerEntitlements | null> {
  const base = apiBase()
  if (!base) return null
  try {
    const res = await fetch(`${base}/me/sync-plan`, {
      method: 'POST',
      headers: await routingAuthHeaders(),
    })
    if (!res.ok) {
      console.warn('[planSync] sync-plan', res.status)
      return null
    }
    return (await res.json()) as ServerEntitlements
  } catch (error) {
    console.warn('[planSync] sync-plan failed', error)
    return null
  }
}

/** Fresh server entitlements (plan + GPX + save cap). */
export async function fetchServerEntitlements(): Promise<ServerEntitlements | null> {
  const base = apiBase()
  if (!base) return null
  try {
    const res = await fetch(`${base}/me/entitlements`, {
      method: 'GET',
      headers: await routingAuthHeaders({ Accept: 'application/json' }),
    })
    if (!res.ok) {
      console.warn('[planSync] entitlements', res.status)
      return null
    }
    return (await res.json()) as ServerEntitlements
  } catch (error) {
    console.warn('[planSync] entitlements failed', error)
    return null
  }
}

/**
 * Server-enforced Free weekly GPX claim. Premium always ok.
 * Once this is called, any API or quota-check failure is denied rather than falling
 * back to the client counter; the local counter is not an authorization source.
 */
export async function claimServerGpxExport(): Promise<{
  allowed: boolean
  remaining: number | null
  error?: string
} | null> {
  const base = apiBase()
  if (!base) return { allowed: false, remaining: 0, error: 'quota_unavailable' }
  try {
    const headers = await routingAuthHeaders({ Accept: 'application/json' })
    console.log('[planSync] claim-gpx: authHeaderPresent=' + Boolean(headers.Authorization))
    console.log('[planSync] claim-gpx: baseUrl=' + base)
    const res = await fetch(`${base}/me/claim-gpx`, {
      method: 'POST',
      headers: headers,
      body: '{}',
    })
    console.log('[planSync] claim-gpx: status=' + res.status)
    const data = (await res.json().catch(() => ({}))) as {
      allowed?: boolean
      remaining?: number | null
      error?: string
      code?: string
    }
    if (res.status === 401) {
      const errMsg = data.error || data.code || '(unreadable)'
      console.warn('[planSync] claim-gpx 401: ' + errMsg + ' authHeaderPresent=' + Boolean(headers.Authorization))
    }
    if (res.status === 403) {
      console.warn('[planSync] claim-gpx 403: quota exceeded or forbidden')
      return { allowed: false, remaining: 0, error: data.code || data.error }
    }
    if (!res.ok) {
      console.warn('[planSync] claim-gpx', res.status)
      return {
        allowed: false,
        remaining: 0,
        error: data.error || data.code || 'quota_unavailable',
      }
    }
    return {
      allowed: data.allowed !== false,
      remaining: data.remaining ?? null,
      error: data.error || data.code,
    }
  } catch (error) {
    console.warn('[planSync] claim-gpx failed', error)
    return { allowed: false, remaining: 0, error: 'quota_unavailable' }
  }
}
