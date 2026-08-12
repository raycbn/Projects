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
        const result = await this.valhalla.calculateRoute(request)
        const altCount = result.alternatives?.length ?? 0
        // Always top up with ORS when under 2 alternatives so /ruta can offer opciones.
        if (
          request.wantAlternatives &&
          altCount < 2 &&
          request.routeType !== 'circular' &&
          this.ors.isConfigured()
        ) {
          try {
            const ors = await this.ors.calculateRoute({
              ...request,
              wantAlternatives: true,
            })
            const merged = [
              ...(result.alternatives ?? []),
              {
                geometry: ors.geometry,
                elevationProfile: ors.elevationProfile,
                stats: ors.stats,
                rawInstructions: ors.rawInstructions,
                surfaceEdges: ors.surfaceEdges,
              },
              ...(ors.alternatives ?? []),
            ]
            return { ...result, alternatives: merged.slice(0, 2) }
          } catch (orsErr) {
            console.warn('[routing] ORS alternatives top-up failed', orsErr)
          }
        }
        return result
      } catch (error) {
        console.warn('[routing] Valhalla failed; falling back to ORS', error)
        if (!this.ors.isConfigured()) throw error
      }
    }

    if (!this.ors.isConfigured()) {
      throw new RoutingError('ORS fallback is not configured', 'not_configured')
    }

    return this.ors.calculateRoute({
      ...request,
      wantAlternatives: Boolean(request.wantAlternatives),
      circularSeed: request.circularSeed ?? 0,
    })
  }
}
