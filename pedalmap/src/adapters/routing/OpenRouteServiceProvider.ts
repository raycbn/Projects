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
import { buildStatsFromProfile, normalizeCyclingElevationProfile } from '@/lib/stats'
import {
  surfaceStatsFromOrsExtras,
  waytypeBreakdownFromOrsExtras,
  type OrsExtras,
} from '@/lib/orsExtras'
import {
  buildOrsOptionsFromStrategy,
  getBikeModality,
  primaryOrsProfile,
  resolveRoutingStrategies,
  scoreSurfaceSuitability,
  type RoutingStrategy,
} from '@/lib/bikeSurfaceProfile'

/**
 * Recommended HeiGIT base URL (api.openrouteservice.org is deprecated; shut-off 2026-08-24).
 * No trailing slash.
 */
export const ORS_BASE = 'https://api.heigit.org/openrouteservice'

/** @deprecated Use ORS_BASE. Kept only for migration notes/tests. */
export const ORS_LEGACY_BASE = 'https://api.openrouteservice.org'

export function mapBikeProfile(
  bikeType: BikeType,
  preferences: RoutePreference[] = [],
): string {
  return primaryOrsProfile(bikeType, preferences)
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

/**
 * Preferences with a real ORS cycling effect (options and/or profile choice).
 * Note: `avoid_features: highways` is driving-only and returns 400 on cycling-*.
 * Secondary / primary prefs map to ORS `green` weighting (real soft bias).
 */
export const ORS_SUPPORTED_PREFERENCES: RoutePreference[] = [
  'prefer_shorter',
  'prefer_faster',
  'prefer_less_elevation',
  'avoid_unpaved',
  'prefer_unpaved',
  'prefer_bike_lanes',
  'avoid_traffic',
  'prefer_secondary_roads',
  'avoid_primary_roads',
]

/** @deprecated Prefer buildOrsOptionsFromStrategy — kept for tests/compat. */
export function buildOptions(
  preferences: RoutePreference[],
  routeType: RoutingRequest['routeType'],
  circularDistanceMeters?: number,
  circularSeed?: number,
  bikeType: BikeType = 'road',
) {
  const strategy = resolveRoutingStrategies(bikeType, preferences)[0]
  return buildOrsOptionsFromStrategy(
    strategy,
    routeType,
    circularDistanceMeters,
    circularSeed,
  )
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
    // Never invent sea-level 0 when Z is missing — sanitize interpolates NaN.
    const elev =
      row.length > 2 && Number.isFinite(row[2] as number) ? Number(row[2]) : Number.NaN
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
      elevationMeters: elev,
      position: { lat, lng },
    })
  }

  return { coordinates, profile: normalizeCyclingElevationProfile(profile) }
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
  const ascent = feature.properties?.ascent ?? summary?.ascent
  const descent = feature.properties?.descent ?? summary?.descent

  // Elevation gain is profile-agnostic (same for road/mtb/gravel/urban/ebike).
  let stats = buildStatsFromProfile(
    distanceMeters,
    elevationProfile,
    bikeType,
    durationSeconds,
    typeof ascent === 'number' ? ascent : undefined,
    typeof descent === 'number' ? descent : undefined,
  )

  const surfaceStats = surfaceStatsFromOrsExtras(feature.properties?.extras)
  const waytypes = waytypeBreakdownFromOrsExtras(feature.properties?.extras)
  if (surfaceStats || waytypes) {
    const merged = {
      ...surfaceStats,
      waytypes,
    }
    const suitability = scoreSurfaceSuitability(bikeType, merged)
    stats = {
      ...stats,
      surfaceStats: {
        ...merged,
        suitability,
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
  // Direct browser ORS key is opt-in only (dev emergency). Prefer Cloudflare Worker proxy.
  const allowDirect =
    String(import.meta.env.VITE_ALLOW_DIRECT_ORS || '').toLowerCase() === 'true'
  if (!allowDirect) return undefined
  const key = import.meta.env.VITE_ORS_API_KEY || import.meta.env.VITE_ROUTING_API_KEY
  return typeof key === 'string' && key.trim() ? key.trim() : undefined
}

function resolveProxyUrl(): string | undefined {
  const proxy =
    import.meta.env.VITE_PEDALMAP_API_URL || import.meta.env.VITE_ROUTING_PROXY_URL
  const useProxy =
    String(import.meta.env.VITE_USE_ROUTING_PROXY || '').toLowerCase() === 'true' ||
    Boolean(proxy && String(import.meta.env.VITE_ALLOW_DIRECT_ORS || '').toLowerCase() !== 'true')
  if (!useProxy || typeof proxy !== 'string' || !proxy.trim()) return undefined
  return proxy.trim().replace(/\/+$/, '')
}

export class OpenRouteServiceProvider implements RoutingProvider {
  readonly name = 'openrouteservice'
  private readonly apiKey: string | undefined
  private readonly baseUrl: string
  private readonly viaProxy: boolean

  constructor(
    apiKey: string | undefined = resolveApiKey(),
    baseUrl?: string,
  ) {
    const proxy = resolveProxyUrl()
    this.viaProxy = Boolean(proxy)
    this.apiKey = this.viaProxy ? undefined : apiKey
    this.baseUrl = (baseUrl ?? proxy ?? ORS_BASE).replace(/\/+$/, '')
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey) || this.viaProxy || Boolean(resolveProxyUrl())
  }

  async calculateRoute(request: RoutingRequest): Promise<RoutingResult> {
    if (!this.isConfigured()) {
      throw new RoutingError(
        'Routing provider is not configured. Deploy the Cloudflare Worker proxy (VITE_PEDALMAP_API_URL) or set VITE_ALLOW_DIRECT_ORS=true for local emergency only.',
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

    const strategies = resolveRoutingStrategies(request.bikeType, request.preferences)
    const coordinates =
      request.routeType === 'circular'
        ? [[waypoints[0].lng, waypoints[0].lat]]
        : waypoints.map((w) => [w.lng, w.lat])

    const targetElev = request.targetElevationGainMeters
    const seeds =
      request.routeType === 'circular' && targetElev && targetElev > 0
        ? Array.from({ length: 5 }, (_, i) => i)
        : [request.circularSeed ?? 0]

    // For A→B / out-and-back: try modality strategies until surface fit is good enough.
    // Cap extra ORS calls to keep free-tier / latency reasonable.
    const maxSurfaceAttempts =
      request.routeType === 'circular' ? 1 : Math.min(3, strategies.length)

    let lastMaintenance: string | undefined
    let bestElev: RoutingResult | undefined
    let bestElevScore = Number.POSITIVE_INFINITY
    let bestSurface: RoutingResult | undefined
    let bestSurfaceScore = -1

    try {
      for (const seed of seeds) {
        for (let si = 0; si < maxSurfaceAttempts; si += 1) {
          const strategy: RoutingStrategy = strategies[si]
          const profiles = [strategy.profile, ...profileFallbacks(strategy.profile)].filter(
            (p, idx, arr) => arr.indexOf(p) === idx,
          )

          const body: Record<string, unknown> = {
            coordinates,
            elevation: true,
            instructions: true,
            language: request.language ?? 'es',
            preference: strategy.preferenceMode ?? preferenceMode(request.preferences),
            extra_info: ['surface', 'waytype'],
            options: buildOrsOptionsFromStrategy(
              strategy,
              request.routeType,
              request.circularDistanceMeters,
              request.routeType === 'circular' ? seed : undefined,
            ),
          }

          if (request.wantAlternatives && request.routeType === 'a_to_b' && si === 0) {
            body.alternative_routes = {
              target_count: 2,
              share_factor: 0.6,
              weight_factor: 1.4,
            }
          }

          let gotResult = false
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
                break
              }
              throw new RoutingError('Provider error', 'provider_error', text)
            }

            const data = (await response.json()) as OrsGeoJsonResponse
            const features = data.features ?? []
            if (!features.length) {
              throw new RoutingError('No route found for preferences', 'no_route')
            }

            if (lastMaintenance && profile !== strategy.profile) {
              console.info(
                `[ORS] used fallback profile ${profile} because ${strategy.profile} was in maintenance`,
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

            // Prefer alternative with better surface fit for this bike when present.
            let chosen = primary
            if (alternatives?.length) {
              const pool = [
                primary,
                ...alternatives.map((a) => ({
                  ...a,
                  rawInstructions: primary.rawInstructions,
                })),
              ]
              pool.sort(
                (a, b) =>
                  (b.stats.surfaceStats?.suitability?.score ?? 0) -
                  (a.stats.surfaceStats?.suitability?.score ?? 0),
              )
              chosen = pool[0]
            }

            const candidate: RoutingResult = {
              geometry: chosen.geometry,
              elevationProfile: chosen.elevationProfile,
              stats: chosen.stats,
              provider: this.name,
              rawInstructions: chosen.rawInstructions,
              alternatives,
            }

            const suit = candidate.stats.surfaceStats?.suitability?.score ?? 55
            if (suit > bestSurfaceScore) {
              bestSurfaceScore = suit
              bestSurface = candidate
            }

            if (targetElev && targetElev > 0) {
              const elevDiff = Math.abs(candidate.stats.elevationGainMeters - targetElev)
              const distTarget = request.circularDistanceMeters ?? candidate.stats.distanceMeters
              const distDiff =
                Math.abs(candidate.stats.distanceMeters - distTarget) / Math.max(1, distTarget)
              const score = elevDiff + distDiff * targetElev * 0.25
              if (score < bestElevScore) {
                bestElevScore = score
                bestElev = candidate
              }
              gotResult = true
              if (elevDiff <= Math.max(40, targetElev * 0.12)) {
                return candidate
              }
              break
            }

            gotResult = true
            break
          }

          if (!gotResult && seeds.length === 1 && lastMaintenance && si === maxSurfaceAttempts - 1) {
            throw new RoutingError(
              `OpenRouteService profile ${lastMaintenance} is temporarily unavailable (maintenance)`,
              'provider_error',
              lastMaintenance,
            )
          }

          // After a successful A→B / out-and-back result, stop if surface fit is good enough.
          if (gotResult && !targetElev) {
            const acceptScore = getBikeModality(request.bikeType).acceptScore
            if (bestSurfaceScore >= acceptScore) {
              return bestSurface!
            }
          }
        }

        // Elevation circular: keep searching seeds. Otherwise strategies are exhausted.
        if (!targetElev) break
      }

      if (bestElev) return bestElev
      if (bestSurface) return bestSurface

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
