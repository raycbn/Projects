import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'
import type {
  BikeType,
  ElevationPoint,
  LatLng,
  RoutePreference,
  RoutingRequest,
  RoutingResult,
  RouteStats,
} from '@/domain/types'
import { RoutingError } from '@/domain/types'
import { buildStatsFromProfile } from '@/lib/stats'
import {
  surfaceStatsFromOrsExtras,
  waytypeBreakdownFromOrsExtras,
  type OrsExtras,
} from '@/lib/orsExtras'

/**
 * Recommended HeiGIT base URL (api.openrouteservice.org is deprecated; shut-off 2026-08-24).
 * No trailing slash.
 */
export const ORS_BASE = 'https://api.heigit.org/openrouteservice'

/** @deprecated Use ORS_BASE. Kept only for migration notes/tests. */
export const ORS_LEGACY_BASE = 'https://api.openrouteservice.org'

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
  'avoid_primary_roads',
]

function buildOptions(preferences: RoutePreference[], routeType: RoutingRequest['routeType'], circularDistanceMeters?: number) {
  const avoid_features: string[] = ['steps']
  if (preferences.includes('avoid_primary_roads')) {
    avoid_features.push('highways')
  }

  const profile_params: Record<string, unknown> = {}
  if (preferences.includes('prefer_less_elevation')) {
    profile_params.weightings = { steepness_difficulty: 0 }
  }

  const options: Record<string, unknown> = {
    avoid_features,
    profile_params: Object.keys(profile_params).length ? profile_params : undefined,
  }

  if (routeType === 'circular' && circularDistanceMeters) {
    options.round_trip = {
      length: Math.round(circularDistanceMeters),
      points: 5,
    }
  }

  return options
}

function preferenceMode(preferences: RoutePreference[]): 'recommended' | 'shortest' | 'fastest' {
  if (preferences.includes('prefer_shorter')) return 'shortest'
  if (preferences.includes('prefer_faster')) return 'fastest'
  return 'recommended'
}

type OrsGeoJsonFeature = {
  geometry?: {
    type?: string
    coordinates?: Array<[number, number] | [number, number, number]>
  }
  properties?: {
    summary?: { distance?: number; duration?: number; ascent?: number; descent?: number }
    ascent?: number
    descent?: number
    segments?: Array<{ steps?: Array<{ instruction?: string }> }>
    extras?: OrsExtras
  }
}

type OrsGeoJsonResponse = {
  features?: OrsGeoJsonFeature[]
}

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

function featureToPartialResult(
  feature: OrsGeoJsonFeature,
  bikeType: BikeType,
): {
  geometry: RoutingResult['geometry']
  elevationProfile: ElevationPoint[]
  stats: RouteStats
  rawInstructions: string[]
} {
  const rawCoords = feature.geometry?.coordinates
  if (!rawCoords || rawCoords.length < 2) {
    throw new RoutingError('No route found for preferences', 'no_route')
  }

  const { coordinates: coords, profile: elevationProfile } = geometryFromOrsCoordinates(rawCoords)
  const summary = feature.properties?.summary
  const distanceMeters = summary?.distance ?? 0
  const durationSeconds = summary?.duration ? Math.round(summary.duration) : undefined

  let stats = buildStatsFromProfile(
    distanceMeters,
    elevationProfile,
    bikeType,
    durationSeconds,
  )

  const ascent = feature.properties?.ascent ?? summary?.ascent
  const descent = feature.properties?.descent ?? summary?.descent
  if (typeof ascent === 'number') {
    stats = { ...stats, elevationGainMeters: Math.round(ascent) }
  }
  if (typeof descent === 'number') {
    stats = { ...stats, elevationLossMeters: Math.round(descent) }
  }

  const surfaceStats = surfaceStatsFromOrsExtras(feature.properties?.extras)
  const waytypes = waytypeBreakdownFromOrsExtras(feature.properties?.extras)
  if (surfaceStats || waytypes) {
    stats = {
      ...stats,
      surfaceStats: {
        ...surfaceStats,
        waytypes,
      },
    }
  }

  const rawInstructions =
    feature.properties?.segments?.flatMap(
      (seg) => seg.steps?.map((s) => s.instruction ?? '').filter(Boolean) ?? [],
    ) ?? []

  return {
    geometry: { type: 'LineString', coordinates: coords },
    elevationProfile,
    stats,
    rawInstructions,
  }
}

function resolveApiKey(): string | undefined {
  const key = import.meta.env.VITE_ORS_API_KEY || import.meta.env.VITE_ROUTING_API_KEY
  return typeof key === 'string' && key.trim() ? key.trim() : undefined
}

export class OpenRouteServiceProvider implements RoutingProvider {
  readonly name = 'openrouteservice'
  private readonly apiKey: string | undefined
  private readonly baseUrl: string

  constructor(
    apiKey: string | undefined = resolveApiKey(),
    baseUrl: string = (import.meta.env.VITE_ROUTING_PROXY_URL as string | undefined) || ORS_BASE,
  ) {
    this.apiKey = apiKey
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

    const waypoints: LatLng[] =
      request.routeType === 'out_and_back'
        ? [...request.waypoints, request.waypoints[0]]
        : request.waypoints

    if (request.routeType === 'circular') {
      if (waypoints.length < 1) {
        throw new RoutingError('Circular routes require a start point', 'invalid_request')
      }
      if (!request.circularDistanceMeters) {
        throw new RoutingError('Circular routes require a target distance', 'invalid_request')
      }
    } else if (waypoints.length < 2) {
      throw new RoutingError('At least two waypoints are required', 'invalid_request')
    }

    const primaryProfile = mapBikeProfile(request.bikeType)
    const profiles = [primaryProfile, ...profileFallbacks(primaryProfile)]
    const coordinates =
      request.routeType === 'circular'
        ? [[waypoints[0].lng, waypoints[0].lat]]
        : waypoints.map((w) => [w.lng, w.lat])

    const body: Record<string, unknown> = {
      coordinates,
      elevation: true,
      instructions: true,
      language: request.language ?? 'es',
      preference: preferenceMode(request.preferences),
      extra_info: ['surface', 'waytype'],
      options: buildOptions(
        request.preferences,
        request.routeType,
        request.circularDistanceMeters,
      ),
    }

    if (request.wantAlternatives && request.routeType === 'a_to_b') {
      body.alternative_routes = {
        target_count: 2,
        share_factor: 0.6,
        weight_factor: 1.4,
      }
    }

    let lastMaintenance: string | undefined

    try {
      for (let i = 0; i < profiles.length; i += 1) {
        const profile = profiles[i]
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
        const features = data.features ?? []
        if (!features.length) {
          throw new RoutingError('No route found for preferences', 'no_route')
        }

        if (lastMaintenance && profile !== primaryProfile) {
          console.info(
            `[ORS] used fallback profile ${profile} because ${primaryProfile} was in maintenance`,
          )
        }

        const primary = featureToPartialResult(features[0], request.bikeType)
        const alternatives =
          features.length > 1
            ? features.slice(1).map((feature) => {
                const partial = featureToPartialResult(feature, request.bikeType)
                return {
                  geometry: partial.geometry,
                  elevationProfile: partial.elevationProfile,
                  stats: partial.stats,
                }
              })
            : undefined

        return {
          geometry: primary.geometry,
          elevationProfile: primary.elevationProfile,
          stats: primary.stats,
          provider: this.name,
          rawInstructions: primary.rawInstructions,
          alternatives,
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
