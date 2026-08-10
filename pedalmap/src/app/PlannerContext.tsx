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
import { authService } from '@/services/AuthService'

const GUEST_CREATES_KEY = 'pedalmap_guest_creates'
const LAST_DRAFT_KEY = 'pedalmap_last_draft'

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
  targetElevationGainMeters: number
  circularSeed: number
  wantAlternatives: boolean
  setRouteType: (t: RouteType) => void
  setBikeType: (t: BikeType) => void
  setPreferences: (p: RoutePreference[]) => void
  setCircularDistanceMeters: (meters: number) => void
  setTargetElevationGainMeters: (meters: number) => void
  setWantAlternatives: (value: boolean) => void
  bumpCircularSeed: () => void
  setStart: (position: LatLng, name?: string) => void
  setEnd: (position: LatLng, name?: string) => void
  addVia: (position: LatLng, name?: string) => void
  removeWaypoint: (id: string) => void
  updateWaypointPosition: (id: string, position: LatLng) => void
  moveWaypoint: (id: string, direction: -1 | 1) => void
  handleMapTap: (position: LatLng) => void
  useMyLocationAsStart: () => Promise<void>
  canCalculate: boolean
  calculate: () => Promise<void>
  calculateAnotherVariant: () => Promise<void>
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

function readGuestCreates(): number {
  try {
    const raw = localStorage.getItem(GUEST_CREATES_KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

function writeGuestCreates(n: number) {
  try {
    localStorage.setItem(GUEST_CREATES_KEY, String(n))
  } catch {
    /* ignore quota */
  }
}

function persistDraft(draft: RouteDraft | null) {
  try {
    if (!draft) {
      localStorage.removeItem(LAST_DRAFT_KEY)
      return
    }
    // Compact: drop huge coordinate density if needed — keep full for MVP recovery.
    localStorage.setItem(LAST_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore quota */
  }
}

function readLastDraft(): RouteDraft | null {
  try {
    const raw = localStorage.getItem(LAST_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RouteDraft
  } catch {
    return null
  }
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

function canCalculateRoute(routeType: RouteType, waypoints: Waypoint[]): boolean {
  const hasStart = waypoints.some((w) => w.kind === 'start')
  if (routeType === 'circular') return hasStart
  const hasEnd = waypoints.some((w) => w.kind === 'end')
  return hasStart && hasEnd
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [status, setStatus] = useState<PlannerStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [routeType, setRouteTypeState] = useState<RouteType>('a_to_b')
  const [bikeType, setBikeType] = useState<BikeType>('road')
  const [preferences, setPreferences] = useState<RoutePreference[]>([])
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [draft, setDraft] = useState<RouteDraft | null>(null)
  const [editDraft, setEditDraft] = useState<RouteDraft | null>(null)
  const [hoverPoint, setHoverPoint] = useState<LatLng | null>(null)
  const [guestCreates, setGuestCreates] = useState(0)
  const [paywallReason, setPaywallReason] = useState<string | null>(null)
  const [circularDistanceMeters, setCircularDistanceMeters] = useState(25000)
  const [targetElevationGainMeters, setTargetElevationGainMeters] = useState(0)
  const [circularSeed, setCircularSeed] = useState(0)
  const [wantAlternatives, setWantAlternatives] = useState(false)
  const [hydratedProfile, setHydratedProfile] = useState(false)
  const [hydratedStorage, setHydratedStorage] = useState(false)

  useEffect(() => {
    if (hydratedStorage) return
    setGuestCreates(readGuestCreates())
    const last = readLastDraft()
    if (last?.geometry?.coordinates?.length) {
      setDraft(last)
      setWaypoints(last.waypoints ?? [])
      setBikeType(last.bikeType || 'road')
      setRouteTypeState(last.type || 'a_to_b')
      if (last.circularDistanceMeters) setCircularDistanceMeters(last.circularDistanceMeters)
      if (last.targetElevationGainMeters !== undefined) {
        setTargetElevationGainMeters(last.targetElevationGainMeters)
      }
      setStatus('success')
    }
    setHydratedStorage(true)
  }, [hydratedStorage])

  useEffect(() => {
    if (!profile || hydratedProfile) return
    setBikeType(profile.bikePreferences.bikeType || 'road')
    setPreferences(profile.bikePreferences.preferences || [])
    setHydratedProfile(true)
  }, [profile, hydratedProfile])

  const canCalculate = canCalculateRoute(routeType, waypoints)

  const value = useMemo<PlannerContextValue>(() => {
    async function runCalculate(seed = circularSeed) {
      const entitlement = canCreateRoute(profile, guestCreates)
      if (!entitlement.ok) {
        setPaywallReason(entitlement.reason ?? 'create_limit')
        return
      }
      if (routeType === 'circular' && profile && !canUseAdvancedCircular(profile)) {
        setPaywallReason('circular_premium')
        return
      }
      if (!canCalculateRoute(routeType, waypoints)) {
        setErrorMessage(
          routeType === 'circular'
            ? 'Indica el punto de partida (búsqueda, mapa o Estoy aquí).'
            : 'Indica inicio y destino antes de crear la ruta.',
        )
        setStatus('error')
        return
      }

      setStatus('calculating')
      setErrorMessage(null)
      try {
        const prefs = clampPreferencesForPlan(preferences, profile)
        if (prefs.length !== preferences.length) {
          setPreferences(prefs)
          // Clamp silently — paywall already fired when the user toggled past the limit.
        }
        const result = await routeService.calculate({
          waypoints,
          bikeType,
          preferences: prefs,
          routeType,
          circularDistanceMeters:
            routeType === 'circular' ? circularDistanceMeters : undefined,
          targetElevationGainMeters:
            routeType === 'circular' && targetElevationGainMeters > 0
              ? targetElevationGainMeters
              : undefined,
          circularSeed: routeType === 'circular' ? seed : undefined,
          wantAlternatives: wantAlternatives && routeType === 'a_to_b',
        })
        setDraft(result)
        persistDraft(result)
        setEditDraft(null)
        setStatus('success')
        const nextGuest = guestCreates + 1
        setGuestCreates(nextGuest)
        writeGuestCreates(nextGuest)
        if (user && !user.isAnonymous) {
          void authService.recordRouteCreated(user.uid).catch((err) => {
            console.warn('[planner] usage create', err)
          })
        }
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
            'El motor de rutas no está configurado. Despliega el proxy Cloudflare (VITE_PEDALMAP_API_URL).',
          )
        } else if (error instanceof RoutingError && error.code === 'rate_limited') {
          setErrorMessage(
            'Has hecho demasiadas peticiones de ruta en poco tiempo. Espera un minuto e inténtalo de nuevo.',
          )
        } else if (error instanceof RoutingError && error.code === 'network') {
          setErrorMessage(
            'No hay conexión con el motor de rutas. Revisa tu red e inténtalo otra vez.',
          )
        } else if (
          error instanceof RoutingError &&
          (error.code === 'provider_error' ||
            error.message.toLowerCase().includes('temporarily unavailable'))
        ) {
          setErrorMessage(
            'El motor de rutas no responde bien ahora. Prueba otra vez en unos segundos o cambia el tipo de bici.',
          )
        } else if (error instanceof RoutingError && error.code === 'no_route') {
          setErrorMessage(
            'No hemos podido encontrar una ruta con esas preferencias. Prueba a reducir los filtros, cambiar el tipo de bicicleta o elegir otro punto.',
          )
        } else {
          setErrorMessage(
            'No hemos podido calcular la ruta. Prueba a cambiar el tipo de bicicleta, bajar filtros o mover el punto de inicio.',
          )
        }
      }
    }

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
      targetElevationGainMeters,
      circularSeed,
      wantAlternatives,
      paywallReason,
      canCalculate,
      setRouteType(next) {
        setRouteTypeState(next)
        setDraft(null)
        persistDraft(null)
        setEditDraft(null)
        setErrorMessage(null)
        setStatus('idle')
        setCircularSeed(0)
        setWantAlternatives(false)
        // Drop points that don't apply to the new mode to avoid stale A→B ends on Objetivo.
        setWaypoints((prev) => {
          if (next === 'circular') {
            return prev
              .filter((w) => w.kind === 'start')
              .map((w, i) => ({ ...w, order: i }))
          }
          return prev
        })
      },
      setBikeType,
      setPreferences,
      setCircularDistanceMeters,
      setTargetElevationGainMeters,
      setWantAlternatives,
      bumpCircularSeed() {
        setCircularSeed((s) => s + 1)
      },
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
      handleMapTap(position) {
        const hasStart = waypoints.some((w) => w.kind === 'start')
        const hasEnd = waypoints.some((w) => w.kind === 'end')
        const label = `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
        if (!hasStart) {
          setWaypoints((prev) => {
            const rest = prev.filter((w) => w.kind !== 'start')
            return [
              { id: 'start', name: label, position, order: 0, kind: 'start' },
              ...rest.map((w, i) => ({ ...w, order: i + 1 })),
            ]
          })
          return
        }
        if (routeType === 'circular') {
          // Replace start on Objetivo when tapping again.
          setWaypoints([
            { id: 'start', name: label, position, order: 0, kind: 'start' },
          ])
          return
        }
        if (!hasEnd) {
          setWaypoints((prev) => {
            const rest = prev.filter((w) => w.kind !== 'end')
            const ordered = rest.map((w, i) => ({ ...w, order: i }))
            return [
              ...ordered,
              { id: 'end', name: label, position, order: ordered.length, kind: 'end' },
            ]
          })
          return
        }
        // Both set → add via (capped)
        const vias = waypoints.filter((w) => w.kind === 'via')
        if (vias.length >= 5) {
          setErrorMessage('Máximo 5 waypoints. Elimina uno o arrastra los marcadores.')
          return
        }
        setWaypoints((prev) => {
          const start = prev.find((w) => w.kind === 'start')
          const end = prev.find((w) => w.kind === 'end')
          const currentVias = prev.filter((w) => w.kind === 'via')
          const nextVia: Waypoint = {
            id: uid(),
            name: label,
            position,
            order: 0,
            kind: 'via',
          }
          return [
            ...(start ? [start] : []),
            ...currentVias,
            nextVia,
            ...(end ? [end] : []),
          ].map((w, i) => ({ ...w, order: i }))
        })
      },
      async useMyLocationAsStart() {
        if (!navigator.geolocation) {
          setErrorMessage('Tu dispositivo no permite geolocalización.')
          return
        }
        setErrorMessage(null)
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const position = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }
              setWaypoints((prev) => {
                const rest = prev.filter((w) => w.kind !== 'start')
                return [
                  {
                    id: 'start',
                    name: 'Estoy aquí',
                    position,
                    order: 0,
                    kind: 'start',
                  },
                  ...rest.map((w, i) => ({ ...w, order: i + 1 })),
                ]
              })
              resolve()
            },
            () => {
              setErrorMessage('No pudimos obtener tu ubicación. Revisa permisos de GPS.')
              resolve()
            },
            { enableHighAccuracy: true, timeout: 12_000 },
          )
        })
      },
      async calculate() {
        await runCalculate(circularSeed)
      },
      async calculateAnotherVariant() {
        const nextSeed = circularSeed + 1
        setCircularSeed(nextSeed)
        await runCalculate(nextSeed)
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
        setStatus('calculating')
        try {
          const result = await routeService.calculate({
            waypoints: editDraft.waypoints,
            bikeType: editDraft.bikeType,
            preferences: editDraft.preferences,
            routeType: editDraft.type,
            circularDistanceMeters: editDraft.circularDistanceMeters,
            targetElevationGainMeters: editDraft.targetElevationGainMeters,
            circularSeed: editDraft.circularSeed,
            wantAlternatives: false,
            title: editDraft.title,
          })
          setDraft(result)
          persistDraft(result)
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
        const next = {
          ...draft,
          geometry: alt.geometry,
          elevationProfile: alt.elevationProfile,
          stats: alt.stats,
          title: `${draft.title.replace(/ · alt.*$/i, '')} · ${alt.label}`,
        }
        setDraft(next)
        persistDraft(next)
      },
      setDraftFromImport(next) {
        setDraft(next)
        persistDraft(next)
        setWaypoints(next.waypoints)
        setBikeType(next.bikeType)
        setRouteTypeState(next.type)
        setStatus('success')
        track('gpx_imported', { points: next.geometry.coordinates.length })
      },
      clearRoute() {
        setDraft(null)
        persistDraft(null)
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
    user,
    circularDistanceMeters,
    targetElevationGainMeters,
    circularSeed,
    wantAlternatives,
    canCalculate,
  ])

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider')
  return ctx
}

export type { ElevationPoint }
