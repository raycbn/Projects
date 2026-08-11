import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
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
import { routeRepository } from '@/services/RouteRepository'
import { canSaveRoute } from '@/services/EntitlementService'
import { formatDistance, formatElevation } from '@/lib/stats'
import {
  formatWeatherWindowCaption,
} from '@/lib/weatherFormat'
import { track } from '@/lib/analytics'
import type { RouteDraft } from '@/domain/types'
import { applySelectedOption } from '@/lib/routeOptions'
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

export function ReadyRoutePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile, firebaseReady } = useAuth()
  const { draft: plannerDraft, showPaywall, paywallReason, clearPaywall, selectRouteOption } =
    usePlanner()

  const [packet, setPacket] = useState<ReadyRoutePacket | null>(() => peekReadyRoute())
  const [rideOpen, setRideOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [windOpen, setWindOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedWindWindow, setSelectedWindWindow] = useState<RideWindowAdvice | null>(null)
  const [selectedWindHour, setSelectedWindHour] = useState<HourlyWeatherPoint | null>(null)
  const [bestLine, setBestLine] = useState<string | null>(null)

  const draft = packet?.draft ?? null

  usePageMeta({
    title: draft ? `${draft.title || 'Ruta lista'} | PedalMap` : 'Ruta lista | PedalMap',
    description: draft
      ? `${formatDistance(draft.stats.distanceMeters)} · ${formatElevation(draft.stats.elevationGainMeters)}`
      : 'Tu ruta lista para salir, guardar o compartir.',
    path: '/ruta',
  })

  // Prefer planner draft if we just calculated; else session packet; else load by routeId.
  useEffect(() => {
    const routeId = params.get('routeId')
    if (plannerDraft?.geometry) {
      const next = {
        draft: plannerDraft,
        savedRouteId: packet?.savedRouteId ?? null,
        shareSlug: packet?.shareSlug ?? null,
      }
      stashReadyRoute(next)
      setPacket(next)
      return
    }
    if (packet?.draft) return
    if (!routeId || !firebaseReady) return
    let cancelled = false
    void routeRepository.getById(routeId).then((route) => {
      if (cancelled || !route) return
      const next: ReadyRoutePacket = {
        draft: route,
        savedRouteId: route.id,
        shareSlug: route.shareSlug ?? null,
      }
      stashReadyRoute(next)
      setPacket(next)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerDraft, params, firebaseReady])

  const fitKey = useMemo(
    () =>
      draft
        ? `${draft.stats.distanceMeters}-${draft.geometry.coordinates.length}-${draft.selectedOptionId ?? 'main'}`
        : 'empty',
    [draft],
  )

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
      const saved = await routeRepository.save(user.uid, draft, { isPublic: false })
      const next = { draft, savedRouteId: saved.id, shareSlug: saved.shareSlug ?? null }
      stashReadyRoute(next)
      setPacket(next)
      setMessage('Ruta guardada en Mis rutas.')
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
    <main className="mx-auto flex min-h-[calc(100dvh-var(--header-h,3.5rem))] max-w-6xl flex-col pb-28 lg:pb-8">
      <div className="relative min-h-[48vh] flex-1 bg-[var(--color-fog)] lg:min-h-[55vh]">
        <Suspense
          fallback={
            <div className="flex h-full min-h-[48vh] items-center justify-center text-sm text-[var(--color-stone)]">
              Cargando mapa…
            </div>
          }
        >
          <MapView
            className="absolute inset-0 h-full w-full"
            waypoints={draft.waypoints}
            geometry={draft.geometry}
            fitKey={fitKey}
            interactive={false}
          />
        </Suspense>
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
              {saveBusy ? 'Guardando…' : 'Guardar'}
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
            to="/route-planner"
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
        }}
      />

      {paywallReason && <PremiumCard reason={paywallReason} onClose={clearPaywall} />}
    </main>
  )
}
