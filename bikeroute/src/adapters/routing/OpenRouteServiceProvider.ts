import polyline from '@mapbox/polyline'
import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'
import type {
  BikeType,
  ElevationPoint,
  LatLng,
  RoutePreference,
  RoutingRequest,
  RoutingResult,
} from '@/domain/types'
import { RoutingError } from '@/domain/types'
import { buildStatsFromProfile } from '@/lib/stats'

const ORS_BASE = 'https://api.openrouteservice.org'

function mapBikeProfile(bikeType: BikeType): string {
  switch (bikeType) {
    case 'road':
      return 'cycling-road'
    case 'mtb':
      return 'cycling-mountain'
    case 'ebike':
      return 'cycling-electric'
    case 'gravel':
    case 'urban':
    default:
      return 'cycling-regular'
  }
}

function buildOptions(preferences: RoutePreference[]) {
  const avoid_features: string[] = []
  const profile_params: Record<string, unknown> = {}

  if (preferences.includes('avoid_unpaved')) {
    // ORS has limited surface controls; prefer paved via steepness/avoid where possible.
  }
  if (preferences.includes('prefer_less_elevation')) {
    profile_params.weightings = { ...(profile_params.weightings as object), steepness_difficulty: 0 }
  }
  if (preferences.includes('prefer_faster') || preferences.includes('prefer_shorter')) {
    // preference_type handled via preference field below
  }

  // Steps are rarely useful for bikes
  avoid_features.push('steps')

  return {
    avoid_features: avoid_features.length ? avoid_features : undefined,
    profile_params: Object.keys(profile_params).length ? profile_params : undefined,
  }
}

function preferenceMode(preferences: RoutePreference[]): 'recommended' | 'shortest' | 'fastest' {
  if (preferences.includes('prefer_shorter')) return 'shortest'
  if (preferences.includes('prefer_faster')) return 'fastest'
  return 'recommended'
}

function decodeGeometry(encoded: string, elevation = true): { coordinates: [number, number][]; profile: ElevationPoint[] } {
  // ORS returns polyline6 with elevation as 3rd dimension when elevation=true
  const decoded = polyline.decode(encoded, 6) as Array<[number, number] | [number, number, number]>
  const coordinates: [number, number][] = []
  const profile: ElevationPoint[] = []
  let distance = 0

  for (let i = 0; i < decoded.length; i += 1) {
    const row = decoded[i]
    const lat = row[0]
    const lng = row[1]
    const elev = elevation && row.length > 2 ? row[2] : 0
    coordinates.push([lng, lat])

    if (i > 0) {
      const prev = decoded[i - 1]
      const R = 6371000
      const dLat = ((lat - prev[0]) * Math.PI) / 180
      const dLng = ((lng - prev[1]) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((prev[0] * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2
      distance += 2 * R * Math.asin(Math.sqrt(a))
    }

    profile.push({
      distanceMeters: distance,
      elevationMeters: elev ?? 0,
      position: { lat, lng },
    })
  }

  return { coordinates, profile }
}

/**
 * OpenRouteService Directions adapter.
 * Requires VITE_ROUTING_API_KEY (or server proxy). Never commit real keys.
 *
 * Note: calling ORS directly from the browser may hit CORS depending on HeiGIT
 * API status. Production should use a Cloud Functions proxy (VITE_USE_ROUTING_PROXY).
 */
export class OpenRouteServiceProvider implements RoutingProvider {
  readonly name = 'openrouteservice'
  private readonly apiKey: string | undefined
  private readonly baseUrl: string

  constructor(
    apiKey: string | undefined = import.meta.env.VITE_ROUTING_API_KEY,
    baseUrl: string = import.meta.env.VITE_ROUTING_PROXY_URL || ORS_BASE,
  ) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey) || Boolean(import.meta.env.VITE_ROUTING_PROXY_URL)
  }

  async calculateRoute(request: RoutingRequest): Promise<RoutingResult> {
    if (!this.isConfigured()) {
      throw new RoutingError(
        'Routing provider is not configured. Set VITE_ROUTING_API_KEY or VITE_ROUTING_PROXY_URL.',
        'not_configured',
      )
    }

    if (request.routeType === 'circular') {
      throw new RoutingError(
        'Circular routing algorithm is not implemented yet. Architecture is prepared for Phase 3.',
        'invalid_request',
      )
    }

    const waypoints: LatLng[] =
      request.routeType === 'out_and_back'
        ? [...request.waypoints, request.waypoints[0]]
        : request.waypoints

    if (waypoints.length < 2) {
      throw new RoutingError('At least two waypoints are required', 'invalid_request')
    }

    const profile = mapBikeProfile(request.bikeType)
    const coordinates = waypoints.map((w) => [w.lng, w.lat])
    const options = buildOptions(request.preferences)

    const body = {
      coordinates,
      elevation: true,
      instructions: true,
      language: request.language ?? 'es',
      preference: preferenceMode(request.preferences),
      options: {
        ...options,
      },
    }

    try {
      const response = await fetch(`${this.baseUrl}/v2/directions/${profile}/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: this.apiKey } : {}),
        },
        body: JSON.stringify(body),
      })

      if (response.status === 429) {
        throw new RoutingError('Rate limit exceeded', 'rate_limited')
      }

      if (!response.ok) {
        const text = await response.text()
        console.error('[ORS]', response.status, text)
        if (response.status === 404 || text.toLowerCase().includes('could not find routable')) {
          throw new RoutingError('No route found for preferences', 'no_route')
        }
        throw new RoutingError('Provider error', 'provider_error', text)
      }

      const data = (await response.json()) as {
        routes?: Array<{
          summary?: { distance?: number; duration?: number; ascent?: number; descent?: number }
          geometry?: string
          segments?: Array<{ steps?: Array<{ instruction?: string }> }>
        }>
      }

      const route = data.routes?.[0]
      if (!route?.geometry) {
        throw new RoutingError('No route found for preferences', 'no_route')
      }

      const { coordinates: coords, profile: elevationProfile } = decodeGeometry(route.geometry, true)
      const distanceMeters = route.summary?.distance ?? 0
      const durationSeconds = route.summary?.duration
        ? Math.round(route.summary.duration)
        : undefined

      let stats = buildStatsFromProfile(
        distanceMeters,
        elevationProfile,
        request.bikeType,
        durationSeconds,
      )

      if (typeof route.summary?.ascent === 'number') {
        stats = { ...stats, elevationGainMeters: Math.round(route.summary.ascent) }
      }
      if (typeof route.summary?.descent === 'number') {
        stats = { ...stats, elevationLossMeters: Math.round(route.summary.descent) }
      }

      const rawInstructions =
        route.segments?.flatMap(
          (seg) => seg.steps?.map((s) => s.instruction ?? '').filter(Boolean) ?? [],
        ) ?? []

      return {
        geometry: { type: 'LineString', coordinates: coords },
        elevationProfile,
        stats,
        provider: this.name,
        rawInstructions,
      }
    } catch (error) {
      if (error instanceof RoutingError) throw error
      console.error('[ORS] network', error)
      throw new RoutingError('Network error talking to routing provider', 'network', error)
    }
  }
}
