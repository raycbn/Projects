import { CompositeRoutingProvider } from '@/adapters/routing/CompositeRoutingProvider'
import { OpenRouteServiceProvider } from '@/adapters/routing/OpenRouteServiceProvider'
import { ValhallaProvider } from '@/adapters/routing/ValhallaProvider'
import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'

/**
 * Factory for the active routing provider.
 *
 * Default `composite`: Valhalla (surface-aware bike costing) + ORS fallback/circular.
 * Override with VITE_ROUTING_PROVIDER=openrouteservice|valhalla|composite
 */
export function createRoutingProvider(): RoutingProvider {
  const selected = (import.meta.env.VITE_ROUTING_PROVIDER || 'composite').toLowerCase()

  switch (selected) {
    case 'valhalla':
      return new ValhallaProvider()
    case 'openrouteservice':
    case 'ors':
      return new OpenRouteServiceProvider()
    case 'composite':
    case 'valhalla-ors':
      return new CompositeRoutingProvider()
    default:
      console.warn(`Unknown routing provider "${selected}", falling back to composite`)
      return new CompositeRoutingProvider()
  }
}
