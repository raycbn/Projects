import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { consumeGuestCircular } from '@/lib/freemium'
import { useAuth } from '@/app/AuthContext'
import { authService } from '@/services/AuthService'
import { loadCloudDraft, saveCloudDraft, clearCloudDraft } from '@/services/DraftRepository'
import { applySelectedOption } from '@/lib/routeOptions'
import { isFirebaseConfigured } from '@/lib/firebase'
import { clearReadyRoute } from '@/lib/readyRouteHandoff'

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
  updateWaypointPosition: (id: string, position: LatLng, name?: string) => void
  moveWaypoint: (id: string, direction: -1 | 1) => void
  handleMapTap: (position: LatLng) => void
  useMyLocationAsStart: () => Promise<void>
  canCalculate: boolean
  calculate: () => Promise<RouteDraft | null>
  calculateAnotherVariant: () => Promise<RouteDraft | null>
  startEditing: () => void
  cancelEditing: () => void
  saveEdits: () => Promise<void>
  selectAlternative: (index: number) => void
  selectRouteOption: (optionId: string) => void
  setHoverPoint: (p: LatLng | null) => void
  setDraftFromImport: (draft: RouteDraft) => void
  clearRoute: () => void
  /** Switch to Trazar and edit without wiping the current draft. */
  adjustOnMap: () => void
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

/** Fresh profile after anonymous warm-up (React profile in the closure may still be null). */
async function peekLiveProfile() {
  if (!isFirebaseConfigured()) return null
  try {
    const { getFirebaseAuth } = await import('@/lib/firebase')
    const u = getFirebaseAuth().currentUser
    if (!u) return null
    return await authService.ensureProfile(u)
  } catch {
    return null
  }
}

function persistDraft(draft: RouteDraft | null, uid?: string | null) {
  try {
    if (!draft) {
      localStorage.removeItem(LAST_DRAFT_KEY)
    } else {
      localStorage.setItem(LAST_DRAFT_KEY, JSON.stringify(draft))
    }
  } catch {
    /* ignore quota */
  }
  if (!uid) return
  if (draft) {
    void saveCloudDraft(uid, draft).catch((err) => {
      console.warn('[planner] cloud draft', err)
    })
  } else {
    void clearCloudDraft(uid).catch((err) => {
      console.warn('[planner] clear cloud draft', err)
    })
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
  const [bikeType, setBikeTypeState] = useState<BikeType>('road')
  const [preferences, setPreferencesState] = useState<RoutePreference[]>([])
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [draft, setDraft] = useState<RouteDraft | null>(null)
  const [editDraft, setEditDraft] = useState<RouteDraft | null>(null)
  const [hoverPoint, setHoverPoint] = useState<LatLng | null>(null)
  const [guestCreates, setGuestCreates] = useState(0)
  const [paywallReason, setPaywallReason] = useState<string | null>(null)
  const [circularDistanceMeters, setCircularDistanceMetersState] = useState(25000)
  const [targetElevationGainMeters, setTargetElevationGainMetersState] = useState(0)
  const [circularSeed, setCircularSeed] = useState(0)
  const [wantAlternatives, setWantAlternatives] = useState(true)
  const [hydratedProfile, setHydratedProfile] = useState(false)
  const [hydratedStorage, setHydratedStorage] = useState(false)
  const calculateGenRef = useRef(0)

  useEffect(() => {
    if (hydratedStorage) return
    setGuestCreates(readGuestCreates())
    const last = readLastDraft()
    if (last?.geometry?.coordinates?.length) {
      setDraft(last)
      setWaypoints(last.waypoints ?? [])
      setBikeTypeState(last.bikeType || 'road')
      setRouteTypeState(last.type || 'a_to_b')
      if (last.circularDistanceMeters) setCircularDistanceMetersState(last.circularDistanceMeters)
      if (last.targetElevationGainMeters !== undefined) {
        setTargetElevationGainMetersState(last.targetElevationGainMeters)
      }
      setStatus('success')
    }
    setHydratedStorage(true)
  }, [hydratedStorage])

  useEffect(() => {
    if (!profile || hydratedProfile) return
    setBikeTypeState(profile.bikePreferences.bikeType || 'road')
    setPreferencesState(profile.bikePreferences.preferences || [])
    setHydratedProfile(true)
    // Signed-in (incl. anonymous) uses Firestore usage — drop local guest counter.
    setGuestCreates(0)
    writeGuestCreates(0)
  }, [profile, hydratedProfile])

  // Warm an anonymous Firebase session so Free limits apply before the first create.
  useEffect(() => {
    if (!isFirebaseConfigured()) return
    if (user) return
    void authService.signInGuest().catch((err) => {
      console.warn('[planner] anonymous warm-up', err)
    })
  }, [user])

  // Pull cloud draft when signing in if we don't already have a local one.
  useEffect(() => {
    if (!user || user.isAnonymous || !hydratedStorage) return
    if (draft) {
      void saveCloudDraft(user.uid, draft).catch(() => undefined)
      return
    }
    let cancelled = false
    void (async () => {
      const cloud = await loadCloudDraft(user.uid)
      if (cancelled || !cloud?.geometry?.coordinates?.length) return
      setDraft(cloud)
      setWaypoints(cloud.waypoints ?? [])
      setBikeTypeState(cloud.bikeType || 'road')
      setRouteTypeState(cloud.type || 'a_to_b')
      setStatus('success')
      persistDraft(cloud)
    })()
    return () => {
      cancelled = true
    }
  }, [user, hydratedStorage]) // eslint-disable-line react-hooks/exhaustive-deps

  const canCalculate = canCalculateRoute(routeType, waypoints)

  const value = useMemo<PlannerContextValue>(() => {
    async function runCalculate(seed = circularSeed): Promise<RouteDraft | null> {
      // Prefer anonymous Free quota over the offline guest counter.
      if (!profile && isFirebaseConfigured()) {
        try {
          await authService.signInGuest()
        } catch (err) {
          console.warn('[planner] anonymous before create', err)
        }
      }
      const liveProfile = profile ?? (await peekLiveProfile())
      const entitlement = canCreateRoute(liveProfile, guestCreates)
      if (!entitlement.ok) {
        const reason = entitlement.reason ?? 'create_limit'
        track('paywall_shown', { reason })
        setPaywallReason(reason)
        return null
      }
      if (routeType === 'circular' && !canUseAdvancedCircular(liveProfile)) {
        track('paywall_shown', { reason: 'circular_premium' })
        setPaywallReason('circular_premium')
        return null
      }
      if (!canCalculateRoute(routeType, waypoints)) {
        setErrorMessage(
          routeType === 'circular'
            ? 'Indica el punto de partida (búsqueda, mapa o Estoy aquí).'
            : 'Indica inicio y destino antes de crear la ruta.',
        )
        setStatus('error')
        return null
      }

      setStatus('calculating')
      setErrorMessage(null)
      const gen = ++calculateGenRef.current
      try {
        const prefs = clampPreferencesForPlan(preferences, liveProfile)
        if (prefs.length !== preferences.length) {
          setPreferencesState(prefs)
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
          wantAlternatives:
            wantAlternatives &&
            (routeType === 'a_to_b' || routeType === 'out_and_back' || routeType === 'map_trace')
              ? true
              : routeType === 'circular',
        })
        if (gen !== calculateGenRef.current) return null
        setDraft(result)
        persistDraft(result, user && !user.isAnonymous ? user.uid : null)
        setEditDraft(null)
        setStatus('success')
        // Monthly create counter is bumped by the Worker on successful routing.
        // Keep a local guest counter only when the profile has not hydrated yet.
        if (!liveProfile) {
          const nextGuest = guestCreates + 1
          setGuestCreates(nextGuest)
          writeGuestCreates(nextGuest)
        }
        // Soft Free trial: count Objetivo when the user is not Premium.
        if (routeType === 'circular') {
          if (liveProfile?.plan === 'premium') {
            /* unlimited */
          } else if (user && !user.isAnonymous && liveProfile) {
            void authService.recordFreeCircularUsed(user.uid).catch((err) => {
              console.warn('[planner] free circular', err)
            })
            track('free_trial_used', { kind: 'circular' })
          } else {
            consumeGuestCircular()
            track('free_trial_used', { kind: 'circular', guest: true })
          }
        }
        track('route_created', {
          distance_km: Math.round(result.stats.distanceMeters / 1000),
          bike_type: bikeType,
          route_type: routeType,
        })
        return result
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
        } else if (error instanceof RoutingError && error.code === 'create_limit') {
          setPaywallReason('create_limit')
          setErrorMessage(
            'Has alcanzado el límite de creaciones del plan Free este mes. Pasa a Premium para seguir creando rutas.',
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
        return null
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
        // Switching into Trazar with an existing route keeps geometry for "Ajustar en mapa".
        if (next === 'map_trace' && (draft || editDraft)) {
          const base = editDraft ?? draft
          if (base) {
            setEditDraft({ ...base })
            setWaypoints(base.waypoints)
            setWantAlternatives(true)
            setErrorMessage(null)
            setStatus('editing')
            return
          }
        }
        setDraft(null)
        persistDraft(null, user && !user.isAnonymous ? user.uid : null)
        setEditDraft(null)
        setErrorMessage(null)
        setStatus('idle')
        setCircularSeed(0)
        // Keep "varias opciones" for point-to-point modes; only clear for circular.
        if (next === 'circular') setWantAlternatives(false)
        else setWantAlternatives(true)
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
      setBikeType(next) {
        setBikeTypeState(next)
        // Changing modality invalidates the previous geometry (different costing).
        setDraft(null)
        persistDraft(null, user && !user.isAnonymous ? user.uid : null)
        setEditDraft(null)
        setErrorMessage(null)
        if (status === 'success' || status === 'editing') setStatus('idle')
      },
      setPreferences(next) {
        setPreferencesState(next)
        setDraft(null)
        persistDraft(null, user && !user.isAnonymous ? user.uid : null)
        setEditDraft(null)
        if (status === 'success' || status === 'editing') setStatus('idle')
      },
      setCircularDistanceMeters(meters) {
        setCircularDistanceMetersState(meters)
        setDraft(null)
        persistDraft(null, user && !user.isAnonymous ? user.uid : null)
        setEditDraft(null)
        if (status === 'success' || status === 'editing') setStatus('idle')
      },
      setTargetElevationGainMeters(meters) {
        setTargetElevationGainMetersState(meters)
        setDraft(null)
        persistDraft(null, user && !user.isAnonymous ? user.uid : null)
        setEditDraft(null)
        if (status === 'success' || status === 'editing') setStatus('idle')
      },
      setWantAlternatives,
      bumpCircularSeed() {
        setCircularSeed((s) => s + 1)
      },
      setHoverPoint,
      clearPaywall: () => setPaywallReason(null),
      showPaywall: (reason) => {
        track('paywall_shown', { reason })
        setPaywallReason(reason)
      },
      setStart(position, name) {
        setWaypoints((prev) => {
          const rest = prev.filter((w) => w.kind !== 'start')
          return [
            { id: 'start', name: name ?? 'Inicio', position, order: 0, kind: 'start' },
            ...rest.map((w, i) => ({ ...w, order: i + 1 })),
          ]
        })
        setEditDraft((prev) => {
          if (!prev) return prev
          const rest = prev.waypoints.filter((w) => w.kind !== 'start')
          return {
            ...prev,
            waypoints: [
              { id: 'start', name: name ?? 'Inicio', position, order: 0, kind: 'start' as const },
              ...rest.map((w, i) => ({ ...w, order: i + 1 })),
            ],
          }
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
        setEditDraft((prev) => {
          if (!prev) return prev
          const rest = prev.waypoints.filter((w) => w.kind !== 'end')
          const ordered = rest.map((w, i) => ({ ...w, order: i }))
          return {
            ...prev,
            waypoints: [
              ...ordered,
              {
                id: 'end',
                name: name ?? 'Destino',
                position,
                order: ordered.length,
                kind: 'end' as const,
              },
            ],
          }
        })
      },
      addVia(position, name) {
        setWaypoints((prev) => {
          const vias = prev.filter((w) => w.kind === 'via')
          if (vias.length >= 5) {
            setErrorMessage('Máximo 5 waypoints. Elimina uno o arrastra los marcadores.')
            return prev
          }
          const start = prev.find((w) => w.kind === 'start')
          const end = prev.find((w) => w.kind === 'end')
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
        setEditDraft((prev) => {
          if (!prev) return prev
          const vias = prev.waypoints.filter((w) => w.kind === 'via')
          if (vias.length >= 5) return prev
          const start = prev.waypoints.find((w) => w.kind === 'start')
          const end = prev.waypoints.find((w) => w.kind === 'end')
          const nextVia: Waypoint = {
            id: uid(),
            name: name ?? `Punto ${vias.length + 1}`,
            position,
            order: 0,
            kind: 'via',
          }
          return {
            ...prev,
            waypoints: [
              ...(start ? [start] : []),
              ...vias,
              nextVia,
              ...(end ? [end] : []),
            ].map((w, i) => ({ ...w, order: i })),
          }
        })
      },
      removeWaypoint(id) {
        setWaypoints((prev) =>
          prev
            .filter((w) => w.id !== id)
            .map((w, i) => ({ ...w, order: i })),
        )
        setEditDraft((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            waypoints: prev.waypoints
              .filter((w) => w.id !== id)
              .map((w, i) => ({ ...w, order: i })),
          }
        })
      },
      updateWaypointPosition(id, position, name) {
        const patch = (w: Waypoint): Waypoint =>
          w.id === id
            ? { ...w, position, ...(name !== undefined ? { name } : {}) }
            : w
        setWaypoints((prev) => prev.map(patch))
        if (editDraft) {
          setEditDraft({
            ...editDraft,
            waypoints: editDraft.waypoints.map(patch),
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
        const vias = waypoints.filter((w) => w.kind === 'via')
        if (vias.length >= 5) {
          setErrorMessage('Máximo 5 waypoints. Elimina uno o arrastra los marcadores.')
          return
        }
        // Trazar (Strava-style): each new tap extends the route — previous end becomes a via.
        if (routeType === 'map_trace') {
          setWaypoints((prev) => {
            const start = prev.find((w) => w.kind === 'start')
            const end = prev.find((w) => w.kind === 'end')
            const currentVias = prev.filter((w) => w.kind === 'via')
            const demoted: Waypoint | null = end
              ? { ...end, id: uid(), kind: 'via', name: end.name ?? label }
              : null
            return [
              ...(start ? [start] : []),
              ...currentVias,
              ...(demoted ? [demoted] : []),
              { id: 'end', name: label, position, order: 0, kind: 'end' as const },
            ].map((w, i) => ({ ...w, order: i }))
          })
          return
        }
        // A→B / ida-vuelta: insert via before the existing end.
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
        return runCalculate(circularSeed)
      },
      async calculateAnotherVariant() {
        const nextSeed = circularSeed + 1
        setCircularSeed(nextSeed)
        return runCalculate(nextSeed)
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
          persistDraft(result, user && !user.isAnonymous ? user.uid : null)
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
        if (!draft) return
        let options = draft.routeOptions
        if (!options?.length && draft.alternatives?.length) {
          options = [
            {
              id: 'opt-1',
              label: 'Opción 1',
              rank: 1,
              geometry: draft.geometry,
              elevationProfile: draft.elevationProfile,
              stats: draft.stats,
              instructions: draft.instructions,
              surfaceEdges: draft.surfaceEdges,
            },
            ...draft.alternatives.map((alt, i) => ({
              ...alt,
              id: alt.id || `opt-${i + 2}`,
              rank: i + 2,
            })),
          ]
        }
        const option = options?.[index]
        if (!option || !options) return
        const next = applySelectedOption({ ...draft, routeOptions: options }, option.id)
        setDraft(next)
        persistDraft(next, user && !user.isAnonymous ? user.uid : null)
      },
      selectRouteOption(optionId) {
        if (!draft?.routeOptions?.length) return
        const next = applySelectedOption(draft, optionId)
        setDraft(next)
        persistDraft(next, user && !user.isAnonymous ? user.uid : null)
      },
      setDraftFromImport(next) {
        setDraft(next)
        persistDraft(next, user && !user.isAnonymous ? user.uid : null)
        setWaypoints(next.waypoints)
        setBikeTypeState(next.bikeType)
        setRouteTypeState(next.type)
        setStatus('success')
        track('gpx_imported', { points: next.geometry.coordinates.length })
      },
      clearRoute() {
        // Full plan reset: points + draft. Keeps mode, bike and preferences.
        calculateGenRef.current += 1
        setWaypoints([])
        setDraft(null)
        persistDraft(null, user && !user.isAnonymous ? user.uid : null)
        setEditDraft(null)
        setHoverPoint(null)
        setCircularSeed(0)
        setStatus('idle')
        setErrorMessage(null)
        setPaywallReason(null)
        clearReadyRoute()
      },
      adjustOnMap() {
        if (!draft && !editDraft) return
        setRouteTypeState('map_trace')
        setWantAlternatives(true)
        setErrorMessage(null)
        const base = editDraft ?? draft
        if (base) {
          setEditDraft({ ...base })
          setWaypoints(base.waypoints)
          setStatus('editing')
        }
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
