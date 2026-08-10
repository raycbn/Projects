import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'
import { OpenRouteServiceProvider } from '@/adapters/routing/OpenRouteServiceProvider'
import { ValhallaProvider } from '@/adapters/routing/ValhallaProvider'
import type { RoutingRequest, RoutingResult } from '@/domain/types'
import { RoutingError } from '@/domain/types'

/**
 * Commercial routing stack:
 * - A→B / out-and-back → Valhalla (native bike surface costing)
 * - Circular / Objetivo → ORS round_trip (Valhalla has no equivalent)
 * - Any Valhalla failure → ORS fallback so the product stays usable
 */
export class CompositeRoutingProvider implements RoutingProvider {
  readonly name = 'composite-valhalla-ors'
  private readonly valhalla: ValhallaProvider
  private readonly ors: OpenRouteServiceProvider

  constructor(
    valhalla: ValhallaProvider = new ValhallaProvider(),
    ors: OpenRouteServiceProvider = new OpenRouteServiceProvider(),
  ) {
    this.valhalla = valhalla
    this.ors = ors
  }

  isConfigured(): boolean {
    return this.valhalla.isConfigured() || this.ors.isConfigured()
  }

  async calculateRoute(request: RoutingRequest): Promise<RoutingResult> {
    if (!this.isConfigured()) {
      throw new RoutingError(
        'No routing provider configured (Valhalla proxy and/or ORS)',
        'not_configured',
      )
    }

    const preferValhalla =
      request.routeType !== 'circular' && this.valhalla.isConfigured()

    if (preferValhalla) {
      try {
        const result = await this.valhalla.calculateRoute(request)
        return result
      } catch (error) {
        console.warn('[routing] Valhalla failed; falling back to ORS', error)
        if (!this.ors.isConfigured()) throw error
        // Fall through to ORS
      }
    }

    if (!this.ors.isConfigured()) {
      throw new RoutingError('ORS fallback is not configured', 'not_configured')
    }

    return this.ors.calculateRoute(request)
  }
}
