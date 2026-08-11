/**
 * Pass a finished planned route into `/ruta` without stuffing geometry in the URL.
 */
import type { RouteDraft } from '@/domain/types'

const READY_ROUTE_KEY = 'pedalmap_ready_route'

export type ReadyRoutePacket = {
  draft: RouteDraft
  savedRouteId?: string | null
  shareSlug?: string | null
  source?: 'calculate' | 'saved' | 'import'
}

export function stashReadyRoute(packet: ReadyRoutePacket): void {
  try {
    sessionStorage.setItem(READY_ROUTE_KEY, JSON.stringify(packet))
  } catch {
    /* ignore quota */
  }
}

export function peekReadyRoute(): ReadyRoutePacket | null {
  try {
    const raw = sessionStorage.getItem(READY_ROUTE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ReadyRoutePacket
  } catch {
    return null
  }
}

export function clearReadyRoute(): void {
  try {
    sessionStorage.removeItem(READY_ROUTE_KEY)
  } catch {
    /* ignore */
  }
}
