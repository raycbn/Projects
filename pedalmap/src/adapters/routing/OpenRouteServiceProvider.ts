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
import { routingAuthHeaders } from '@/lib/routingAuth'
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
  if (status === 503) return true
  const lower = body.toLowerCase()
  return (
    lower.includes('down for maintenance') ||
    lower.includes('"maintenance":true') ||
    lower.includes('temporarily unavailable')
  )
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

  async calculateRoute(request: RoutingRequest, externalSignal?: AbortSignal): Promise<RoutingResult> {
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
    /** Soft target: stop searching early once we hit this; never a hard reject. */
    const targetScore = getBikeModality(request.bikeType).acceptScore
    const coordinates =
      request.routeType === 'circular'
        ? [[waypoints[0].lng, waypoints[0].lat]]
        : waypoints.map((w) => [w.lng, w.lat])

    const targetElev = request.targetElevationGainMeters
    // Fallback path only — keep fanout tiny so the UI does not stall.
    const seeds =
      request.routeType === 'circular'
        ? [request.circularSeed ?? 0, (request.circularSeed ?? 0) + 1]
        : [request.circularSeed ?? 0]

    const maxSurfaceAttempts = Math.min(2, strategies.length)

    let lastMaintenance: string | undefined
    const downProfiles = new Set<string>()
    let bestElev: RoutingResult | undefined
    let bestElevCombo = Number.POSITIVE_INFINITY
    let bestSurface: RoutingResult | undefined
    let bestSurfaceScore = -1
    let anyOkResponse = false

    try {
      for (const seed of seeds) {
        for (let si = 0; si < maxSurfaceAttempts; si += 1) {
          const strategy: RoutingStrategy = strategies[si]
          const profiles = [strategy.profile, ...profileFallbacks(strategy.profile)].filter(
            (p, idx, arr) => arr.indexOf(p) === idx && !downProfiles.has(p),
          )
          if (!profiles.length) continue

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

          // Ask for alternate geometries so we can pick the one that best matches the bike.
          const tryBodies: Record<string, unknown>[] = [{ ...body }]
          if (
            (request.routeType === 'a_to_b' || request.routeType === 'out_and_back') &&
            request.wantAlternatives &&
            si === 0
          ) {
            tryBodies.unshift({
              ...body,
              alternative_routes: {
                target_count: 3,
                share_factor: 0.55,
                weight_factor: 1.6,
              },
            })
          }

          let gotResult = false
          profileLoop: for (let i = 0; i < profiles.length; i += 1) {
            const profile = profiles[i]
            const url = `${this.baseUrl}/v2/directions/${profile}/geojson`

            for (let bi = 0; bi < tryBodies.length; bi += 1) {
              let response: Response
              // Timeout: 10 seconds per ORS attempt, combined with external signal
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 10000)

              const abortHandler = () => controller.abort()
              if (externalSignal) {
                if (externalSignal.aborted) {
                  controller.abort()
                } else {
                  externalSignal.addEventListener('abort', abortHandler)
                }
              }

              try {
                response = await fetch(url, {
                  method: 'POST',
                  headers: this.viaProxy
                    ? await routingAuthHeaders({
                        Accept: 'application/json, application/geo+json',
                      })
                    : {
                        'Content-Type': 'application/json',
                        Accept: 'application/json, application/geo+json',
                        ...(this.apiKey ? { Authorization: this.apiKey } : {}),
                      },
                  body: JSON.stringify(tryBodies[bi]),
                  signal: controller.signal,
                })
              } catch (fetchErr) {
                clearTimeout(timeoutId)
                if (externalSignal) {
                  externalSignal.removeEventListener('abort', abortHandler)
                }
                if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
                  console.warn('[ORS] request timeout (10s)', profile)
                  // Soft: try next profile/body before declaring hard network failure
                  if (bi < tryBodies.length - 1) continue
                  if (i < profiles.length - 1) continue profileLoop
                  throw new RoutingError('ORS request timeout (10s)', 'network', fetchErr)
                }
                console.error('[ORS] fetch failed', profile, fetchErr)
                // Soft: try next profile/body before declaring hard network failure
                if (bi < tryBodies.length - 1) continue
                if (i < profiles.length - 1) continue profileLoop
                throw new RoutingError(
                  'Network error talking to routing provider',
                  'network',
                  fetchErr,
                )
              } finally {
                clearTimeout(timeoutId)
                if (externalSignal) {
                  externalSignal.removeEventListener('abort', abortHandler)
                }
              }

              if (response.status === 429) {
                throw new RoutingError('Rate limit exceeded', 'rate_limited')
              }

              if (!response.ok) {
                const text = await response.text()
                console.error('[ORS]', profile, response.status, text.slice(0, 500))
                if (response.status === 404 || text.toLowerCase().includes('could not find routable')) {
                  break profileLoop
                }
                if (isOrsMaintenanceResponse(response.status, text)) {
                  lastMaintenance = profile
                  downProfiles.add(profile)
                  const next = profiles[i + 1]
                  if (next) {
                    console.warn(`[ORS] profile ${profile} unavailable; retrying with ${next}`)
                    continue profileLoop
                  }
                  break profileLoop
                }
                // Alternatives sometimes rejected — try next body variant
                if (bi < tryBodies.length - 1) continue
                // 502 from worker = upstream blip; try next profile
                if (response.status === 502 && i < profiles.length - 1) {
                  continue profileLoop
                }
                throw new RoutingError('Provider error', 'provider_error', text)
              }

              anyOkResponse = true
              let data: OrsGeoJsonResponse
              try {
                data = (await response.json()) as OrsGeoJsonResponse
              } catch (parseErr) {
                console.error('[ORS] bad JSON', profile, parseErr)
                if (bi < tryBodies.length - 1) continue
                continue profileLoop
              }
              const features = data.features ?? []
              if (!features.length) {
                if (bi < tryBodies.length - 1) continue
                break profileLoop
              }

              if (lastMaintenance && profile !== strategy.profile) {
                console.info(
                  `[ORS] used fallback profile ${profile} because ${strategy.profile} was in maintenance`,
                )
              }

              const featurePartials = features.map((feature) =>
                featureToPartialResult(feature, request.bikeType),
              )

              // Score every geometry; keep the best surface fit active, retain all as alternatives.
              const pool = [...featurePartials].sort(
                (a, b) =>
                  (b.stats.surfaceStats?.suitability?.score ?? 0) -
                  (a.stats.surfaceStats?.suitability?.score ?? 0),
              )
              const chosen = pool[0]
              const alternatives =
                pool.length > 1
                  ? pool.slice(1).map((partial) => ({
                      geometry: partial.geometry,
                      elevationProfile: partial.elevationProfile,
                      stats: partial.stats,
                      rawInstructions: partial.rawInstructions,
                    }))
                  : undefined

              const candidate: RoutingResult = {
                geometry: chosen.geometry,
                elevationProfile: chosen.elevationProfile,
                stats: chosen.stats,
                provider: this.name,
                rawInstructions: chosen.rawInstructions,
                alternatives,
              }

              const suit = candidate.stats.surfaceStats?.suitability?.score ?? 0
              if (suit > bestSurfaceScore) {
                bestSurfaceScore = suit
                bestSurface = candidate
              }

              if (targetElev && targetElev > 0) {
                // Prefer bike surface first; among those, closest elevation target.
                const elevDiff = Math.abs(candidate.stats.elevationGainMeters - targetElev)
                const distTarget = request.circularDistanceMeters ?? candidate.stats.distanceMeters
                const distDiff =
                  Math.abs(candidate.stats.distanceMeters - distTarget) / Math.max(1, distTarget)
                const combo =
                  (100 - suit) * 12 + elevDiff + distDiff * Math.max(40, targetElev) * 0.2
                if (combo < bestElevCombo) {
                  bestElevCombo = combo
                  bestElev = candidate
                }
                gotResult = true
                if (suit >= targetScore && elevDiff <= Math.max(40, targetElev * 0.12)) {
                  return candidate
                }
                break profileLoop
              }

              gotResult = true
              break profileLoop
            }
          }

          // Good enough for this bike profile — no need to burn more ORS quota.
          if (gotResult && bestSurfaceScore >= targetScore && !targetElev) {
            return bestSurface!
          }
        }

        if (bestSurfaceScore >= targetScore && !targetElev) {
          return bestSurface!
        }
        if (request.routeType !== 'circular') break
      }

      // Always return the best bike-fit route we found (elevation-aware when requested).
      if (targetElev && bestElev) return bestElev
      if (bestSurface) return bestSurface

      if (!anyOkResponse && lastMaintenance) {
        throw new RoutingError(
          `OpenRouteService profile ${lastMaintenance} is temporarily unavailable (maintenance)`,
          'provider_error',
          lastMaintenance,
        )
      }

      throw new RoutingError(
        anyOkResponse
          ? 'No route found for preferences'
          : 'OpenRouteService is temporarily unavailable (maintenance)',
        anyOkResponse ? 'no_route' : 'provider_error',
        lastMaintenance,
      )
    } catch (error) {
      if (error instanceof RoutingError) throw error
      console.error('[ORS] network', error)
      throw new RoutingError('Network error talking to routing provider', 'network', error)
    }
  }
}
