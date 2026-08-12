/**
 * Pass a finished planned route into `/ruta` without stuffing geometry in the URL.
 * Keep an in-memory copy so 2–3 full alternatives survive even if sessionStorage
 * quota rejects the JSON (common on long Spanish A→B geometries).
 */
import type { RouteDraft } from '@/domain/types'

const READY_ROUTE_KEY = 'pedalmap_ready_route'

export type ReadyRoutePacket = {
  draft: RouteDraft
  savedRouteId?: string | null
  shareSlug?: string | null
  source?: 'calculate' | 'saved' | 'import'
  /** Bumps MapView fit when the same geometry is re-imported / reopened. */
  fitNonce?: number
}

let memoryPacket: ReadyRoutePacket | null = null

export function stashReadyRoute(packet: ReadyRoutePacket): void {
  memoryPacket = packet
  try {
    sessionStorage.setItem(READY_ROUTE_KEY, JSON.stringify(packet))
  } catch {
    // Quota / private mode — memory still holds the fresh calculate result.
  }
}

export function peekReadyRoute(): ReadyRoutePacket | null {
  if (memoryPacket) return memoryPacket
  try {
    const raw = sessionStorage.getItem(READY_ROUTE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReadyRoutePacket
    memoryPacket = parsed
    return parsed
  } catch {
    return null
  }
}

export function clearReadyRoute(): void {
  memoryPacket = null
  try {
    sessionStorage.removeItem(READY_ROUTE_KEY)
  } catch {
    /* ignore */
  }
}
