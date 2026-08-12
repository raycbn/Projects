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
  /** When true on A→B, ask Valhalla for up to 2 alternate geometries (3 options total). */
  wantAlternatives?: boolean
}

type ValhallaAction = 'route' | 'trace_attributes' | 'height'

function resolveUpstream(env: Env, action: ValhallaAction): { url: string; headers: HeadersInit } {
  if (env.STADIA_API_KEY) {
    const path =
      action === 'route'
        ? '/route/v1'
        : action === 'trace_attributes'
          ? '/trace_attributes/v1'
          : '/elevation/v1'
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

/** Evenly spaced samples along the full polyline (never jumps to the end). */
function sampleEvenly(coords: [number, number][], maxPoints: number): [number, number][] {
  if (coords.length <= 2) return coords
  const cum = [0]
  for (let i = 1; i < coords.length; i += 1) {
    cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]))
  }
  const total = cum[cum.length - 1]
  if (total <= 0) return [coords[0], coords[coords.length - 1]]

  const n = Math.max(2, Math.min(maxPoints, coords.length))
  const out: [number, number][] = []
  for (let i = 0; i < n; i += 1) {
    const target = (i / (n - 1)) * total
    let j = 1
    while (j < cum.length && cum[j] < target) j += 1
    const i1 = Math.max(1, j)
    const i0 = i1 - 1
    const seg = cum[i1] - cum[i0] || 1
    const t = (target - cum[i0]) / seg
    const a = coords[i0]
    const b = coords[i1]
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return out
}

function pointAtDistance(
  coords: [number, number][],
  targetMeters: number,
): { lng: number; lat: number } {
  if (!coords.length) return { lng: 0, lat: 0 }
  if (coords.length === 1 || targetMeters <= 0) {
    return { lng: coords[0][0], lat: coords[0][1] }
  }
  let acc = 0
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1]
    const b = coords[i]
    const seg = haversine(a, b)
    if (acc + seg >= targetMeters) {
      const t = seg > 0 ? (targetMeters - acc) / seg : 0
      return { lng: a[0] + (b[0] - a[0]) * t, lat: a[1] + (b[1] - a[1]) * t }
    }
    acc += seg
  }
  const last = coords[coords.length - 1]
  return { lng: last[0], lat: last[1] }
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
    all.push(...part.slice(1))
  }
  return all
}

type ElevPoint = {
  distanceMeters: number
  elevationMeters: number
  position: { lng: number; lat: number }
}

type ValhallaTrip = {
  legs?: Array<{
    shape?: string
    summary?: { length?: number; time?: number }
    elevation?: Array<number | null>
    elevation_interval?: number
    maneuvers?: Array<{ instruction?: string }>
  }>
  summary?: { length?: number; time?: number }
}

type TripJson = {
  trip?: ValhallaTrip
  alternates?: ValhallaTrip[]
  error?: string
}

const ROUTE_ELEVATION_INTERVAL_M = 30

/** Build a continuous elevation profile from Valhalla leg.elevation arrays. */
function profileFromRouteLegs(
  legs: NonNullable<NonNullable<TripJson['trip']>['legs']>,
  coordinates: [number, number][],
): ElevPoint[] {
  const out: ElevPoint[] = []
  let offsetM = 0
  for (const leg of legs) {
    const elevs = leg.elevation
    if (!elevs?.length) {
      offsetM += Math.round((leg.summary?.length ?? 0) * 1000)
      continue
    }
    const interval = Math.max(1, leg.elevation_interval ?? ROUTE_ELEVATION_INTERVAL_M)
    for (let i = 0; i < elevs.length; i += 1) {
      const elev = elevs[i]
      if (elev === null || elev === undefined || !Number.isFinite(elev)) continue
      const distanceMeters = offsetM + i * interval
      out.push({
        distanceMeters,
        elevationMeters: elev,
        position: pointAtDistance(coordinates, distanceMeters),
      })
    }
    // Prefer interval * (n-1) so multi-leg profiles stay continuous.
    offsetM += (elevs.length - 1) * interval
  }
  return out
}

function profileFromHeightResponse(
  height: unknown,
  sampled: [number, number][],
): ElevPoint[] {
  const heightBody = height as {
    range_height?: Array<[number, number | null]>
    height?: Array<number | null>
  }

  if (heightBody.range_height?.length) {
    return heightBody.range_height
      .map(([rangeM, elev], i) => {
        if (elev === null || elev === undefined || !Number.isFinite(elev)) return null
        const c = sampled[Math.min(i, sampled.length - 1)]
        return {
          distanceMeters: rangeM,
          elevationMeters: elev,
          position: { lng: c[0], lat: c[1] },
        }
      })
      .filter((p): p is ElevPoint => Boolean(p))
  }

  if (heightBody.height?.length) {
    let acc = 0
    return heightBody.height
      .map((elev, i) => {
        const c = sampled[Math.min(i, sampled.length - 1)]
        if (i > 0) acc += haversine(sampled[i - 1], c)
        if (elev === null || elev === undefined || !Number.isFinite(elev)) return null
        return {
          distanceMeters: acc,
          elevationMeters: elev,
          position: { lng: c[0], lat: c[1] },
        }
      })
      .filter((p): p is ElevPoint => Boolean(p))
  }

  return []
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

  // Prefer elevation baked into the route (uniform interval, bridge/tunnel aware).
  let elevationProfile = profileFromRouteLegs(legs, coordinates)

  // Even samples for surface matching (+ height fallback if route has no elevation).
  // Cap lower on very long geometries (ida-vuelta) so trace_attributes stays snappy.
  const sampleBudget = coordinates.length > 1200 ? 72 : 96
  const sampled = sampleEvenly(coordinates, sampleBudget)
  const needHeightFallback = elevationProfile.length < 8

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
    needHeightFallback
      ? valhallaPost(env, 'height', {
          range: true,
          shape: sampled.map(([lng, lat]) => ({ lat, lon: lng })),
        }).catch(() => ({ range_height: [] }))
      : Promise.resolve(null),
  ])

  if (needHeightFallback && height) {
    elevationProfile = profileFromHeightResponse(height, sampled)
  }

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
  options?: { alternates?: number; elevationIntervalM?: number },
) {
  const elevationInterval =
    options?.elevationIntervalM ??
    // Longer shapes (typical ida-vuelta) use a slightly coarser DEM interval for speed.
    (locations.length >= 3 ? 40 : ROUTE_ELEVATION_INTERVAL_M)

  const routeJson = (await valhallaPost(env, 'route', {
    locations,
    costing: 'bicycle',
    costing_options: { bicycle: costing },
    directions_options: {
      units: 'kilometers',
      language: language === 'en' ? 'en-US' : 'es-ES',
    },
    elevation_interval: elevationInterval,
    ...(options?.alternates && options.alternates > 0
      ? { alternates: Math.min(3, Math.floor(options.alternates)) }
      : {}),
  })) as TripJson

  if (routeJson.error || !routeJson.trip?.legs?.length) {
    throw new Error(routeJson.error || 'No route found')
  }

  const primary = await enrichTrip(env, routeJson.trip, costing)
  const alternateTrips = Array.isArray(routeJson.alternates) ? routeJson.alternates : []
  const alternatives = (
    await Promise.all(
      alternateTrips.map((trip) =>
        trip?.legs?.length
          ? enrichTrip(env, trip, costing).catch((err) => {
              console.warn('[bike-route] alternate enrich failed', err)
              return null
            })
          : Promise.resolve(null),
      ),
    )
  ).filter((x): x is Awaited<ReturnType<typeof enrichTrip>> => Boolean(x))

  return { ...primary, alternatives }
}

type EnrichedRoute = Awaited<ReturnType<typeof enrichTrip>>

function routeFingerprint(route: EnrichedRoute): string {
  const coords = route.coordinates
  const at = (t: number) => coords[Math.min(coords.length - 1, Math.floor(coords.length * t))] ?? coords[0]
  const q1 = at(0.25)
  const mid = at(0.5)
  const q3 = at(0.75)
  const end = coords[coords.length - 1] ?? coords[0]
  // Finer buckets so costing variants (roads vs mixed) don't collapse into one option.
  return [
    Math.round(route.distanceMeters / 40),
    q1[0].toFixed(4),
    q1[1].toFixed(4),
    mid[0].toFixed(4),
    mid[1].toFixed(4),
    q3[0].toFixed(4),
    q3[1].toFixed(4),
    end[0].toFixed(4),
    end[1].toFixed(4),
  ].join('|')
}

function costingVariant(
  base: Record<string, number | string>,
  tweak: 'roads' | 'hills' | 'mixed',
): Record<string, number | string> {
  const next = { ...base }
  const num = (key: string, fallback: number) =>
    typeof next[key] === 'number' ? (next[key] as number) : fallback
  if (tweak === 'roads') {
    next.use_roads = Math.min(1, num('use_roads', 0.5) + 0.28)
    next.use_hills = Math.max(0, num('use_hills', 0.2) - 0.08)
    next.avoid_bad_surfaces = Math.min(1, num('avoid_bad_surfaces', 0.5) + 0.15)
  } else if (tweak === 'hills') {
    next.use_hills = Math.min(1, num('use_hills', 0.2) + 0.35)
    next.use_roads = Math.max(0.1, num('use_roads', 0.5) - 0.12)
  } else {
    next.use_roads = Math.max(0.15, num('use_roads', 0.5) - 0.22)
    next.avoid_bad_surfaces = Math.max(0, num('avoid_bad_surfaces', 0.5) - 0.25)
    next.use_hills = Math.min(1, num('use_hills', 0.2) + 0.12)
  }
  return next
}

function mergeUniqueRoutes(routes: EnrichedRoute[], max = 3): EnrichedRoute[] {
  const out: EnrichedRoute[] = []
  const seen = new Set<string>()
  for (const route of routes) {
    if (!route?.coordinates || route.coordinates.length < 2) continue
    const key = routeFingerprint(route)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(route)
    if (out.length >= max) break
  }
  return out
}

async function topUpWithCostingVariants(
  env: Env,
  locations: Array<{ lat: number; lon: number; type: string }>,
  costing: Record<string, number | string>,
  language: string,
  seed: EnrichedRoute[],
  parallel: boolean,
): Promise<EnrichedRoute[]> {
  let unique = mergeUniqueRoutes(seed, 3)
  if (unique.length >= 3) return unique

  const variants: Array<'roads' | 'mixed' | 'hills'> = ['roads', 'mixed', 'hills']
  if (parallel) {
    const settled = await Promise.allSettled(
      variants.map((v) => routeLocations(env, locations, costingVariant(costing, v), language)),
    )
    const extras: EnrichedRoute[] = []
    for (const r of settled) {
      if (r.status === 'fulfilled') extras.push(r.value)
    }
    return mergeUniqueRoutes([...unique, ...extras], 3)
  }

  // FOSSGIS: sequential top-ups to stay quota-friendly, stop at 3 unique.
  for (const variant of variants) {
    if (unique.length >= 3) break
    try {
      const extra = await routeLocations(env, locations, costingVariant(costing, variant), language)
      unique = mergeUniqueRoutes([...unique, extra], 3)
    } catch (err) {
      console.warn('[bike-route] costing top-up failed', variant, err)
    }
  }
  return unique
}

/**
 * Primary Valhalla route + native alternates, topped up with costing variants
 * so A→B / ida-vuelta usually returns 2–3 distinct options.
 */
async function routeLocationsWithOptions(
  env: Env,
  locations: Array<{ lat: number; lon: number; type: string }>,
  costing: Record<string, number | string>,
  language: string,
  mode: 'a_to_b' | 'out_and_back' = 'a_to_b',
): Promise<EnrichedRoute & { alternatives: EnrichedRoute[] }> {
  const parallel = Boolean(env.STADIA_API_KEY) && mode === 'a_to_b'

  if (parallel) {
    const [mainSettled, roadsSettled, mixedSettled] = await Promise.allSettled([
      routeLocations(env, locations, costing, language, { alternates: 2 }),
      routeLocations(env, locations, costingVariant(costing, 'roads'), language),
      routeLocations(env, locations, costingVariant(costing, 'mixed'), language),
    ])

    if (mainSettled.status !== 'fulfilled') {
      const fallback = [roadsSettled, mixedSettled].find((r) => r.status === 'fulfilled')
      if (!fallback || fallback.status !== 'fulfilled') throw mainSettled.reason
      return { ...fallback.value, alternatives: [] }
    }

    const main = mainSettled.value
    const extras: EnrichedRoute[] = [...(main.alternatives ?? [])]
    if (roadsSettled.status === 'fulfilled') extras.push(roadsSettled.value)
    if (mixedSettled.status === 'fulfilled') extras.push(mixedSettled.value)

    let unique = mergeUniqueRoutes([main, ...extras], 3)
    if (unique.length < 3) {
      unique = await topUpWithCostingVariants(
        env,
        locations,
        costing,
        language,
        unique,
        true,
      )
    }
    const primary = unique[0] ?? main
    return { ...primary, alternatives: unique.slice(1) }
  }

  // FOSSGIS / out-and-back: native alternates first, then sequential costing top-up.
  const main = await routeLocations(env, locations, costing, language, { alternates: 2 })
  const unique = await topUpWithCostingVariants(
    env,
    locations,
    costing,
    language,
    [main, ...(main.alternatives ?? [])],
    false,
  )
  const primary = unique[0] ?? main
  return { ...primary, alternatives: unique.slice(1) }
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
    wantAlternatives = false,
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
      const wantElev = Boolean(targetElevationGainMeters && targetElevationGainMeters > 0)
      const seed = circularSeed || 0
      // More bearings + leg scales → better distance/elev match; "Otra variante" rotates seed.
      const attempts: Array<{
        bearing: number
        legFactor: number
        costing: Record<string, number | string>
      }> = [
        { bearing: (seed * 47) % 360, legFactor: 5.0, costing },
        { bearing: (seed * 47 + 90) % 360, legFactor: 4.2, costing },
        { bearing: (seed * 47 + 180) % 360, legFactor: 4.6, costing },
        { bearing: (seed * 47 + 270) % 360, legFactor: 3.8, costing },
      ]
      if (wantElev) {
        const hills = costingVariant(costing, 'hills')
        attempts.push(
          { bearing: (seed * 47 + 35) % 360, legFactor: 4.5, costing: hills },
          { bearing: (seed * 47 + 215) % 360, legFactor: 4.0, costing: hills },
        )
      }

      const settled = await Promise.all(
        (env.STADIA_API_KEY ? attempts : attempts.slice(0, 4)).map(
          async ({ bearing, legFactor, costing: attemptCosting }, i) => {
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
              attemptCosting,
              language,
            )
            const distErr =
              Math.abs(candidate.distanceMeters - circularDistanceMeters) /
              Math.max(1, circularDistanceMeters)
            let elevErr = 0
            if (wantElev && targetElevationGainMeters) {
              let gain = 0
              for (let p = 1; p < candidate.elevationProfile.length; p += 1) {
                const d =
                  candidate.elevationProfile[p].elevationMeters -
                  candidate.elevationProfile[p - 1].elevationMeters
                if (d > 2.5) gain += d
              }
              elevErr =
                Math.abs(gain - targetElevationGainMeters) /
                Math.max(40, targetElevationGainMeters)
            }
            // Prefer closer distance; elev weighs more when user set a target.
            const score = distErr * 100 + elevErr * (wantElev ? 55 : 0)
            return { candidate, score, i }
          } catch (err) {
            console.warn('[bike-route] circular attempt failed', i, err)
            return null
          }
        }),
      )

      const ranked = settled
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => a.score - b.score)

      if (!ranked.length) return json({ error: 'No circular route found' }, 404)
      const best = ranked[0].candidate
      const { alternatives: _alts, ...primary } = best
      // Expose up to 2 runners-up so the client can offer "Otra variante" without re-hit.
      const alternatives = ranked.slice(1, 3).map((row, idx) => {
        const { alternatives: _a, ...rest } = row.candidate
        return { ...rest, label: `Variante ${idx + 2}` }
      })
      return json({
        ok: true,
        provider: 'valhalla',
        bikeType,
        routeType,
        ...primary,
        alternatives,
      })
    }

    // A→B and out-and-back
    if (waypoints.length < 2) {
      return json({ error: 'At least two waypoints required' }, 400)
    }
    const pts =
      routeType === 'out_and_back' ? [...waypoints, waypoints[0]] : waypoints
    const locations = pts.map((w) => ({ lat: w.lat, lon: w.lng, type: 'break' }))
    const wantsOptions =
      wantAlternatives && (routeType === 'a_to_b' || routeType === 'out_and_back')
    const result = wantsOptions
      ? await routeLocationsWithOptions(
          env,
          locations,
          costing,
          language,
          routeType === 'out_and_back' ? 'out_and_back' : 'a_to_b',
        )
      : await routeLocations(env, locations, costing, language, {
          elevationIntervalM: routeType === 'out_and_back' ? 40 : ROUTE_ELEVATION_INTERVAL_M,
        })
    return json({ ok: true, provider: 'valhalla', bikeType, routeType, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Valhalla bike-route failed'
    console.error('[bike-route]', message)
    return json({ error: message }, 502)
  }
}
