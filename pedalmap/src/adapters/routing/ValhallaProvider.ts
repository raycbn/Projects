import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'
import type {
  ElevationPoint,
  RoutingRequest,
  RoutingResult,
} from '@/domain/types'
import { RoutingError } from '@/domain/types'
import { buildStatsFromProfile, normalizeCyclingElevationProfile } from '@/lib/stats'
import {
  surfaceStatsFromValhallaEdges,
  type ValhallaEdgeAttr,
} from '@/lib/valhallaSurfaces'

type BikeRouteResponse = {
  ok?: boolean
  error?: string
  provider?: string
  coordinates?: [number, number][]
  elevationProfile?: ElevationPoint[]
  edges?: ValhallaEdgeAttr[]
  distanceMeters?: number
  durationSeconds?: number
  instructions?: string[]
}

function resolveProxyUrl(): string | undefined {
  const proxy =
    import.meta.env.VITE_PEDALMAP_API_URL || import.meta.env.VITE_ROUTING_PROXY_URL
  if (typeof proxy !== 'string' || !proxy.trim()) return undefined
  return proxy.trim().replace(/\/+$/, '')
}

/**
 * Valhalla bicycle routing (surface-aware) via a single Worker round-trip:
 * A→B, ida-vuelta and Objetivo circular.
 */
export class ValhallaProvider implements RoutingProvider {
  readonly name = 'valhalla'
  private readonly baseUrl: string

  constructor(baseUrl?: string) {
    const proxy = resolveProxyUrl()
    this.baseUrl = (baseUrl ?? proxy ?? '').replace(/\/+$/, '')
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl)
  }

  async calculateRoute(request: RoutingRequest): Promise<RoutingResult> {
    if (!this.isConfigured()) {
      throw new RoutingError('Valhalla provider is not configured', 'not_configured')
    }

    if (request.routeType === 'circular') {
      if (!request.waypoints.length) {
        throw new RoutingError('Circular routes require a start point', 'invalid_request')
      }
      if (!request.circularDistanceMeters) {
        throw new RoutingError('Circular routes require a target distance', 'invalid_request')
      }
    } else if (request.waypoints.length < 2) {
      throw new RoutingError('At least two waypoints are required', 'invalid_request')
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/valhalla/bike-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          bikeType: request.bikeType,
          preferences: request.preferences,
          routeType: request.routeType,
          waypoints: request.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
          circularDistanceMeters: request.circularDistanceMeters,
          targetElevationGainMeters: request.targetElevationGainMeters,
          circularSeed: request.circularSeed,
          language: request.language ?? 'es',
        }),
      })
    } catch (error) {
      throw new RoutingError('Network error talking to Valhalla', 'network', error)
    }

    const text = await response.text()
    let data: BikeRouteResponse
    try {
      data = JSON.parse(text) as BikeRouteResponse
    } catch (error) {
      throw new RoutingError('Valhalla returned invalid JSON', 'provider_error', error)
    }

    if (!response.ok || data.error || !data.coordinates || data.coordinates.length < 2) {
      if (response.status === 429) {
        throw new RoutingError('Rate limit exceeded', 'rate_limited', text)
      }
      throw new RoutingError(
        data.error || 'No route found',
        response.status === 404 ? 'no_route' : 'provider_error',
        text,
      )
    }

    const elevationProfile = normalizeCyclingElevationProfile(data.elevationProfile ?? [])
    const surfaceStats = surfaceStatsFromValhallaEdges(
      request.bikeType,
      data.edges ?? [],
    )
    const distanceMeters = data.distanceMeters ?? 0
    const durationSeconds = data.durationSeconds
    const stats = buildStatsFromProfile(
      distanceMeters,
      elevationProfile,
      request.bikeType,
      durationSeconds,
    )
    stats.surfaceStats = surfaceStats

    return {
      geometry: { type: 'LineString', coordinates: data.coordinates },
      elevationProfile,
      stats,
      provider: this.name,
      rawInstructions: data.instructions ?? [],
    }
  }
}
