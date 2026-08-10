import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'
import { OpenRouteServiceProvider } from '@/adapters/routing/OpenRouteServiceProvider'
import { ValhallaProvider } from '@/adapters/routing/ValhallaProvider'
import type { RoutingRequest, RoutingResult } from '@/domain/types'
import { RoutingError } from '@/domain/types'

/**
 * Valhalla-first for A→B, ida-vuelta and Objetivo.
 * ORS only as failover (kept slim so the UI does not stall).
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

    if (this.valhalla.isConfigured()) {
      try {
        return await this.valhalla.calculateRoute(request)
      } catch (error) {
        console.warn('[routing] Valhalla failed; falling back to ORS', error)
        if (!this.ors.isConfigured()) throw error
      }
    }

    if (!this.ors.isConfigured()) {
      throw new RoutingError('ORS fallback is not configured', 'not_configured')
    }

    // Keep alternatives when the user asked for them; otherwise keep the slim failover.
    return this.ors.calculateRoute({
      ...request,
      wantAlternatives: Boolean(request.wantAlternatives),
      circularSeed: request.circularSeed ?? 0,
    })
  }
}
