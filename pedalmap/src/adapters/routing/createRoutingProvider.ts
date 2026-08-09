import { OpenRouteServiceProvider } from '@/adapters/routing/OpenRouteServiceProvider'
import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'

/**
 * Factory for the active routing provider.
 * Future: GraphHopperProvider | OSRMProvider | ValhallaProvider
 */
export function createRoutingProvider(): RoutingProvider {
  const selected = (import.meta.env.VITE_ROUTING_PROVIDER || 'openrouteservice').toLowerCase()

  switch (selected) {
    case 'openrouteservice':
    case 'ors':
      return new OpenRouteServiceProvider()
    default:
      console.warn(`Unknown routing provider "${selected}", falling back to OpenRouteService`)
      return new OpenRouteServiceProvider()
  }
}
