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
