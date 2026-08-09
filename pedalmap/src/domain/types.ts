export type BikeType = 'road' | 'mtb' | 'gravel' | 'urban' | 'ebike'

export type RouteType = 'a_to_b' | 'circular' | 'out_and_back'

export type Difficulty = 'easy' | 'moderate' | 'hard' | 'expert'

export type PlannerStatus =
  | 'idle'
  | 'searching'
  | 'calculating'
  | 'success'
  | 'error'
  | 'editing'
  | 'saving'

export type RoutePreference =
  | 'prefer_bike_lanes'
  | 'prefer_secondary_roads'
  | 'avoid_primary_roads'
  | 'avoid_traffic'
  | 'avoid_unpaved'
  | 'prefer_unpaved'
  | 'prefer_less_elevation'
  | 'prefer_shorter'
  | 'prefer_faster'

export interface LatLng {
  lat: number
  lng: number
}

export interface Waypoint {
  id: string
  name?: string
  position: LatLng
  order: number
  kind: 'start' | 'via' | 'end'
}

export interface ElevationPoint {
  distanceMeters: number
  elevationMeters: number
  position?: LatLng
}

export interface SurfaceStats {
  pavedPercent?: number
  unpavedPercent?: number
  unknownPercent?: number
  surfaces?: Array<{ type: string; distanceMeters: number }>
}

export interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][] // [lng, lat]
}

export interface RouteStats {
  distanceMeters: number
  elevationGainMeters: number
  elevationLossMeters: number
  estimatedDurationSeconds: number
  difficulty: Difficulty
  highestPointMeters?: number
  lowestPointMeters?: number
  significantClimbs?: number
  surfaceStats?: SurfaceStats
}

export interface RouteDraft {
  title: string
  description?: string
  type: RouteType
  bikeType: BikeType
  preferences: RoutePreference[]
  waypoints: Waypoint[]
  geometry: RouteGeometry
  elevationProfile: ElevationPoint[]
  stats: RouteStats
  /** Approximate distance target for circular routes (future algorithm). */
  circularDistanceMeters?: number
}

export interface SavedRoute extends RouteDraft {
  id: string
  userId: string
  isPublic: boolean
  shareSlug?: string
  createdAt: string
  updatedAt: string
}

export interface BikePreferences {
  bikeType: BikeType
  preferences: RoutePreference[]
}

export type UserPlan = 'free' | 'premium'

export interface UserProfile {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  plan: UserPlan
  bikePreferences: BikePreferences
  usage: {
    routesCreatedThisMonth: number
    routesSaved: number
    monthKey: string
  }
  createdAt: string
  updatedAt: string
}

export interface FreemiumLimits {
  maxRoutesSaved: number
  maxRoutesCreatedPerMonth: number
  gpxExport: boolean
  advancedCircular: boolean
  advancedFilters: boolean
}

export const FREE_LIMITS: FreemiumLimits = {
  maxRoutesSaved: 5,
  maxRoutesCreatedPerMonth: 15,
  gpxExport: false,
  advancedCircular: false,
  advancedFilters: false,
}

export const PREMIUM_LIMITS: FreemiumLimits = {
  maxRoutesSaved: Number.POSITIVE_INFINITY,
  maxRoutesCreatedPerMonth: Number.POSITIVE_INFINITY,
  gpxExport: true,
  advancedCircular: true,
  advancedFilters: true,
}

export interface PlaceSuggestion {
  id: string
  label: string
  position: LatLng
  bbox?: [number, number, number, number]
}

export interface RoutingRequest {
  waypoints: LatLng[]
  bikeType: BikeType
  preferences: RoutePreference[]
  routeType: RouteType
  language?: string
}

export interface RoutingResult {
  geometry: RouteGeometry
  elevationProfile: ElevationPoint[]
  stats: RouteStats
  provider: string
  rawInstructions?: string[]
}

export class RoutingError extends Error {
  readonly code:
    | 'not_configured'
    | 'no_route'
    | 'rate_limited'
    | 'network'
    | 'invalid_request'
    | 'provider_error'
  override readonly cause?: unknown

  constructor(
    message: string,
    code:
      | 'not_configured'
      | 'no_route'
      | 'rate_limited'
      | 'network'
      | 'invalid_request'
      | 'provider_error',
    cause?: unknown,
  ) {
    super(message)
    this.name = 'RoutingError'
    this.code = code
    this.cause = cause
  }
}

export class GeocodingError extends Error {
  readonly code: 'not_configured' | 'network' | 'provider_error'
  override readonly cause?: unknown

  constructor(
    message: string,
    code: 'not_configured' | 'network' | 'provider_error',
    cause?: unknown,
  ) {
    super(message)
    this.name = 'GeocodingError'
    this.code = code
    this.cause = cause
  }
}
