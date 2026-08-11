import { createRoutingProvider } from '@/adapters/routing/createRoutingProvider'
import { routingRequestSchema } from '@/domain/schemas'
import type {
  BikeType,
  RouteDraft,
  RoutePreference,
  RouteType,
  RoutingResult,
  Waypoint,
} from '@/domain/types'
import { RoutingError } from '@/domain/types'
import { rankRouteOptions } from '@/lib/routeOptions'

export interface CalculateRouteInput {
  waypoints: Waypoint[]
  bikeType: BikeType
  preferences: RoutePreference[]
  routeType: RouteType
  title?: string
  circularDistanceMeters?: number
  targetElevationGainMeters?: number
  circularSeed?: number
  wantAlternatives?: boolean
}

export class RouteService {
  private readonly provider: ReturnType<typeof createRoutingProvider>

  constructor(provider = createRoutingProvider()) {
    this.provider = provider
  }

  isRoutingConfigured(): boolean {
    return this.provider.isConfigured()
  }

  async calculate(input: CalculateRouteInput): Promise<RouteDraft> {
    const sorted = [...input.waypoints].sort((a, b) => a.order - b.order)

    const parsed = routingRequestSchema.safeParse({
      waypoints: sorted.map((w) => w.position),
      bikeType: input.bikeType,
      preferences: input.preferences,
      // Trazar en mapa uses the same point-to-point engine as A → B.
      routeType: input.routeType === 'map_trace' ? 'a_to_b' : input.routeType,
      language: 'es',
      circularDistanceMeters: input.circularDistanceMeters,
      targetElevationGainMeters: input.targetElevationGainMeters,
      circularSeed: input.circularSeed,
      wantAlternatives: input.wantAlternatives,
    })

    if (!parsed.success) {
      throw new RoutingError('Solicitud de ruta inválida', 'invalid_request', parsed.error)
    }

    const result: RoutingResult = await this.provider.calculateRoute(parsed.data)
    const startName = sorted[0]?.name
    const endName = sorted[sorted.length - 1]?.name
    const title =
      input.title ||
      (input.routeType === 'circular'
        ? `Circular desde ${startName ?? 'inicio'}`
        : input.routeType === 'map_trace'
          ? startName && endName
            ? `Trazado · ${startName} → ${endName}`
            : 'Ruta trazada'
          : startName && endName
            ? `${startName} → ${endName}`
            : 'Nueva ruta')

    const candidates = [
      {
        geometry: result.geometry,
        elevationProfile: result.elevationProfile,
        stats: result.stats,
        instructions: result.rawInstructions,
        surfaceEdges: result.surfaceEdges,
      },
      ...(result.alternatives ?? []).map((alt) => ({
        geometry: alt.geometry,
        elevationProfile: alt.elevationProfile,
        stats: alt.stats,
        instructions: alt.rawInstructions ?? result.rawInstructions,
        surfaceEdges: alt.surfaceEdges ?? result.surfaceEdges,
      })),
    ]

    const ranked = rankRouteOptions(candidates)
    const extras = ranked.routeOptions.filter((o) => o.id !== ranked.selectedOptionId)

    return {
      title,
      type: input.routeType,
      bikeType: input.bikeType,
      preferences: input.preferences,
      waypoints: sorted,
      geometry: ranked.active.geometry,
      elevationProfile: ranked.active.elevationProfile,
      stats: ranked.active.stats,
      circularDistanceMeters: input.circularDistanceMeters,
      targetElevationGainMeters: input.targetElevationGainMeters,
      circularSeed: input.circularSeed,
      instructions: ranked.active.instructions,
      surfaceEdges: ranked.active.surfaceEdges,
      routeOptions: ranked.routeOptions.length > 1 ? ranked.routeOptions : undefined,
      selectedOptionId: ranked.routeOptions.length > 1 ? ranked.selectedOptionId : undefined,
      // Legacy field: non-selected options only (older UI).
      alternatives: extras.length ? extras : undefined,
    }
  }
}

export const routeService = new RouteService()
