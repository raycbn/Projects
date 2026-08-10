import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useGeolocation } from '@/hooks/useGeolocation'
import { Button } from '@/components/ui/Button'
import { takeGpsRoute, type GpsRoutePacket } from '@/lib/gpsRouteHandoff'
import { nearestPointOnRoute, routeProgress } from '@/lib/bikeCompare'
import { formatDistance } from '@/lib/stats'
import { buildSurfaceRouteOverlay } from '@/lib/surfaceRouteOverlay'
import type { Waypoint } from '@/domain/types'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

const OFF_ROUTE_M = 55

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

  const offRoute = nearest ? nearest.distanceMeters > OFF_ROUTE_M : false
  const currentInstruction = instructions[Math.min(step, Math.max(0, instructions.length - 1))]

  // Advance instruction roughly by progress along the list
  useEffect(() => {
    if (!instructions.length) return
    const idx = Math.min(instructions.length - 1, Math.floor(progress * instructions.length))
    setStep(idx)
  }, [progress, instructions.length])

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
    return buildSurfaceRouteOverlay(packet.geometry, null)
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

  return (
    <div className="flex h-[calc(100dvh-var(--header-h))] flex-col overflow-hidden">
      <section className="relative min-h-0 flex-1 bg-[var(--color-fog)]">
        <Suspense fallback={<p className="p-4 text-sm">Cargando mapa…</p>}>
          <MapView
            className="absolute inset-0"
            waypoints={waypoints}
            geometry={packet.geometry}
            surfaceOverlay={surfaceOverlay}
            showUserLocation={position}
            fitKey={`${coords.length}-${packet.title}`}
          />
        </Suspense>
        {offRoute && (
          <p className="absolute left-3 right-3 top-3 z-10 rounded-xl bg-[#fff4f4] px-3 py-2 text-sm font-semibold text-[var(--color-danger)] shadow">
            Fuera de ruta (~{Math.round(nearest?.distanceMeters ?? 0)} m). Vuelve al trazado.
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
            {position && nearest
              ? `${formatDistance(nearest.distanceMeters)} al track`
              : supported
                ? 'Buscando GPS…'
                : 'Sin GPS'}
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
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={step >= instructions.length - 1}
            onClick={() => setStep((s) => Math.min(instructions.length - 1, s + 1))}
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
