import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'
import type {
  ElevationPoint,
  RoutingRequest,
  RoutingResult,
} from '@/domain/types'
import { RoutingError } from '@/domain/types'
import { routingAuthHeaders } from '@/lib/routingAuth'
import { buildStatsFromProfile, normalizeCyclingElevationProfile } from '@/lib/stats'
import {
  surfaceStatsFromValhallaEdges,
  type ValhallaEdgeAttr,
} from '@/lib/valhallaSurfaces'

type BikeRoutePayload = {
  coordinates?: [number, number][]
  elevationProfile?: ElevationPoint[]
  edges?: ValhallaEdgeAttr[]
  distanceMeters?: number
  durationSeconds?: number
  instructions?: string[]
  objectiveMatch?: 'within_tolerance' | 'closest'
  objectiveDistanceError?: number
  objectiveElevationError?: number
  objectiveElevationGainMeters?: number
}

type BikeRouteResponse = BikeRoutePayload & {
  ok?: boolean
  error?: string
  provider?: string
  alternatives?: BikeRoutePayload[]
}

function resolveProxyUrl(): string | undefined {
  const proxy =
    import.meta.env.VITE_PEDALMAP_API_URL || import.meta.env.VITE_ROUTING_PROXY_URL
  if (typeof proxy !== 'string' || !proxy.trim()) return undefined
  return proxy.trim().replace(/\/+$/, '')
}

function payloadToPartial(
  data: BikeRoutePayload,
  bikeType: RoutingRequest['bikeType'],
): Omit<RoutingResult, 'provider' | 'alternatives'> {
  const elevationProfile = normalizeCyclingElevationProfile(data.elevationProfile ?? [])
  const surfaceStats = surfaceStatsFromValhallaEdges(bikeType, data.edges ?? [])
  const distanceMeters = data.distanceMeters ?? 0
  const durationSeconds = data.durationSeconds
  const stats = buildStatsFromProfile(
    distanceMeters,
    elevationProfile,
    bikeType,
    durationSeconds,
  )
  stats.surfaceStats = surfaceStats
  return {
    geometry: { type: 'LineString', coordinates: data.coordinates ?? [] },
    elevationProfile,
    stats,
    rawInstructions: data.instructions ?? [],
    surfaceEdges: (data.edges ?? []).map((e) => ({
      length: e.length,
      surface: e.surface,
      road_class: e.road_class,
      use: e.use,
      cycle_lane: e.cycle_lane,
      bicycle_network: e.bicycle_network,
    })),
    objectiveMatch: data.objectiveMatch,
    objectiveDistanceError: data.objectiveDistanceError,
    objectiveElevationError: data.objectiveElevationError,
    objectiveElevationGainMeters: data.objectiveElevationGainMeters,
  }
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

  async calculateRoute(request: RoutingRequest, externalSignal?: AbortSignal): Promise<RoutingResult> {
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

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const abortHandler = () => controller.abort()
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort()
      } else {
        externalSignal.addEventListener('abort', abortHandler)
      }
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/valhalla/bike-route`, {
        method: 'POST',
        headers: await routingAuthHeaders({ Accept: 'application/json' }),
        body: JSON.stringify({
          bikeType: request.bikeType,
          preferences: request.preferences,
          routeType: request.routeType,
          waypoints: request.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
          circularDistanceMeters: request.circularDistanceMeters,
          targetElevationGainMeters: request.targetElevationGainMeters,
          circularSeed: request.circularSeed,
          language: request.language ?? 'es',
          wantAlternatives: Boolean(request.wantAlternatives),
        }),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RoutingError('Valhalla request timeout (15s)', 'network', error)
      }
      throw new RoutingError('Network error talking to Valhalla', 'network', error)
    } finally {
      clearTimeout(timeoutId)
      if (externalSignal) {
        externalSignal.removeEventListener('abort', abortHandler)
      }
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
      if (
        response.status === 403 &&
        (text.includes('create_limit') || (data as { code?: string }).code === 'create_limit')
      ) {
        throw new RoutingError(
          (data as { error?: string }).error || 'Create limit exceeded',
          'create_limit',
          text,
        )
      }
      throw new RoutingError(
        data.error || 'No route found',
        response.status === 404 ? 'no_route' : 'provider_error',
        text,
      )
    }

    const primary = payloadToPartial(data, request.bikeType)
    const alternatives = (data.alternatives ?? [])
      .filter((alt) => (alt.coordinates?.length ?? 0) >= 2)
      .map((alt) => {
        const partial = payloadToPartial(alt, request.bikeType)
        return {
          geometry: partial.geometry,
          elevationProfile: partial.elevationProfile,
          stats: partial.stats,
          rawInstructions: partial.rawInstructions,
          surfaceEdges: partial.surfaceEdges,
          objectiveMatch: partial.objectiveMatch,
          objectiveDistanceError: partial.objectiveDistanceError,
          objectiveElevationError: partial.objectiveElevationError,
          objectiveElevationGainMeters: partial.objectiveElevationGainMeters,
        }
      })

    return {
      ...primary,
      provider: this.name,
      alternatives: alternatives.length ? alternatives : undefined,
    }
  }
}
