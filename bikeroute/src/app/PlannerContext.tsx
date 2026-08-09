import {
  createContext,
  useContext,
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
import { canCreateRoute } from '@/services/EntitlementService'
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
  setRouteType: (t: RouteType) => void
  setBikeType: (t: BikeType) => void
  setPreferences: (p: RoutePreference[]) => void
  setStart: (position: LatLng, name?: string) => void
  setEnd: (position: LatLng, name?: string) => void
  addVia: (position: LatLng, name?: string) => void
  removeWaypoint: (id: string) => void
  updateWaypointPosition: (id: string, position: LatLng) => void
  calculate: () => Promise<void>
  startEditing: () => void
  cancelEditing: () => void
  saveEdits: () => void
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

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [status, setStatus] = useState<PlannerStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [routeType, setRouteType] = useState<RouteType>('a_to_b')
  const [bikeType, setBikeType] = useState<BikeType>('road')
  const [preferences, setPreferences] = useState<RoutePreference[]>([
    'prefer_bike_lanes',
    'avoid_primary_roads',
  ])
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [draft, setDraft] = useState<RouteDraft | null>(null)
  const [editDraft, setEditDraft] = useState<RouteDraft | null>(null)
  const [hoverPoint, setHoverPoint] = useState<LatLng | null>(null)
  const [guestCreates, setGuestCreates] = useState(0)
  const [paywallReason, setPaywallReason] = useState<string | null>(null)

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
      paywallReason,
      setRouteType,
      setBikeType,
      setPreferences,
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
      async calculate() {
        const entitlement = canCreateRoute(profile, guestCreates)
        if (!entitlement.ok) {
          setPaywallReason(entitlement.reason ?? 'create_limit')
          return
        }

        setStatus('calculating')
        setErrorMessage(null)
        try {
          const result = await routeService.calculate({
            waypoints,
            bikeType,
            preferences,
            routeType,
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
              'El motor de rutas no está configurado. Añade VITE_ROUTING_API_KEY en tu archivo .env (OpenRouteService).',
            )
          } else if (error instanceof RoutingError && error.code === 'invalid_request' && routeType === 'circular') {
            setErrorMessage(
              'Las rutas circulares avanzadas están en preparación. Mientras tanto, usa A → B o Ida y vuelta.',
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
      saveEdits() {
        if (!editDraft) return
        setDraft(editDraft)
        setWaypoints(editDraft.waypoints)
        setEditDraft(null)
        setStatus('success')
      },
      setDraftFromImport(next) {
        setDraft(next)
        setWaypoints(next.waypoints)
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
  ])

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider')
  return ctx
}

export type { ElevationPoint }
