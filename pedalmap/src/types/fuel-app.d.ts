/**
 * Ambient declaration so PedalMap's `tsc -b` treats the Fuel embed entry as an
 * external module WITHOUT pulling Fuel's src (and its own react-router-dom v6
 * types) into PedalMap's type graph. Runtime resolution happens via the
 * `@fuel` Vite alias (see vite.config.ts).
 */
declare module '@fuel/fuel-app' {
  export interface FuelAppProps {
    /** When true, the standalone web HandoffConsumer runs (cross-domain #pm_ct). */
    webHandoff?: boolean
    /** Base path prefix for routes and links (e.g. "/fuel" when embedded). */
    base?: string
    /**
     * Host-provided auth state. When provided, Fuel runs in embedded mode:
     * no FuelAuthProvider bootstrap, no HandoffConsumer, logout delegated.
     */
    auth?: FuelAuthLike
    /** Route context passed from the host (PedalMap planner/ready-route data). */
    routeContext?: RouteContextLike
  }
  export interface FuelAuthLike {
    user: unknown
    localUser: unknown
    provider: 'local' | 'pedalmap'
    loading: boolean
    firebaseReady: boolean
    plan: 'free' | 'premium' | null
    entitlementLoading: boolean
    entitlementError: boolean
    canSaveRoute: boolean | null
    maxRoutesSaved: number | null
    routesSaved: number
    loginLocal: () => Promise<unknown>
    registerLocal: () => Promise<unknown>
    logout: () => Promise<void>
    handoffLogin: () => Promise<unknown>
  }
  export interface RouteContextLike {
    distanceKm?: number
    durationMinutes?: number
    elevationGainM?: number
    temperatureC?: number
    intensity?: string
    goal?: string
    sport?: string
    bodyMassKg?: number
    sweatRateLPerHour?: number
    departureTime?: string
  }
  export function FuelApp(props?: FuelAppProps): import('react').ReactElement
}

/**
 * Embedded entry context. The host mounts FuelApp and passes its own auth
 * (see {@link useHostFuelAuth}). `FuelAuthLike`/`RouteContextLike` are matched
 * structurally by Fuel's own types, so no Fuel source is pulled into PedalMap's
 * type graph beyond this ambient shim.
 */

