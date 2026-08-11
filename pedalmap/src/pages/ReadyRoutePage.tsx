import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { usePlanner } from '@/app/PlannerContext'
import { Button } from '@/components/ui/Button'
import { RouteSummary } from '@/components/route/RouteSummary'
import { ElevationChart } from '@/components/route/ElevationChart'
import { RouteWeatherPanel } from '@/components/route/RouteWeatherPanel'
import { GpsExportPanel } from '@/components/gpx/GpsExportPanel'
import { RideChooserSheet } from '@/components/route/RideChooserSheet'
import { PremiumCard } from '@/components/premium/PremiumCard'
import { usePageMeta } from '@/hooks/usePageMeta'
import { peekReadyRoute, stashReadyRoute, type ReadyRoutePacket } from '@/lib/readyRouteHandoff'
import { buildInstructionAtMeters, stashGpsRoute } from '@/lib/gpsRouteHandoff'
import { shareRouteCard } from '@/lib/shareCard'
import { routeRepository, geometryFromStored } from '@/services/RouteRepository'
import { canSaveRoute } from '@/services/EntitlementService'
import { formatDistance, formatElevation } from '@/lib/stats'
import {
  formatWeatherHourCaption,
  formatWeatherWindowCaption,
} from '@/lib/weatherFormat'
import { buildRouteWindOverlay } from '@/lib/routeWindOverlay'
import { buildSurfaceRouteOverlay } from '@/lib/surfaceRouteOverlay'
import { bearingLabel } from '@/lib/wind'
import { track } from '@/lib/analytics'
import { applySelectedOption } from '@/lib/routeOptions'
import type { RouteDraft } from '@/domain/types'
import type { HourlyWeatherPoint, RideWindowAdvice } from '@/services/WeatherService'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

function bikeLabel(bike: RouteDraft['bikeType']): string {
  switch (bike) {
    case 'road':
      return 'Carretera'
    case 'mtb':
      return 'MTB'
    case 'gravel':
      return 'Gravel'
    case 'urban':
      return 'Urbana'
    case 'ebike':
      return 'E-bike'
    default:
      return bike
  }
}

function normalizeDraftGeometry(draft: RouteDraft): RouteDraft {
  return {
    ...draft,
    geometry: geometryFromStored(draft.geometry),
  }
}

export function ReadyRoutePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile, firebaseReady } = useAuth()
  const { showPaywall, paywallReason, clearPaywall, selectRouteOption } = usePlanner()

  const [packet, setPacket] = useState<ReadyRoutePacket | null>(() => peekReadyRoute())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rideOpen, setRideOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [windOpen, setWindOpen] = useState(true)
  const [shareBusy, setShareBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedWindWindow, setSelectedWindWindow] = useState<RideWindowAdvice | null>(null)
  const [selectedWindHour, setSelectedWindHour] = useState<HourlyWeatherPoint | null>(null)
  const [bestLine, setBestLine] = useState<string | null>(null)
  const [showWindArrows, setShowWindArrows] = useState(true)
  const [windLoading, setWindLoading] = useState(false)
  const exportRef = useRef<HTMLDetailsElement | null>(null)

  const routeIdParam = params.get('routeId')
  const draft = packet?.draft ? normalizeDraftGeometry(packet.draft) : null

  usePageMeta({
    title: draft ? `${draft.title || 'Ruta lista'} | PedalMap` : 'Ruta lista | PedalMap',
    description: draft
      ? `${formatDistance(draft.stats.distanceMeters)} · ${formatElevation(draft.stats.elevationGainMeters)}`
      : 'Tu ruta lista para salir, guardar o compartir.',
    path: '/ruta',
  })

  // Abrir desde Mis rutas: routeId gana siempre (no mezclar con draft del planner).
  useEffect(() => {
    if (!routeIdParam) return
    if (!firebaseReady || !routeRepository.isConfigured()) return
    let cancelled = false
    setLoadError(null)
    void routeRepository
      .getById(routeIdParam)
      .then((route) => {
        if (cancelled) return
        if (!route) {
          setLoadError('No encontramos esa ruta guardada.')
          return
        }
        const next: ReadyRoutePacket = {
          draft: route,
          savedRouteId: route.id,
          shareSlug: route.shareSlug ?? null,
          source: 'saved',
        }
        stashReadyRoute(next)
        setPacket(next)
      })
      .catch((err) => {
        console.error('[ready-route] load', err)
        if (!cancelled) setLoadError('No se pudo cargar la ruta.')
      })
    return () => {
      cancelled = true
    }
  }, [routeIdParam, firebaseReady])

  // Sin routeId: usar handoff de session (tras Crear ruta) si hace falta.
  useEffect(() => {
    if (routeIdParam) return
    if (packet?.draft) return
    const peeked = peekReadyRoute()
    if (peeked?.draft) {
      setPacket(peeked)
    }
  }, [routeIdParam, packet?.draft])

  const fitKey = useMemo(
    () =>
      draft
        ? `${draft.stats.distanceMeters}-${draft.geometry.coordinates.length}-${draft.selectedOptionId ?? 'main'}`
        : 'empty',
    [draft],
  )

  const windOverlay = useMemo(() => {
    if (!draft?.geometry) return null
    if (!selectedWindHour && !selectedWindWindow) return null
    return buildRouteWindOverlay(draft.geometry, {
      routeType: draft.type,
      hour: selectedWindHour,
      window: selectedWindHour ? null : selectedWindWindow,
    })
  }, [draft, selectedWindHour, selectedWindWindow])

  const windCaption = useMemo(() => {
    if (selectedWindHour) {
      return `${formatWeatherHourCaption(selectedWindHour.time)} · ${selectedWindHour.windSpeedKmh} km/h ${bearingLabel(selectedWindHour.windDirectionDeg)}`
    }
    if (selectedWindWindow) {
      return `${formatWeatherWindowCaption(selectedWindWindow.startHour, selectedWindWindow.endHour)} · ${selectedWindWindow.windSpeedKmh} km/h ${selectedWindWindow.windDirLabel} (${selectedWindWindow.relative})`
    }
    return null
  }, [selectedWindHour, selectedWindWindow])

  const surfaceOverlay = useMemo(() => {
    if (!draft?.geometry) return null
    return buildSurfaceRouteOverlay(draft.geometry, draft.surfaceEdges)
  }, [draft])

  // Show map "Cargando viento…" until the first forecast paints an overlay.
  useEffect(() => {
    if (!draft?.geometry?.coordinates?.length) return
    setWindLoading(true)
  }, [draft?.geometry, draft?.selectedOptionId, draft?.stats.distanceMeters])

  useEffect(() => {
    if (windOverlay?.features?.length) setWindLoading(false)
  }, [windOverlay])

  function stashForRide() {
    if (!draft) return
    stashGpsRoute({
      title: draft.title || 'Salida PedalMap',
      bikeType: draft.bikeType,
      geometry: draft.geometry,
      instructions: draft.instructions,
      instructionAtMeters: buildInstructionAtMeters(
        draft.instructions,
        draft.stats.distanceMeters,
      ),
      surfaceEdges: draft.surfaceEdges,
    })
  }

  async function handleSave() {
    if (!draft) return
    if (!user || user.isAnonymous) {
      setMessage('Inicia sesión para guardar esta ruta.')
      return
    }
    const entitlement = canSaveRoute(profile)
    if (!entitlement.ok) {
      showPaywall(entitlement.reason ?? 'save_limit')
      return
    }
    if (!firebaseReady || !routeRepository.isConfigured()) {
      setMessage('Firebase no está configurado.')
      return
    }
    setSaveBusy(true)
    setMessage(null)
    try {
      if (packet?.savedRouteId) {
        await routeRepository.update(packet.savedRouteId, user.uid, draft)
        setMessage('Ruta actualizada en Mis rutas.')
      } else {
        const saved = await routeRepository.save(user.uid, draft, { isPublic: false })
        const next = {
          draft,
          savedRouteId: saved.id,
          shareSlug: saved.shareSlug ?? null,
          source: 'saved' as const,
        }
        stashReadyRoute(next)
        setPacket(next)
        setMessage('Ruta guardada en Mis rutas.')
      }
      track('route_saved', { distance_m: draft.stats.distanceMeters, via: 'ready_route' })
    } catch (error) {
      console.error('[ready-route] save', error)
      const msg = error instanceof Error ? error.message : ''
      if (msg === 'save_limit' || msg.includes('permission')) {
        showPaywall('save_limit')
        return
      }
      setMessage('No se pudo guardar la ruta.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function handleShare() {
    if (!draft) return
    if (!user || user.isAnonymous || !firebaseReady || !routeRepository.isConfigured()) {
      setMessage('Inicia sesión con una cuenta real para compartir el enlace completo.')
      return
    }
    setShareBusy(true)
    setMessage('Publicando ruta…')
    try {
      const published = await routeRepository.publishForShare(user.uid, draft, {
        routeId: packet?.savedRouteId,
      })
      const next = {
        draft,
        savedRouteId: published.routeId,
        shareSlug: published.shareSlug,
        source: packet?.source ?? ('calculate' as const),
      }
      stashReadyRoute(next)
      setPacket(next)
      const url = `${window.location.origin}/route/${published.shareSlug}`
      const result = await shareRouteCard(draft, url)
      setMessage(
        result === 'whatsapp' || result === 'shared'
          ? `WhatsApp listo · ${url}`
          : result === 'copied'
            ? `Mensaje copiado · ${url}`
            : `Enlace: ${url}`,
      )
      track('route_shared', { via: 'ready_route', public: true })
    } catch (error) {
      console.error('[ready-route] share', error)
      const msg = error instanceof Error ? error.message : ''
      setMessage(
        msg
          ? `No se pudo publicar (${msg.replace(/^(save_failed:|worker_publish:)/, '')}).`
          : 'No se pudo compartir la ruta.',
      )
    } finally {
      setShareBusy(false)
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 pb-28 text-center">
        <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
          Ruta no disponible
        </h1>
        <p className="mt-3 text-[var(--color-stone)]">{loadError}</p>
        <Link to="/my-routes" className="mt-8 inline-block">
          <Button>Mis rutas</Button>
        </Link>
      </main>
    )
  }

  if (!draft) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 pb-28 text-center">
        <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
          Aún no hay ruta lista
        </h1>
        <p className="mt-3 text-[var(--color-stone)]">
          Calcula una ruta en el planificador y volverás aquí para salir, guardar o compartir.
        </p>
        <Link to="/route-planner" className="mt-8 inline-block">
          <Button>Crear ruta</Button>
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl pb-10">
      {/* Explicit height — MapLibre needs a real computed height, not only min-height + h-full */}
      <div className="relative h-[min(52vh,28rem)] w-full overflow-hidden bg-[var(--color-fog)] sm:h-[min(58vh,34rem)]">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-[var(--color-stone)]">
              Cargando mapa…
            </div>
          }
        >
          <MapView
            className="absolute inset-0 h-full w-full"
            waypoints={draft.waypoints}
            geometry={draft.geometry}
            windOverlay={windOverlay}
            windCaption={windCaption}
            showWindArrows={showWindArrows}
            surfaceOverlay={surfaceOverlay}
            fitKey={fitKey}
            interactive={false}
          />
        </Suspense>
        {windLoading && !windOverlay?.features?.length ? (
          <p className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-[var(--color-forest)] shadow-sm ring-1 ring-[var(--color-fog)]">
            Cargando viento…
          </p>
        ) : null}
        {windOverlay?.features?.length ? (
          <button
            type="button"
            className="absolute right-3 top-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-[var(--color-forest)] shadow-sm ring-1 ring-[var(--color-fog)]"
            aria-pressed={showWindArrows}
            onClick={() => setShowWindArrows((v) => !v)}
          >
            {showWindArrows ? 'Ocultar flechas' : 'Mostrar flechas'}
          </button>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
            PedalMap · Ruta lista
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-[var(--color-forest)]">
            {draft.title || 'Tu ruta'}
          </h1>
          <p className="mt-2 text-[var(--color-stone)]">
            {formatDistance(draft.stats.distanceMeters)} ·{' '}
            {formatElevation(draft.stats.elevationGainMeters)} · {bikeLabel(draft.bikeType)}
          </p>
          {bestLine && (
            <button
              type="button"
              className="mt-3 w-full rounded-2xl bg-[color-mix(in_oklab,var(--color-signal)_22%,white)] px-3 py-3 text-left text-sm font-semibold text-[var(--color-forest)] ring-1 ring-[var(--color-trail)]/30"
              onClick={() => setWindOpen(true)}
            >
              Mejor salida · {bestLine}
            </button>
          )}
        </div>

        <div className="space-y-2">
          <Button className="w-full !py-3 text-base" onClick={() => setRideOpen(true)}>
            Salir a rodar
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={shareBusy} onClick={() => void handleShare()}>
              {shareBusy ? 'Publicando…' : 'Compartir'}
            </Button>
            <Button variant="ghost" disabled={saveBusy} onClick={() => void handleSave()}>
              {saveBusy ? 'Guardando…' : packet?.savedRouteId ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </div>

        {(draft.routeOptions?.length ?? 0) > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
              Opciones
            </p>
            {draft.routeOptions!.map((opt) => {
              const active = (draft.selectedOptionId ?? draft.routeOptions![0]?.id) === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={
                    active
                      ? 'w-full rounded-xl bg-[var(--color-signal)] px-3 py-2 text-left text-xs font-semibold'
                      : 'w-full rounded-xl bg-[var(--color-mist)] px-3 py-2 text-left text-xs font-semibold ring-1 ring-[var(--color-fog)]'
                  }
                  onClick={() => {
                    selectRouteOption(opt.id)
                    if (!packet?.draft?.routeOptions) return
                    const nextDraft = applySelectedOption(packet.draft, opt.id)
                    const next = { ...packet, draft: nextDraft }
                    stashReadyRoute(next)
                    setPacket(next)
                  }}
                >
                  {opt.label}
                  {active ? ' · activa' : ''} · {formatDistance(opt.stats.distanceMeters)} ·{' '}
                  {formatElevation(opt.stats.elevationGainMeters)}
                </button>
              )
            })}
          </div>
        )}

        <RouteSummary stats={draft.stats} />
        <ElevationChart profile={draft.elevationProfile} />

        <details
          className="rounded-2xl bg-[var(--color-mist)]/50"
          open={windOpen}
          onToggle={(e) => setWindOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--color-forest)]">
            Viento y mejor salida
          </summary>
          <div className="border-t border-[var(--color-fog)] px-1 pb-2 pt-1">
            <RouteWeatherPanel
              route={draft}
              selectedWindow={selectedWindWindow}
              selectedHour={selectedWindHour}
              onForecast={(f) => {
                setWindLoading(false)
                const best = f?.windows?.[0]
                if (!best) {
                  setBestLine(null)
                  return
                }
                setBestLine(
                  `${formatWeatherWindowCaption(best.startHour, best.endHour)} · ${best.label}`,
                )
              }}
              onSelectWindow={(w) => {
                setSelectedWindWindow(w)
                if (w) setSelectedWindHour(null)
              }}
              onSelectHour={(h) => {
                setSelectedWindHour(h)
                if (h) setSelectedWindWindow(null)
              }}
            />
          </div>
        </details>

        <details
          ref={exportRef}
          className="rounded-2xl bg-[var(--color-mist)]/50"
          open={exportOpen}
          onToggle={(e) => setExportOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--color-forest)]">
            Exportar GPX / apps GPS
          </summary>
          <div className="border-t border-[var(--color-fog)] px-1 pb-2 pt-1">
            <GpsExportPanel
              route={draft}
              onPremiumRequired={() => showPaywall('gpx_export')}
            />
          </div>
        </details>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            to={
              packet?.savedRouteId
                ? `/route-planner?routeId=${packet.savedRouteId}&edit=1`
                : '/route-planner'
            }
            className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
          >
            Editar en el planificador
          </Link>
          <Link
            to="/my-routes"
            className="font-semibold text-[var(--color-stone)] underline-offset-2 hover:underline"
          >
            Mis rutas
          </Link>
        </div>

        {message && (
          <p className="text-sm text-[var(--color-trail)]">
            {message}{' '}
            {message.includes('Inicia sesión') && (
              <Link className="underline" to="/login">
                Ir a login
              </Link>
            )}
          </p>
        )}
      </div>

      <RideChooserSheet
        open={rideOpen}
        onClose={() => setRideOpen(false)}
        onNavigate={() => {
          stashForRide()
          setRideOpen(false)
          if (!draft.instructions?.length) {
            setMessage('Navegación abierta. Esta ruta no tiene indicaciones paso a paso guardadas.')
          }
          navigate('/navegacion')
        }}
        onRecord={() => {
          stashForRide()
          setRideOpen(false)
          navigate(
            `/actividad?title=${encodeURIComponent(draft.title || 'Salida PedalMap')}&bike=${draft.bikeType}`,
          )
        }}
        onExportGpx={() => {
          setRideOpen(false)
          setExportOpen(true)
          window.setTimeout(() => {
            exportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 50)
        }}
      />

      {paywallReason && <PremiumCard reason={paywallReason} onClose={clearPaywall} />}
    </main>
  )
}
