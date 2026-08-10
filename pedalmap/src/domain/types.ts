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
  surfaces?: Array<{ type: string; distanceMeters: number; value?: number }>
  waytypes?: Array<{ type: string; distanceMeters: number; percent: number; value?: number }>
  /** How well the surface/way mix fits the selected bike modality. */
  suitability?: {
    score: number
    label: 'excelente' | 'buena' | 'aceptable' | 'poco_adecuada'
    notes: string[]
    bikeType: BikeType
  }
}

export interface RouteAlternative {
  id: string
  label: string
  /** 1-based display rank within routeOptions. */
  rank?: number
  geometry: RouteGeometry
  elevationProfile: ElevationPoint[]
  stats: RouteStats
  instructions?: string[]
  surfaceEdges?: Array<{
    length?: number
    surface?: string
    road_class?: string
    use?: string
    cycle_lane?: string
  }>
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
  /** Target length for ORS round_trip circular routes. */
  circularDistanceMeters?: number
  /** Optional target elevation gain (meters) for circular / objetivo mode. */
  targetElevationGainMeters?: number
  /** Seed for Objetivo variants (“Otra variante”). */
  circularSeed?: number
  /** Turn-by-turn instructions from the routing provider (when available). */
  instructions?: string[]
  /** Valhalla edges used to paint surface-colored route segments. */
  surfaceEdges?: Array<{
    length?: number
    surface?: string
    road_class?: string
    use?: string
    cycle_lane?: string
  }>
  /**
   * All ranked route options for this calculation (Opción 1..N), including the active one.
   * `geometry` / `stats` / `elevationProfile` always mirror `selectedOptionId`.
   */
  routeOptions?: RouteAlternative[]
  selectedOptionId?: string
  /** @deprecated Prefer routeOptions; kept as non-selected extras for older clients. */
  alternatives?: RouteAlternative[]
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
  /** Max simultaneous route preferences on free; premium is unlimited. */
  maxActivePreferences: number
}

export const FREE_LIMITS: FreemiumLimits = {
  maxRoutesSaved: 5,
  maxRoutesCreatedPerMonth: 15,
  gpxExport: false,
  /** Objetivo circular (km + desnivel) es Premium; invitados = Free (sin Objetivo avanzado). */
  advancedCircular: false,
  advancedFilters: false,
  maxActivePreferences: 2,
}

export const PREMIUM_LIMITS: FreemiumLimits = {
  maxRoutesSaved: Number.POSITIVE_INFINITY,
  maxRoutesCreatedPerMonth: Number.POSITIVE_INFINITY,
  gpxExport: true,
  advancedCircular: true,
  advancedFilters: true,
  maxActivePreferences: Number.POSITIVE_INFINITY,
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
  /** Required for circular / ORS round_trip (meters). */
  circularDistanceMeters?: number
  /** Optional target elevation gain (meters) — provider tries several seeds. */
  targetElevationGainMeters?: number
  /** ORS round_trip seed (direction variety). */
  circularSeed?: number
  /** Ask ORS for alternative_routes when true. */
  wantAlternatives?: boolean
}

export interface RoutingResult {
  geometry: RouteGeometry
  elevationProfile: ElevationPoint[]
  stats: RouteStats
  provider: string
  rawInstructions?: string[]
  surfaceEdges?: Array<{
    length?: number
    surface?: string
    road_class?: string
    use?: string
    cycle_lane?: string
  }>
  alternatives?: Array<{
    geometry: RouteGeometry
    elevationProfile: ElevationPoint[]
    stats: RouteStats
    rawInstructions?: string[]
    surfaceEdges?: RoutingResult['surfaceEdges']
  }>
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

/** Live GPS activity (Fase 5). */
export type ActivityStatus = 'recording' | 'paused' | 'finished'

export interface ActivityTrackPoint {
  position: LatLng
  elevationMeters?: number
  recordedAt: string
  accuracyMeters?: number
}

export interface Activity {
  id: string
  userId: string
  routeId?: string
  title: string
  status: ActivityStatus
  bikeType: BikeType
  startedAt: string
  finishedAt?: string
  track: ActivityTrackPoint[]
  stats: {
    distanceMeters: number
    durationSeconds: number
    elevationGainMeters: number
  }
  createdAt: string
  updatedAt: string
}

export interface SubscriptionRecord {
  userId: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  status: 'none' | 'active' | 'past_due' | 'canceled' | 'trialing'
  plan: UserPlan
  currentPeriodEnd?: string
  updatedAt: string
}

/** Fase 6 — community */
export interface PublicProfile {
  uid: string
  displayName: string | null
  photoURL: string | null
  bio?: string
  isPublic: boolean
  followersCount: number
  followingCount: number
  routesPublicCount: number
  updatedAt: string
}

export interface FollowEdge {
  followerId: string
  followeeId: string
  createdAt: string
}

export interface Segment {
  id: string
  name: string
  description?: string
  createdBy: string
  isPublic: boolean
  start: LatLng
  end: LatLng
  distanceMeters: number
  elevationGainMeters: number
  geometry?: RouteGeometry
  createdAt: string
  updatedAt: string
}

export interface SegmentEffort {
  id: string
  segmentId: string
  userId: string
  displayName?: string
  activityId?: string
  durationSeconds: number
  recordedAt: string
}

export interface Challenge {
  id: string
  title: string
  description?: string
  createdBy: string
  isPublic: boolean
  metric: 'distance' | 'elevation' | 'segment_time'
  segmentId?: string
  startAt: string
  endAt: string
  createdAt: string
}

export interface ChallengeEntry {
  id: string
  challengeId: string
  userId: string
  displayName?: string
  value: number
  updatedAt: string
}

export interface RankingEntry {
  userId: string
  displayName?: string
  score: number
  rank: number
  updatedAt: string
}

