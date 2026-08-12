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
/** Monotonic stamp so `/ruta` can detect a fresher stash after SPA navigation. */
let memoryEpoch = 0

export function readyRouteEpoch(): number {
  return memoryEpoch
}

/**
 * Prefer the packet that still carries ranked alternatives (2–3 opciones).
 * SessionStorage may have an older slim copy while memory has the fresh calculate.
 */
export function richerPacket(
  a: ReadyRoutePacket | null | undefined,
  b: ReadyRoutePacket | null | undefined,
): ReadyRoutePacket | null {
  if (!a?.draft) return b?.draft ? b : null
  if (!b?.draft) return a
  const aOpts = a.draft.routeOptions?.length ?? 0
  const bOpts = b.draft.routeOptions?.length ?? 0
  if (bOpts > aOpts) return b
  if (aOpts > bOpts) return a
  const aAlts = a.draft.alternatives?.length ?? 0
  const bAlts = b.draft.alternatives?.length ?? 0
  if (bAlts > aAlts) return b
  // Prefer explicit calculate/import handoff over a stale saved open.
  if (b.source === 'calculate' && a.source !== 'calculate') return b
  if (a.source === 'calculate' && b.source !== 'calculate') return a
  return b.fitNonce && (!a.fitNonce || b.fitNonce >= a.fitNonce) ? b : a
}

export function stashReadyRoute(packet: ReadyRoutePacket): void {
  memoryPacket = packet
  memoryEpoch += 1
  try {
    sessionStorage.setItem(READY_ROUTE_KEY, JSON.stringify(packet))
  } catch {
    // Quota / private mode — try a leaner copy (keep option geometries, trim profiles).
    try {
      sessionStorage.setItem(READY_ROUTE_KEY, JSON.stringify(slimPacketForStorage(packet)))
    } catch {
      // Memory still holds the fresh calculate result (incl. routeOptions).
    }
  }
}

export function peekReadyRoute(): ReadyRoutePacket | null {
  let fromSession: ReadyRoutePacket | null = null
  try {
    const raw = sessionStorage.getItem(READY_ROUTE_KEY)
    if (raw) {
      fromSession = JSON.parse(raw) as ReadyRoutePacket
    }
  } catch {
    fromSession = null
  }
  const best = richerPacket(memoryPacket, fromSession)
  if (best) memoryPacket = best
  return best
}

export function clearReadyRoute(): void {
  memoryPacket = null
  memoryEpoch += 1
  try {
    sessionStorage.removeItem(READY_ROUTE_KEY)
  } catch {
    /* ignore */
  }
}

/** Drop heavy elevation on non-selected options so sessionStorage can keep 2–3 geometries. */
function slimPacketForStorage(packet: ReadyRoutePacket): ReadyRoutePacket {
  const draft = packet.draft
  const selected = draft.selectedOptionId
  const routeOptions = draft.routeOptions?.map((opt) => {
    if (opt.id === selected || opt.id === draft.routeOptions?.[0]?.id) return opt
    return {
      ...opt,
      elevationProfile: (opt.elevationProfile ?? []).filter((_, i) => i % 4 === 0),
      instructions: (opt.instructions ?? []).slice(0, 12),
      surfaceEdges: (opt.surfaceEdges ?? []).slice(0, 80),
    }
  })
  return {
    ...packet,
    draft: {
      ...draft,
      routeOptions,
      elevationProfile: (draft.elevationProfile ?? []).filter((_, i) => i % 2 === 0),
      instructions: (draft.instructions ?? []).slice(0, 80),
    },
  }
}
