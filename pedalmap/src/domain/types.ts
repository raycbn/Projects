export type BikeType = 'road' | 'mtb' | 'gravel' | 'urban' | 'ebike'

export type RouteType = 'a_to_b' | 'circular' | 'out_and_back' | 'map_trace'

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
  /** Snapshot of the best ride window when the user saved (retention cue). */
  bestWindWindow?: {
    startHour: string
    endHour: string
    score: number
    label: string
    caption: string
  }
}

export interface SavedRoute extends RouteDraft {
  id: string
  userId: string
  isPublic: boolean
  shareSlug?: string
  /** Soft social: cheers count (client-maintained). */
  cheersCount?: number
  /** Opt-in: watch this route for excellent wind windows (in-app / email stub). */
  windAlertEnabled?: boolean
  createdAt: string
  updatedAt: string
}

export interface BikePreferences {
  bikeType: BikeType
  preferences: RoutePreference[]
}

export type UserPlan = 'free' | 'premium'

export interface UserNotifications {
  /** Master switch for best-window wind alerts. */
  windAlertsEnabled?: boolean
  /** Also try email (Worker stub until Resend is wired). */
  windAlertsEmail?: boolean
  /** Email when someone follows you (default on if unset). */
  followAlertsEmail?: boolean
  /** Browser/PWA notification when someone follows you (opt-in). */
  followAlertsPush?: boolean
  /** Publish finished activities to your public profile (opt-in). */
  activitiesPublic?: boolean
}

/** In-app / PWA inbox item (follows, etc.). */
export interface InboxNotification {
  id: string
  type: 'follow'
  fromUserId: string
  fromDisplayName: string
  createdAt: string
  read: boolean
}

export interface UserProfile {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  plan: UserPlan
  bikePreferences: BikePreferences
  notifications?: UserNotifications
  usage: {
    routesCreatedThisMonth: number
    routesSaved: number
    monthKey: string
    /** Soft Free trial: ISO week of last counted GPX export. */
    freeGpxWeekKey?: string
    freeGpxUsedThisWeek?: number
    /** Soft Free trial: Objetivos used in the current monthKey. */
    freeCircularUsedThisMonth?: number
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
  /** Objetivo circular (km + desnivel) es Premium; Free incluye 1 prueba/mes. */
  advancedCircular: false,
  advancedFilters: false,
  maxActivePreferences: 2,
}

/** Soft Free trials — taste Premium without a hard wall. */
export const FREE_TRIALS = {
  gpxPerWeek: 1,
  circularPerMonth: 1,
  /** Free may watch this many saved routes for wind alerts. */
  windAlertRoutes: 1,
} as const

/** Stripe Checkout trial on yearly plan only (Worker). */
export const ANNUAL_TRIAL_DAYS = 7

/** Pack Grupeta — fixed seat bundle (Worker + Stripe prices). */
export const GRUPETA_SEAT_LIMIT = 4
export const GRUPETA_MEMBER_SEATS = GRUPETA_SEAT_LIMIT - 1
/** Display euros (Stripe unit_amount / 100). */
export const GRUPETA_PRICE_MONTH = '14,99'
export const GRUPETA_PRICE_YEAR = '119,99'

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
    | 'create_limit'
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
      | 'create_limit'
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
export type ActivitySource = 'gps' | 'strava' | 'wahoo' | 'igpsport' | 'garmin' | 'gpx' | 'fit'

export interface ActivityTrackPoint {
  position: LatLng
  elevationMeters?: number
  recordedAt: string
  accuracyMeters?: number
  heartRateBpm?: number
  cadenceRpm?: number
  powerWatts?: number
  speedMetersPerSecond?: number
}

export interface Activity {
  id: string
  userId: string
  routeId?: string
  title: string
  status: ActivityStatus
  bikeType: BikeType
  source?: ActivitySource
  /** e.g. strava:123456789 — used to avoid duplicate imports */
  externalId?: string
  /** Opt-in: show on public cyclist profile. */
  isPublic?: boolean
  startedAt: string
  finishedAt?: string
  track: ActivityTrackPoint[]
  stats: {
    distanceMeters: number
    /** Elapsed wall-clock time (includes pauses / stops). */
    durationSeconds: number
    /** Time actually moving — Free analytics. */
    movingTimeSeconds?: number
    stoppedTimeSeconds?: number
    elevationGainMeters: number
    elevationLossMeters?: number
    elevationHighestMeters?: number
    elevationLowestMeters?: number
    averageHeartRateBpm?: number
    averageCadenceRpm?: number
    averagePowerWatts?: number
    estimatedPowerWatts?: number
    averageSpeedMetersPerSecond?: number
    maxSpeedMetersPerSecond?: number
    averageGradePercent?: number
    maxGradePercent?: number
    vamMetersPerHour?: number
    estimatedCaloriesKcal?: number
    coastingPercent?: number
    splits?: Array<{
      index: number
      distanceMeters: number
      durationSeconds: number
      averageSpeedMetersPerSecond: number
      elevationGainMeters: number
    }>
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
  /** Soft city label for «cerca de ti» / retos (e.g. Madrid). */
  city?: string | null
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

