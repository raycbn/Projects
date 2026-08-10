import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'
import type {
  ElevationPoint,
  RoutingRequest,
  RoutingResult,
} from '@/domain/types'
import { RoutingError } from '@/domain/types'
import { getValhallaCosting } from '@/lib/bikeValhallaProfile'
import { buildStatsFromProfile, normalizeCyclingElevationProfile } from '@/lib/stats'
import { decodePolyline } from '@/lib/valhallaPolyline'
import { surfaceStatsFromValhallaEdges, type ValhallaEdgeAttr } from '@/lib/valhallaSurfaces'

type ValhallaTripResponse = {
  trip?: {
    legs?: Array<{
      shape?: string
      summary?: { length?: number; time?: number }
      maneuvers?: Array<{ instruction?: string }>
    }>
    summary?: { length?: number; time?: number }
  }
  alternates?: Array<{ trip?: ValhallaTripResponse['trip'] }>
  error?: string
  error_code?: number
}

type TraceAttributesResponse = {
  edges?: ValhallaEdgeAttr[]
  error?: string
}

type HeightResponse = {
  range_height?: Array<[number, number]>
  height?: number[]
  error?: string
}

function resolveProxyUrl(): string | undefined {
  const proxy =
    import.meta.env.VITE_PEDALMAP_API_URL || import.meta.env.VITE_ROUTING_PROXY_URL
  if (typeof proxy !== 'string' || !proxy.trim()) return undefined
  return proxy.trim().replace(/\/+$/, '')
}

function resolveDirectValhallaUrl(): string | undefined {
  const url = import.meta.env.VITE_VALHALLA_URL
  if (typeof url === 'string' && url.trim()) return url.trim().replace(/\/+$/, '')
  return undefined
}

/**
 * Valhalla bicycle routing with native surface-aware costing.
 * Prefer Worker proxy (keys / upstream URL stay server-side).
 */
export class ValhallaProvider implements RoutingProvider {
  readonly name = 'valhalla'
  private readonly baseUrl: string
  private readonly viaProxy: boolean

  constructor(baseUrl?: string) {
    const proxy = resolveProxyUrl()
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/+$/, '')
      this.viaProxy = false
    } else if (proxy) {
      this.baseUrl = proxy
      this.viaProxy = true
    } else {
      const direct = resolveDirectValhallaUrl()
      this.baseUrl = (direct ?? '').replace(/\/+$/, '')
      this.viaProxy = false
    }
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl)
  }

  async calculateRoute(request: RoutingRequest): Promise<RoutingResult> {
    if (!this.isConfigured()) {
      throw new RoutingError('Valhalla provider is not configured', 'not_configured')
    }
    if (request.routeType === 'circular') {
      throw new RoutingError(
        'Valhalla provider does not handle circular round_trip; use composite/ORS',
        'invalid_request',
      )
    }

    const waypoints =
      request.routeType === 'out_and_back'
        ? [...request.waypoints, request.waypoints[0]]
        : request.waypoints

    if (waypoints.length < 2) {
      throw new RoutingError('At least two waypoints are required', 'invalid_request')
    }

    const costing = getValhallaCosting(request.bikeType, request.preferences)
    const locations = waypoints.map((w) => ({ lat: w.lat, lon: w.lng, type: 'break' as const }))

    const routeBody: Record<string, unknown> = {
      locations,
      costing: 'bicycle',
      costing_options: { bicycle: costing },
      directions_options: {
        units: 'kilometers',
        language: request.language === 'en' ? 'en-US' : 'es-ES',
      },
    }

    const routeJson = await this.postJson<ValhallaTripResponse>(
      this.viaProxy ? '/valhalla/route' : '/route',
      routeBody,
    )

    if (routeJson.error || !routeJson.trip?.legs?.[0]?.shape) {
      throw new RoutingError(
        routeJson.error || 'No route found',
        'no_route',
        routeJson,
      )
    }

    const trips = [
      routeJson.trip,
      ...(routeJson.alternates?.map((a) => a.trip).filter(Boolean) ?? []),
    ]

    const scored = await Promise.all(
      trips.map(async (trip) => {
        const leg = trip!.legs![0]
        const coords = decodePolyline(leg.shape!)
        if (coords.length < 2) {
          throw new RoutingError('Invalid Valhalla geometry', 'provider_error')
        }

        const [surfaceStats, elevationProfile] = await Promise.all([
          this.fetchSurfaceStats(request.bikeType, leg.shape!),
          this.fetchElevationProfile(coords),
        ])

        const distanceMeters =
          (leg.summary?.length ?? trip!.summary?.length ?? 0) * 1000 ||
          pathLengthMeters(coords)
        const durationSeconds = Math.round(leg.summary?.time ?? trip!.summary?.time ?? 0)
        const stats = buildStatsFromProfile(
          distanceMeters,
          elevationProfile,
          request.bikeType,
          durationSeconds,
        )
        stats.surfaceStats = surfaceStats

        const rawInstructions =
          leg.maneuvers?.map((m) => m.instruction ?? '').filter(Boolean) ?? []

        return {
          geometry: { type: 'LineString' as const, coordinates: coords },
          elevationProfile,
          stats,
          rawInstructions,
          suit: surfaceStats.suitability?.score ?? 0,
        }
      }),
    )

    scored.sort((a, b) => b.suit - a.suit)
    const best = scored[0]
    const alternatives =
      scored.length > 1
        ? scored.slice(1).map((s) => ({
            geometry: s.geometry,
            elevationProfile: s.elevationProfile,
            stats: s.stats,
          }))
        : undefined

    return {
      geometry: best.geometry,
      elevationProfile: best.elevationProfile,
      stats: best.stats,
      provider: this.name,
      rawInstructions: best.rawInstructions,
      alternatives,
    }
  }

  private async fetchSurfaceStats(bikeType: RoutingRequest['bikeType'], encodedShape: string) {
    try {
      const attrs = await this.postJson<TraceAttributesResponse>(
        this.viaProxy ? '/valhalla/trace_attributes' : '/trace_attributes',
        {
          encoded_polyline: encodedShape,
          shape_match: 'edge_walk',
          costing: 'bicycle',
          filters: {
            action: 'include',
            attributes: [
              'edge.length',
              'edge.surface',
              'edge.road_class',
              'edge.use',
              'edge.cycle_lane',
              'edge.bicycle_network',
            ],
          },
        },
      )
      return surfaceStatsFromValhallaEdges(bikeType, attrs.edges ?? [])
    } catch (error) {
      console.warn('[valhalla] trace_attributes failed', error)
      return surfaceStatsFromValhallaEdges(bikeType, [])
    }
  }

  private async fetchElevationProfile(coords: [number, number][]): Promise<ElevationPoint[]> {
    // Densify ~every 80–120 m for a usable DEM profile without huge payloads.
    const sampled = sampleCoords(coords, 90)
    try {
      const height = await this.postJson<HeightResponse>(
        this.viaProxy ? '/valhalla/height' : '/height',
        {
          range: true,
          shape: sampled.map(([lng, lat]) => ({ lat, lon: lng })),
        },
      )
      const pairs = height.range_height
      if (!pairs?.length) {
        return normalizeCyclingElevationProfile(
          sampled.map((c, i) => ({
            distanceMeters: (i / Math.max(1, sampled.length - 1)) * pathLengthMeters(coords),
            elevationMeters: 0,
            position: { lng: c[0], lat: c[1] },
          })),
        )
      }
      const profile: ElevationPoint[] = pairs.map(([rangeM, elev], i) => {
        const c = sampled[Math.min(i, sampled.length - 1)]
        return {
          distanceMeters: rangeM,
          elevationMeters: elev,
          position: { lng: c[0], lat: c[1] },
        }
      })
      return normalizeCyclingElevationProfile(profile)
    } catch (error) {
      console.warn('[valhalla] height failed', error)
      return normalizeCyclingElevationProfile(
        sampled.map((c, i) => ({
          distanceMeters: (i / Math.max(1, sampled.length - 1)) * pathLengthMeters(coords),
          elevationMeters: 600,
          position: { lng: c[0], lat: c[1] },
        })),
      )
    }
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (error) {
      throw new RoutingError('Network error talking to Valhalla', 'network', error)
    }

    const text = await response.text()
    if (!response.ok) {
      console.error('[valhalla]', path, response.status, text.slice(0, 400))
      if (response.status === 429) {
        throw new RoutingError('Rate limit exceeded', 'rate_limited', text)
      }
      throw new RoutingError('Valhalla provider error', 'provider_error', text)
    }

    try {
      return JSON.parse(text) as T
    } catch (error) {
      throw new RoutingError('Valhalla returned invalid JSON', 'provider_error', error)
    }
  }
}

function pathLengthMeters(coords: [number, number][]): number {
  let total = 0
  for (let i = 1; i < coords.length; i += 1) {
    total += haversine(coords[i - 1], coords[i])
  }
  return total
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function sampleCoords(coords: [number, number][], stepMeters: number): [number, number][] {
  if (coords.length <= 2) return coords
  const out: [number, number][] = [coords[0]]
  let acc = 0
  for (let i = 1; i < coords.length; i += 1) {
    acc += haversine(coords[i - 1], coords[i])
    if (acc >= stepMeters) {
      out.push(coords[i])
      acc = 0
    }
  }
  const last = coords[coords.length - 1]
  const prev = out[out.length - 1]
  if (prev[0] !== last[0] || prev[1] !== last[1]) out.push(last)
  return out.slice(0, 180) // cap payload size
}
