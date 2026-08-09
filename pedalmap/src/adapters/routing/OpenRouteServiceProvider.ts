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

/**
 * Recommended HeiGIT base URL (api.openrouteservice.org is deprecated; shut-off 2026-08-24).
 * No trailing slash.
 * @see https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912
 */
export const ORS_BASE = 'https://api.heigit.org/openrouteservice'

/** @deprecated Use ORS_BASE. Kept only for migration notes/tests. */
export const ORS_LEGACY_BASE = 'https://api.openrouteservice.org'

/**
 * ORS cycling profiles mapping.
 * gravel/urban → cycling-regular (ORS has no dedicated gravel/urban profile).
 */
export function mapBikeProfile(bikeType: BikeType): string {
  switch (bikeType) {
    case 'road':
      return 'cycling-road'
    case 'mtb':
      return 'cycling-mountain'
    case 'ebike':
      return 'cycling-electric'
    case 'gravel':
    case 'urban':
      return 'cycling-regular'
  }
}

/** Preferences with a real ORS mapping. Others must not be faked. */
export const ORS_SUPPORTED_PREFERENCES: RoutePreference[] = [
  'prefer_shorter',
  'prefer_faster',
  'prefer_less_elevation',
]

function buildOptions(preferences: RoutePreference[]) {
  const avoid_features: string[] = ['steps']
  const profile_params: Record<string, unknown> = {}

  if (preferences.includes('prefer_less_elevation')) {
    profile_params.weightings = { steepness_difficulty: 0 }
  }

  return {
    avoid_features,
    profile_params: Object.keys(profile_params).length ? profile_params : undefined,
  }
}

function preferenceMode(preferences: RoutePreference[]): 'recommended' | 'shortest' | 'fastest' {
  if (preferences.includes('prefer_shorter')) return 'shortest'
  if (preferences.includes('prefer_faster')) return 'fastest'
  return 'recommended'
}

function decodeGeometry(
  encoded: string,
  elevation = true,
): { coordinates: [number, number][]; profile: ElevationPoint[] } {
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

function resolveApiKey(): string | undefined {
  const key = import.meta.env.VITE_ORS_API_KEY || import.meta.env.VITE_ROUTING_API_KEY
  return typeof key === 'string' && key.trim() ? key.trim() : undefined
}

/**
 * OpenRouteService Directions adapter (HeiGIT).
 * Requires VITE_ORS_API_KEY (or VITE_ROUTING_PROXY_URL). Never commit real keys.
 */
export class OpenRouteServiceProvider implements RoutingProvider {
  readonly name = 'openrouteservice'
  private readonly apiKey: string | undefined
  private readonly baseUrl: string

  constructor(
    apiKey: string | undefined = resolveApiKey(),
    baseUrl: string = (import.meta.env.VITE_ROUTING_PROXY_URL as string | undefined) || ORS_BASE,
  ) {
    this.apiKey = apiKey
    // Normalize: never keep trailing slash (HeiGIT rejects some SDK paths with it)
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey) || Boolean(import.meta.env.VITE_ROUTING_PROXY_URL)
  }

  async calculateRoute(request: RoutingRequest): Promise<RoutingResult> {
    if (!this.isConfigured()) {
      throw new RoutingError(
        'Routing provider is not configured. Set VITE_ORS_API_KEY or VITE_ROUTING_PROXY_URL.',
        'not_configured',
      )
    }

    if (request.routeType === 'circular') {
      throw new RoutingError(
        'Circular routing algorithm is not implemented yet. Architecture is prepared for a later phase.',
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

    const url = `${this.baseUrl}/v2/directions/${profile}/json`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, application/geo+json',
          ...(this.apiKey ? { Authorization: this.apiKey } : {}),
        },
        body: JSON.stringify(body),
      })

      if (response.status === 429) {
        throw new RoutingError('Rate limit exceeded', 'rate_limited')
      }

      if (!response.ok) {
        const text = await response.text()
        console.error('[ORS]', response.status, text.slice(0, 500))
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
