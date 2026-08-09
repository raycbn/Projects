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

export interface CalculateRouteInput {
  waypoints: Waypoint[]
  bikeType: BikeType
  preferences: RoutePreference[]
  routeType: RouteType
  title?: string
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

    if (input.routeType === 'circular') {
      throw new RoutingError(
        'Las rutas circulares avanzadas llegarán en una fase posterior.',
        'invalid_request',
      )
    }

    const parsed = routingRequestSchema.safeParse({
      waypoints: sorted.map((w) => w.position),
      bikeType: input.bikeType,
      preferences: input.preferences,
      routeType: input.routeType,
      language: 'es',
    })

    if (!parsed.success) {
      throw new RoutingError('Solicitud de ruta inválida', 'invalid_request', parsed.error)
    }

    const result: RoutingResult = await this.provider.calculateRoute(parsed.data)
    const startName = sorted[0]?.name
    const endName = sorted[sorted.length - 1]?.name
    const title =
      input.title ||
      (startName && endName ? `${startName} → ${endName}` : 'Nueva ruta')

    return {
      title,
      type: input.routeType,
      bikeType: input.bikeType,
      preferences: input.preferences,
      waypoints: sorted,
      geometry: result.geometry,
      elevationProfile: result.elevationProfile,
      stats: result.stats,
    }
  }
}

export const routeService = new RouteService()
