import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  BikeType,
  ElevationPoint,
  LatLng,
  PlannerStatus,
  RouteDraft,
  RoutePreference,
  RouteType,
  Waypoint,
} from '@/domain/types'
import { RoutingError } from '@/domain/types'
import { routeService } from '@/services/RouteService'
import { track } from '@/lib/analytics'
import { canCreateRoute, canUseAdvancedCircular, clampPreferencesForPlan } from '@/services/EntitlementService'
import { useAuth } from '@/app/AuthContext'

interface PlannerContextValue {
  status: PlannerStatus
  errorMessage: string | null
  routeType: RouteType
  bikeType: BikeType
  preferences: RoutePreference[]
  waypoints: Waypoint[]
  draft: RouteDraft | null
  editDraft: RouteDraft | null
  hoverPoint: LatLng | null
  guestCreates: number
  circularDistanceMeters: number
  wantAlternatives: boolean
  setRouteType: (t: RouteType) => void
  setBikeType: (t: BikeType) => void
  setPreferences: (p: RoutePreference[]) => void
  setCircularDistanceMeters: (meters: number) => void
  setWantAlternatives: (value: boolean) => void
  setStart: (position: LatLng, name?: string) => void
  setEnd: (position: LatLng, name?: string) => void
  addVia: (position: LatLng, name?: string) => void
  removeWaypoint: (id: string) => void
  updateWaypointPosition: (id: string, position: LatLng) => void
  moveWaypoint: (id: string, direction: -1 | 1) => void
  calculate: () => Promise<void>
  startEditing: () => void
  cancelEditing: () => void
  saveEdits: () => Promise<void>
  selectAlternative: (index: number) => void
  setHoverPoint: (p: LatLng | null) => void
  setDraftFromImport: (draft: RouteDraft) => void
  clearRoute: () => void
  paywallReason: string | null
  clearPaywall: () => void
  showPaywall: (reason: string) => void
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function reorderVias(waypoints: Waypoint[], id: string, direction: -1 | 1): Waypoint[] {
  const start = waypoints.find((w) => w.kind === 'start')
  const end = waypoints.find((w) => w.kind === 'end')
  const vias = waypoints.filter((w) => w.kind === 'via')
  const index = vias.findIndex((w) => w.id === id)
  if (index < 0) return waypoints
  const target = index + direction
  if (target < 0 || target >= vias.length) return waypoints
  const next = [...vias]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return [...(start ? [start] : []), ...next, ...(end ? [end] : [])].map((w, i) => ({
    ...w,
    order: i,
  }))
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [status, setStatus] = useState<PlannerStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [routeType, setRouteType] = useState<RouteType>('a_to_b')
  const [bikeType, setBikeType] = useState<BikeType>('road')
  const [preferences, setPreferences] = useState<RoutePreference[]>([])
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [draft, setDraft] = useState<RouteDraft | null>(null)
  const [editDraft, setEditDraft] = useState<RouteDraft | null>(null)
  const [hoverPoint, setHoverPoint] = useState<LatLng | null>(null)
  const [guestCreates, setGuestCreates] = useState(0)
  const [paywallReason, setPaywallReason] = useState<string | null>(null)
  const [circularDistanceMeters, setCircularDistanceMeters] = useState(25000)
  const [wantAlternatives, setWantAlternatives] = useState(false)
  const [hydratedProfile, setHydratedProfile] = useState(false)

  useEffect(() => {
    if (!profile || hydratedProfile) return
    setBikeType(profile.bikePreferences.bikeType || 'road')
    setPreferences(profile.bikePreferences.preferences || [])
    setHydratedProfile(true)
  }, [profile, hydratedProfile])

  const value = useMemo<PlannerContextValue>(() => {
    return {
      status,
      errorMessage,
      routeType,
      bikeType,
      preferences,
      waypoints,
      draft,
      editDraft,
      hoverPoint,
      guestCreates,
      circularDistanceMeters,
      wantAlternatives,
      paywallReason,
      setRouteType,
      setBikeType,
      setPreferences,
      setCircularDistanceMeters,
      setWantAlternatives,
      setHoverPoint,
      clearPaywall: () => setPaywallReason(null),
      showPaywall: (reason) => setPaywallReason(reason),
      setStart(position, name) {
        setWaypoints((prev) => {
          const rest = prev.filter((w) => w.kind !== 'start')
          return [
            { id: 'start', name: name ?? 'Inicio', position, order: 0, kind: 'start' },
            ...rest.map((w, i) => ({ ...w, order: i + 1 })),
          ]
        })
      },
      setEnd(position, name) {
        setWaypoints((prev) => {
          const rest = prev.filter((w) => w.kind !== 'end')
          const ordered = rest.map((w, i) => ({ ...w, order: i }))
          return [
            ...ordered,
            {
              id: 'end',
              name: name ?? 'Destino',
              position,
              order: ordered.length,
              kind: 'end',
            },
          ]
        })
      },
      addVia(position, name) {
        setWaypoints((prev) => {
          const start = prev.find((w) => w.kind === 'start')
          const end = prev.find((w) => w.kind === 'end')
          const vias = prev.filter((w) => w.kind === 'via')
          const nextVia: Waypoint = {
            id: uid(),
            name: name ?? `Punto ${vias.length + 1}`,
            position,
            order: 0,
            kind: 'via',
          }
          const all = [
            ...(start ? [start] : []),
            ...vias,
            nextVia,
            ...(end ? [end] : []),
          ].map((w, i) => ({ ...w, order: i }))
          return all
        })
      },
      removeWaypoint(id) {
        setWaypoints((prev) =>
          prev
            .filter((w) => w.id !== id)
            .map((w, i) => ({ ...w, order: i })),
        )
      },
      updateWaypointPosition(id, position) {
        setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, position } : w)))
        if (editDraft) {
          setEditDraft({
            ...editDraft,
            waypoints: editDraft.waypoints.map((w) =>
              w.id === id ? { ...w, position } : w,
            ),
          })
        }
      },
      moveWaypoint(id, direction) {
        setWaypoints((prev) => reorderVias(prev, id, direction))
      },
      async calculate() {
        const entitlement = canCreateRoute(profile, guestCreates)
        if (!entitlement.ok) {
          setPaywallReason(entitlement.reason ?? 'create_limit')
          return
        }
        if (routeType === 'circular' && profile && !canUseAdvancedCircular(profile)) {
          setPaywallReason('circular_premium')
          return
        }

        setStatus('calculating')
        setErrorMessage(null)
        try {
          const prefs = clampPreferencesForPlan(preferences, profile)
          if (prefs.length !== preferences.length) {
            setPreferences(prefs)
            setPaywallReason('filter_limit')
          }
          const result = await routeService.calculate({
            waypoints,
            bikeType,
            preferences: prefs,
            routeType,
            circularDistanceMeters:
              routeType === 'circular' ? circularDistanceMeters : undefined,
            wantAlternatives: wantAlternatives && routeType === 'a_to_b',
          })
          setDraft(result)
          setEditDraft(null)
          setStatus('success')
          setGuestCreates((n) => n + 1)
          track('route_created', {
            distance_km: Math.round(result.stats.distanceMeters / 1000),
            bike_type: bikeType,
            route_type: routeType,
          })
        } catch (error) {
          console.error('[planner] calculate', error)
          setStatus('error')
          if (error instanceof RoutingError && error.code === 'not_configured') {
            setErrorMessage(
              'El motor de rutas no está configurado. Despliega el proxy Cloudflare (VITE_PEDALMAP_API_URL) — la API key de ORS no va al navegador.',
            )
          } else if (
            error instanceof RoutingError &&
            error.message.toLowerCase().includes('temporarily unavailable')
          ) {
            setErrorMessage(
              'Algunos perfiles de OpenRouteService no están disponibles ahora (p. ej. cycling-road). Prueba MTB/Gravel/Urbana o reinténtalo en unos minutos.',
            )
          } else {
            setErrorMessage(
              'No hemos podido encontrar una ruta con esas preferencias. Prueba a reducir los filtros, cambiar el tipo de bicicleta o elegir otro punto.',
            )
          }
        }
      },
      startEditing() {
        if (!draft) return
        setEditDraft(structuredClone(draft))
        setStatus('editing')
      },
      cancelEditing() {
        setEditDraft(null)
        setStatus(draft ? 'success' : 'idle')
      },
      async saveEdits() {
        if (!editDraft) return
        // Recalculate with edited waypoints so geometry stays real.
        setStatus('calculating')
        try {
          const result = await routeService.calculate({
            waypoints: editDraft.waypoints,
            bikeType: editDraft.bikeType,
            preferences: editDraft.preferences,
            routeType: editDraft.type,
            circularDistanceMeters: editDraft.circularDistanceMeters,
            wantAlternatives: false,
            title: editDraft.title,
          })
          setDraft(result)
          setWaypoints(result.waypoints)
          setEditDraft(null)
          setStatus('success')
        } catch (error) {
          console.error('[planner] saveEdits', error)
          setStatus('editing')
          setErrorMessage('No se pudo recalcular la ruta editada. Revisa los puntos.')
        }
      },
      selectAlternative(index) {
        if (!draft?.alternatives?.length) return
        const alt = draft.alternatives[index]
        if (!alt) return
        setDraft({
          ...draft,
          geometry: alt.geometry,
          elevationProfile: alt.elevationProfile,
          stats: alt.stats,
          title: `${draft.title.replace(/ · alt.*$/i, '')} · ${alt.label}`,
        })
      },
      setDraftFromImport(next) {
        setDraft(next)
        setWaypoints(next.waypoints)
        setBikeType(next.bikeType)
        setRouteType(next.type)
        setStatus('success')
        track('gpx_imported', { points: next.geometry.coordinates.length })
      },
      clearRoute() {
        setDraft(null)
        setEditDraft(null)
        setStatus('idle')
        setErrorMessage(null)
      },
    }
  }, [
    status,
    errorMessage,
    routeType,
    bikeType,
    preferences,
    waypoints,
    draft,
    editDraft,
    hoverPoint,
    guestCreates,
    paywallReason,
    profile,
    circularDistanceMeters,
    wantAlternatives,
  ])

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider')
  return ctx
}

export type { ElevationPoint }
