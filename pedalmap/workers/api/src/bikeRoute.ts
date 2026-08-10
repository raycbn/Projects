import type { Env } from './types'
import { json } from './types'

const DEFAULT_VALHALLA = 'https://valhalla1.openstreetmap.de'
const USER_AGENT = 'PedalMap/1.0 (+https://pedalmap-79b3a.web.app; bike routing)'

type BikeType = 'road' | 'mtb' | 'gravel' | 'urban' | 'ebike'
type RouteType = 'a_to_b' | 'out_and_back' | 'circular'

interface LatLng {
  lat: number
  lng: number
}

interface BikeRouteRequest {
  bikeType: BikeType
  preferences?: string[]
  routeType: RouteType
  waypoints: LatLng[]
  circularDistanceMeters?: number
  targetElevationGainMeters?: number
  language?: string
  circularSeed?: number
}

type ValhallaAction = 'route' | 'trace_attributes' | 'height'

function resolveUpstream(env: Env, action: ValhallaAction): { url: string; headers: HeadersInit } {
  if (env.STADIA_API_KEY) {
    const path =
      action === 'route'
        ? '/route/v1'
        : action === 'trace_attributes'
          ? '/trace_attributes/v1'
          : '/height/v1'
    return {
      url: `https://api.stadiamaps.com${path}?api_key=${encodeURIComponent(env.STADIA_API_KEY)}`,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    }
  }
  const base = (env.VALHALLA_URL || DEFAULT_VALHALLA).replace(/\/+$/, '')
  return {
    url: `${base}/${action}`,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  }
}

async function valhallaPost(env: Env, action: ValhallaAction, body: unknown): Promise<unknown> {
  const upstream = resolveUpstream(env, action)
  const res = await fetch(upstream.url, {
    method: 'POST',
    headers: upstream.headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Valhalla ${action} ${res.status}: ${text.slice(0, 240)}`)
  }
  return JSON.parse(text)
}

function bicycleCosting(bikeType: BikeType, preferences: string[] = []) {
  const base: Record<string, number | string> = (() => {
    switch (bikeType) {
      case 'road':
        return {
          bicycle_type: 'Road',
          avoid_bad_surfaces: 1,
          use_roads: 0.55,
          use_hills: 0.12,
          use_ferry: 0.1,
          cycling_speed: 25,
        }
      case 'urban':
        return {
          bicycle_type: 'Hybrid',
          avoid_bad_surfaces: 0.92,
          use_roads: 0.5,
          use_hills: 0.18,
          use_ferry: 0.15,
          cycling_speed: 18,
        }
      case 'ebike':
        return {
          bicycle_type: 'Hybrid',
          avoid_bad_surfaces: 0.88,
          use_roads: 0.55,
          use_hills: 0.45,
          use_ferry: 0.2,
          cycling_speed: 22,
        }
      case 'gravel':
        return {
          bicycle_type: 'Cross',
          avoid_bad_surfaces: 0.28,
          use_roads: 0.32,
          use_hills: 0.42,
          use_ferry: 0.15,
          cycling_speed: 20,
        }
      case 'mtb':
      default:
        return {
          bicycle_type: 'Mountain',
          avoid_bad_surfaces: 0.05,
          use_roads: 0.18,
          use_hills: 0.62,
          use_ferry: 0.1,
          cycling_speed: 16,
        }
    }
  })()

  if (preferences.includes('avoid_unpaved')) {
    base.avoid_bad_surfaces = Math.min(1, Math.max(Number(base.avoid_bad_surfaces), 0.95))
    base.use_roads = Math.max(Number(base.use_roads), 0.55)
  }
  if (preferences.includes('prefer_unpaved')) {
    base.bicycle_type = bikeType === 'mtb' ? 'Mountain' : 'Cross'
    base.avoid_bad_surfaces = Math.min(Number(base.avoid_bad_surfaces), 0.2)
    base.use_roads = Math.min(Number(base.use_roads), 0.25)
  }
  if (preferences.includes('prefer_less_elevation')) {
    base.use_hills = Math.min(Number(base.use_hills), 0.1)
  }
  if (preferences.includes('prefer_bike_lanes') || preferences.includes('avoid_primary_roads')) {
    base.use_roads = Math.min(Number(base.use_roads), 0.35)
  }
  if (preferences.includes('prefer_secondary_roads')) {
    base.use_roads = Math.min(Math.max(Number(base.use_roads), 0.35), 0.5)
  }
  if (preferences.includes('avoid_traffic')) {
    base.use_roads = Math.min(Number(base.use_roads), 0.4)
    base.use_ferry = Math.min(Number(base.use_ferry), 0.05)
  }
  return base
}

function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const coordinates: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  const factor = 10 ** precision
  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat
    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng
    coordinates.push([lng / factor, lat / factor])
  }
  return coordinates
}

function offsetLatLng(origin: LatLng, bearingDeg: number, distanceMeters: number): LatLng {
  const R = 6371000
  const br = (bearingDeg * Math.PI) / 180
  const lat1 = (origin.lat * Math.PI) / 180
  const lng1 = (origin.lng * Math.PI) / 180
  const ang = distanceMeters / R
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    )
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI }
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

function sampleCoords(coords: [number, number][], stepMeters: number, maxPoints: number) {
  if (coords.length <= 2) return coords
  const out: [number, number][] = [coords[0]]
  let acc = 0
  for (let i = 1; i < coords.length; i += 1) {
    acc += haversine(coords[i - 1], coords[i])
    if (acc >= stepMeters) {
      out.push(coords[i])
      acc = 0
      if (out.length >= maxPoints - 1) break
    }
  }
  const last = coords[coords.length - 1]
  const prev = out[out.length - 1]
  if (prev[0] !== last[0] || prev[1] !== last[1]) out.push(last)
  return out
}

function mergeLegShapes(legs: Array<{ shape?: string }>): [number, number][] {
  const all: [number, number][] = []
  for (const leg of legs) {
    if (!leg.shape) continue
    const part = decodePolyline(leg.shape)
    if (!part.length) continue
    if (!all.length) {
      all.push(...part)
      continue
    }
    // skip duplicate joint
    all.push(...part.slice(1))
  }
  return all
}

type TripJson = {
  trip?: {
    legs?: Array<{
      shape?: string
      summary?: { length?: number; time?: number }
      maneuvers?: Array<{ instruction?: string }>
    }>
    summary?: { length?: number; time?: number }
  }
  error?: string
}

async function enrichTrip(
  env: Env,
  trip: NonNullable<TripJson['trip']>,
  costing: Record<string, number | string>,
) {
  const legs = trip.legs ?? []
  const coordinates = mergeLegShapes(legs)
  if (coordinates.length < 2) throw new Error('Invalid Valhalla geometry')

  const distanceMeters = Math.round((trip.summary?.length ?? 0) * 1000)
  const durationSeconds = Math.round(trip.summary?.time ?? 0)
  const instructions =
    legs.flatMap((l) => l.maneuvers?.map((m) => m.instruction ?? '').filter(Boolean) ?? []) ?? []

  // Parallel enrich — coarse samples keep latency low
  const sampled = sampleCoords(coordinates, 200, 48)
  const [attrs, height] = await Promise.all([
    valhallaPost(env, 'trace_attributes', {
      shape: sampled.map(([lng, lat]) => ({ lat, lon: lng })),
      shape_match: 'map_snap',
      costing: 'bicycle',
      costing_options: { bicycle: costing },
      filters: {
        action: 'include',
        attributes: [
          'edge.length',
          'edge.surface',
          'edge.road_class',
          'edge.use',
          'edge.cycle_lane',
        ],
      },
    }).catch(() => ({ edges: [] })),
    valhallaPost(env, 'height', {
      range: true,
      shape: sampled.map(([lng, lat]) => ({ lat, lon: lng })),
    }).catch(() => ({ range_height: [] })),
  ])

  const pairs = (height as { range_height?: Array<[number, number]> }).range_height ?? []
  // Never invent elevation — empty profile is better than a fake flat 600 m.
  const elevationProfile = pairs.length
    ? pairs.map(([rangeM, elev], i) => {
        const c = sampled[Math.min(i, sampled.length - 1)]
        return {
          distanceMeters: rangeM,
          elevationMeters: elev,
          position: { lng: c[0], lat: c[1] },
        }
      })
    : []

  return {
    coordinates,
    elevationProfile,
    edges: (attrs as { edges?: unknown[] }).edges ?? [],
    distanceMeters,
    durationSeconds,
    instructions,
  }
}

async function routeLocations(
  env: Env,
  locations: Array<{ lat: number; lon: number; type: string }>,
  costing: Record<string, number | string>,
  language: string,
) {
  const routeJson = (await valhallaPost(env, 'route', {
    locations,
    costing: 'bicycle',
    costing_options: { bicycle: costing },
    directions_options: {
      units: 'kilometers',
      language: language === 'en' ? 'en-US' : 'es-ES',
    },
  })) as TripJson

  if (routeJson.error || !routeJson.trip?.legs?.length) {
    throw new Error(routeJson.error || 'No route found')
  }
  return enrichTrip(env, routeJson.trip, costing)
}

/**
 * Single round-trip from the browser: Valhalla route + surface + elevation.
 * Supports A→B, out-and-back, and Objetivo circular loops.
 */
export async function handleBikeRoute(request: Request, env: Env): Promise<Response> {
  let body: BikeRouteRequest
  try {
    body = (await request.json()) as BikeRouteRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    bikeType = 'road',
    preferences = [],
    routeType = 'a_to_b',
    waypoints = [],
    circularDistanceMeters,
    targetElevationGainMeters,
    language = 'es',
    circularSeed = 0,
  } = body

  if (!Array.isArray(waypoints) || waypoints.length < 1) {
    return json({ error: 'waypoints required' }, 400)
  }

  const costing = bicycleCosting(bikeType, preferences)

  try {
    if (routeType === 'circular') {
      if (!circularDistanceMeters || circularDistanceMeters < 1000) {
        return json({ error: 'circularDistanceMeters required (>=1000)' }, 400)
      }
      const start = waypoints[0]
      // Routed loops are longer than crow-flies; scale vias ~target/5 per leg.
      const attempts = [
        { bearing: (circularSeed * 47) % 360, legFactor: 5.0 },
        { bearing: (circularSeed * 47 + 90) % 360, legFactor: 4.2 },
      ]
      let best: Awaited<ReturnType<typeof routeLocations>> | null = null
      let bestScore = Number.POSITIVE_INFINITY

      for (let i = 0; i < attempts.length; i += 1) {
        const { bearing, legFactor } = attempts[i]
        const leg = circularDistanceMeters / legFactor
        const via1 = offsetLatLng(start, bearing, leg)
        const via2 = offsetLatLng(start, bearing + 120, leg)
        try {
          const candidate = await routeLocations(
            env,
            [
              { lat: start.lat, lon: start.lng, type: 'break' },
              { lat: via1.lat, lon: via1.lng, type: 'break' },
              { lat: via2.lat, lon: via2.lng, type: 'break' },
              { lat: start.lat, lon: start.lng, type: 'break' },
            ],
            costing,
            language,
          )
          const distErr =
            Math.abs(candidate.distanceMeters - circularDistanceMeters) /
            Math.max(1, circularDistanceMeters)
          let elevErr = 0
          if (targetElevationGainMeters && targetElevationGainMeters > 0) {
            let gain = 0
            for (let p = 1; p < candidate.elevationProfile.length; p += 1) {
              const d =
                candidate.elevationProfile[p].elevationMeters -
                candidate.elevationProfile[p - 1].elevationMeters
              if (d > 3) gain += d
            }
            elevErr =
              Math.abs(gain - targetElevationGainMeters) / Math.max(40, targetElevationGainMeters)
          }
          const score = distErr * 100 + elevErr * 40
          if (score < bestScore) {
            bestScore = score
            best = candidate
          }
          if (distErr < 0.2 && elevErr < 0.35) break
        } catch (err) {
          console.warn('[bike-route] circular attempt failed', i, err)
        }
      }

      if (!best) return json({ error: 'No circular route found' }, 404)
      return json({ ok: true, provider: 'valhalla', bikeType, routeType, ...best })
    }

    // A→B and out-and-back
    if (waypoints.length < 2) {
      return json({ error: 'At least two waypoints required' }, 400)
    }
    const pts =
      routeType === 'out_and_back' ? [...waypoints, waypoints[0]] : waypoints
    const locations = pts.map((w) => ({ lat: w.lat, lon: w.lng, type: 'break' }))
    const result = await routeLocations(env, locations, costing, language)
    return json({ ok: true, provider: 'valhalla', bikeType, routeType, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Valhalla bike-route failed'
    console.error('[bike-route]', message)
    return json({ error: message }, 502)
  }
}
