import type { RoutingRequest, RoutingResult } from '@/domain/types'

/**
 * Provider-agnostic routing contract.
 * Swap OpenRouteService / GraphHopper / OSRM / Valhalla without touching UI.
 */
export interface RoutingProvider {
  readonly name: string
  isConfigured(): boolean
  calculateRoute(request: RoutingRequest): Promise<RoutingResult>
}
