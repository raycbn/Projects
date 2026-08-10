import { createRoutingProvider } from '@/adapters/routing/createRoutingProvider'
import { routingRequestSchema } from '@/domain/schemas'
import type {
  BikeType,
  RouteAlternative,
  RouteDraft,
  RoutePreference,
  RouteType,
  RoutingResult,
  Waypoint,
} from '@/domain/types'
import { RoutingError } from '@/domain/types'

export interface CalculateRouteInput {
  waypoints: Waypoint[]
  bikeType: BikeType
  preferences: RoutePreference[]
  routeType: RouteType
  title?: string
  circularDistanceMeters?: number
  targetElevationGainMeters?: number
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
      routeType: input.routeType,
      language: 'es',
      circularDistanceMeters: input.circularDistanceMeters,
      targetElevationGainMeters: input.targetElevationGainMeters,
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
        : startName && endName
          ? `${startName} → ${endName}`
          : 'Nueva ruta')

    const alternatives: RouteAlternative[] | undefined = result.alternatives?.map((alt, index) => ({
      id: `alt-${index + 1}`,
      label: `Alternativa ${index + 1}`,
      geometry: alt.geometry,
      elevationProfile: alt.elevationProfile,
      stats: alt.stats,
    }))

    return {
      title,
      type: input.routeType,
      bikeType: input.bikeType,
      preferences: input.preferences,
      waypoints: sorted,
      geometry: result.geometry,
      elevationProfile: result.elevationProfile,
      stats: result.stats,
      circularDistanceMeters: input.circularDistanceMeters,
      targetElevationGainMeters: input.targetElevationGainMeters,
      alternatives,
    }
  }
}

export const routeService = new RouteService()
