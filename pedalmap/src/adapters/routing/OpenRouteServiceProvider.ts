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

/**
 * When a preferred ORS profile is down (seen as Tyk "Down For Maintenance" 503),
 * try these real cycling profiles next. Never invent non-ORS profiles.
 */
export function profileFallbacks(profile: string): string[] {
  switch (profile) {
    case 'cycling-road':
      return ['cycling-regular']
    case 'cycling-electric':
      return ['cycling-regular']
    case 'cycling-mountain':
      return ['cycling-regular']
    default:
      return []
  }
}

export function isOrsMaintenanceResponse(status: number, body: string): boolean {
  return status === 503 || body.toLowerCase().includes('down for maintenance')
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

type OrsGeoJsonResponse = {
  features?: Array<{
    geometry?: {
      type?: string
      coordinates?: Array<[number, number] | [number, number, number]>
    }
    properties?: {
      summary?: { distance?: number; duration?: number; ascent?: number; descent?: number }
      ascent?: number
      descent?: number
      segments?: Array<{ steps?: Array<{ instruction?: string }> }>
    }
  }>
}

/**
 * Build map geometry + elevation profile from ORS GeoJSON coordinates.
 * Prefer /geojson over encoded polyline: with elevation=true the polyline is 3D
 * and a 2D decoder produces garbage scribbles on the map.
 */
export function geometryFromOrsCoordinates(
  raw: Array<[number, number] | [number, number, number]>,
): { coordinates: [number, number][]; profile: ElevationPoint[] } {
  const coordinates: [number, number][] = []
  const profile: ElevationPoint[] = []
  let distance = 0

  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i]
    const lng = row[0]
    const lat = row[1]
    const elev = row.length > 2 ? row[2] : 0
    coordinates.push([lng, lat])

    if (i > 0) {
      const prev = raw[i - 1]
      const R = 6371000
      const dLat = ((lat - prev[1]) * Math.PI) / 180
      const dLng = ((lng - prev[0]) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((prev[1] * Math.PI) / 180) *
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

    const primaryProfile = mapBikeProfile(request.bikeType)
    const profiles = [primaryProfile, ...profileFallbacks(primaryProfile)]
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

    let lastMaintenance: string | undefined

    try {
      for (let i = 0; i < profiles.length; i += 1) {
        const profile = profiles[i]
        // Use GeoJSON so elevation-enabled coordinates stay [lng, lat, ele].
        const url = `${this.baseUrl}/v2/directions/${profile}/geojson`
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
          console.error('[ORS]', profile, response.status, text.slice(0, 500))
          if (response.status === 404 || text.toLowerCase().includes('could not find routable')) {
            throw new RoutingError('No route found for preferences', 'no_route')
          }
          if (isOrsMaintenanceResponse(response.status, text)) {
            lastMaintenance = profile
            const next = profiles[i + 1]
            if (next) {
              console.warn(`[ORS] profile ${profile} unavailable; retrying with ${next}`)
              continue
            }
            throw new RoutingError(
              `OpenRouteService profile ${profile} is temporarily unavailable (maintenance)`,
              'provider_error',
              text,
            )
          }
          throw new RoutingError('Provider error', 'provider_error', text)
        }

        const data = (await response.json()) as OrsGeoJsonResponse
        const feature = data.features?.[0]
        const rawCoords = feature?.geometry?.coordinates
        if (!rawCoords || rawCoords.length < 2) {
          throw new RoutingError('No route found for preferences', 'no_route')
        }

        if (lastMaintenance && profile !== primaryProfile) {
          console.info(
            `[ORS] used fallback profile ${profile} because ${primaryProfile} was in maintenance`,
          )
        }

        const { coordinates: coords, profile: elevationProfile } =
          geometryFromOrsCoordinates(rawCoords)
        const summary = feature?.properties?.summary
        const distanceMeters = summary?.distance ?? 0
        const durationSeconds = summary?.duration ? Math.round(summary.duration) : undefined

        let stats = buildStatsFromProfile(
          distanceMeters,
          elevationProfile,
          request.bikeType,
          durationSeconds,
        )

        const ascent = feature?.properties?.ascent ?? summary?.ascent
        const descent = feature?.properties?.descent ?? summary?.descent
        if (typeof ascent === 'number') {
          stats = { ...stats, elevationGainMeters: Math.round(ascent) }
        }
        if (typeof descent === 'number') {
          stats = { ...stats, elevationLossMeters: Math.round(descent) }
        }

        const rawInstructions =
          feature?.properties?.segments?.flatMap(
            (seg) => seg.steps?.map((s) => s.instruction ?? '').filter(Boolean) ?? [],
          ) ?? []

        return {
          geometry: { type: 'LineString', coordinates: coords },
          elevationProfile,
          stats,
          provider: this.name,
          rawInstructions,
        }
      }

      throw new RoutingError(
        'OpenRouteService is temporarily unavailable (maintenance)',
        'provider_error',
        lastMaintenance,
      )
    } catch (error) {
      if (error instanceof RoutingError) throw error
      console.error('[ORS] network', error)
      throw new RoutingError('Network error talking to routing provider', 'network', error)
    }
  }
}
