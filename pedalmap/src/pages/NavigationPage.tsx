import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useGeolocation } from '@/hooks/useGeolocation'
import { Button } from '@/components/ui/Button'
import {
  instructionStepFromDistance,
  takeGpsRoute,
  type GpsRoutePacket,
} from '@/lib/gpsRouteHandoff'
import {
  nearestPointOnRoute,
  offRouteThresholdMeters,
  routeProgress,
} from '@/lib/bikeCompare'
import { formatDistance, pathDistanceMeters } from '@/lib/stats'
import { buildSurfaceRouteOverlay } from '@/lib/surfaceRouteOverlay'
import type { Waypoint } from '@/domain/types'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

/** How long you must stay beyond the threshold before the red banner appears. */
const OFF_ROUTE_HOLD_MS = 12_000

/**
 * Guided ride: follow planned geometry + next instruction + off-route warning.
 */
export function NavigationPage() {
  usePageMeta({
    title: 'Navegación | PedalMap',
    description: 'Sigue tu ruta PedalMap con GPS, indicaciones y aviso si te sales.',
    path: '/navegacion',
  })

  const [packet, setPacket] = useState<GpsRoutePacket | null>(null)
  const [instructions, setInstructions] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const [voice, setVoice] = useState(false)
  const [followReady, setFollowReady] = useState(false)
  const [offRouteAlert, setOffRouteAlert] = useState(false)
  const offRouteSince = useRef<number | null>(null)
  const userPinnedStep = useRef(false)
  const { sample, error, supported } = useGeolocation(true)

  useEffect(() => {
    const p = takeGpsRoute()
    setPacket(p)
    if (p?.instructions?.length) {
      setInstructions(p.instructions)
      return
    }
    try {
      const raw = sessionStorage.getItem('pedalmap_nav_instructions')
      if (raw) setInstructions(JSON.parse(raw) as string[])
    } catch {
      /* ignore */
    }
  }, [])

  const coords = packet?.geometry?.coordinates ?? []
  const position = sample?.position
  const nearest = useMemo(() => {
    if (!position || coords.length < 2) return null
    return nearestPointOnRoute(position, coords)
  }, [position, coords])

  const progress = useMemo(() => {
    if (!position || coords.length < 2) return 0
    return routeProgress(position, coords)
  }, [position, coords])

  const totalMeters = useMemo(() => {
    if (coords.length < 2) return 0
    return pathDistanceMeters(coords.map(([lng, lat]) => ({ lng, lat })))
  }, [coords])

  const thresholds = useMemo(() => {
    if (packet?.instructionAtMeters?.length) return packet.instructionAtMeters
    if (!instructions.length || totalMeters <= 0) return []
    return instructions.map((_, i) => (totalMeters * i) / instructions.length)
  }, [packet?.instructionAtMeters, instructions, totalMeters])

  const alongMeters = progress * totalMeters

  useEffect(() => {
    if (position) setFollowReady(true)
  }, [position])

  useEffect(() => {
    const distance = nearest?.distanceMeters
    if (distance == null) {
      offRouteSince.current = null
      setOffRouteAlert(false)
      return
    }

    const threshold = offRouteThresholdMeters(sample?.accuracyMeters)
    // Standing near the start with phone GPS jitter (~50–100 m) is normal — don't panic.
    const nearStart = progress < 0.04 && distance < Math.max(250, threshold + 40)
    const beyond = distance > threshold && !nearStart

    if (!beyond) {
      offRouteSince.current = null
      setOffRouteAlert(false)
      return
    }

    const now = Date.now()
    if (offRouteSince.current == null) offRouteSince.current = now
    if (now - offRouteSince.current >= OFF_ROUTE_HOLD_MS) {
      setOffRouteAlert(true)
    }
  }, [nearest?.distanceMeters, progress, sample?.accuracyMeters])

  const currentInstruction = instructions[Math.min(step, Math.max(0, instructions.length - 1))]

  // Advance by distance along the route; manual prev/next holds until GPS catches up forward.
  useEffect(() => {
    if (!thresholds.length) return
    const auto = instructionStepFromDistance(alongMeters, thresholds)
    setStep((prev) => {
      if (userPinnedStep.current && auto <= prev) return prev
      userPinnedStep.current = false
      return auto
    })
  }, [alongMeters, thresholds])

  useEffect(() => {
    if (!voice || !currentInstruction || typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return
    const utter = new SpeechSynthesisUtterance(currentInstruction)
    utter.lang = 'es-ES'
    utter.rate = 1.05
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }, [voice, step, currentInstruction])

  const waypoints: Waypoint[] = useMemo(() => {
    if (coords.length < 2) return []
    const start = coords[0]
    const end = coords[coords.length - 1]
    return [
      {
        id: 'start',
        name: 'Inicio',
        kind: 'start',
        order: 0,
        position: { lng: start[0], lat: start[1] },
      },
      {
        id: 'end',
        name: 'Fin',
        kind: 'end',
        order: 1,
        position: { lng: end[0], lat: end[1] },
      },
    ]
  }, [coords])

  const surfaceOverlay = useMemo(() => {
    if (!packet?.geometry) return null
    return buildSurfaceRouteOverlay(packet.geometry, packet.surfaceEdges ?? null)
  }, [packet])

  if (!packet?.geometry?.coordinates?.length) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 pb-28">
        <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
          Navegación
        </h1>
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          Primero crea una ruta y pulsa <strong>Navegar</strong> o <strong>Iniciar GPS</strong> desde
          el planificador.
        </p>
        <Link to="/route-planner" className="mt-6 inline-block">
          <Button>Ir a crear ruta</Button>
        </Link>
      </main>
    )
  }

  const distanceLabel =
    position && nearest
      ? nearest.distanceMeters < 40
        ? 'En el trazado'
        : `${formatDistance(nearest.distanceMeters)} al track`
      : supported
        ? 'Buscando GPS…'
        : 'Sin GPS'

  return (
    <div className="planner-shell flex flex-col overflow-hidden">
      <section className="relative min-h-0 flex-1 bg-[var(--color-fog)]">
        <Suspense
          fallback={
            <p className="flex h-full items-center justify-center p-4 text-sm text-[var(--color-stone)]">
              Cargando mapa…
            </p>
          }
        >
          <MapView
            className="h-full w-full"
            waypoints={waypoints}
            geometry={packet.geometry}
            surfaceOverlay={surfaceOverlay}
            showUserLocation={position}
            followUser={Boolean(position)}
            fitKey={followReady ? undefined : `${coords.length}-${packet.title}`}
          />
        </Suspense>
        {!position && supported && !error && (
          <p className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-center text-sm font-medium text-[var(--color-forest)] shadow">
            Activando GPS… acepta el permiso de ubicación si el móvil lo pide.
          </p>
        )}
        {offRouteAlert && (
          <p className="absolute left-3 right-3 top-3 z-10 rounded-xl bg-[#fff4f4] px-3 py-2 text-sm font-semibold text-[var(--color-danger)] shadow">
            Te has alejado del trazado (~{Math.round(nearest?.distanceMeters ?? 0)} m). Vuelve a la
            ruta cuando puedas.
          </p>
        )}
      </section>

      <aside className="shrink-0 space-y-3 border-t border-[var(--color-fog)] bg-white p-4 safe-pb">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-caps text-[var(--color-trail)]">Siguiente</p>
            <p className="mt-1 font-display text-lg font-bold text-[var(--color-forest)]">
              {currentInstruction || 'Sigue el trazado de la ruta'}
            </p>
          </div>
          <p className="text-right text-xs text-[var(--color-stone)]">
            {Math.round(progress * 100)}%
            <br />
            {distanceLabel}
          </p>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-mist)]">
          <div
            className="h-full rounded-full bg-[var(--color-signal)] transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        {(error || !supported) && (
          <p className="text-xs text-[var(--color-danger)]">
            {error || 'Este dispositivo no soporta geolocalización.'}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={voice ? 'secondary' : 'ghost'}
            onClick={() => setVoice((v) => !v)}
          >
            {voice ? 'Voz on' : 'Voz off'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={step <= 0}
            onClick={() => {
              userPinnedStep.current = true
              setStep((s) => Math.max(0, s - 1))
            }}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={step >= instructions.length - 1}
            onClick={() => {
              userPinnedStep.current = true
              setStep((s) => Math.min(instructions.length - 1, s + 1))
            }}
          >
            Siguiente
          </Button>
          <Link to="/actividad">
            <Button size="sm" variant="secondary">
              Grabar actividad
            </Button>
          </Link>
        </div>
      </aside>
    </div>
  )
}
