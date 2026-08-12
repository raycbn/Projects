import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { RouteWeatherPanel } from '@/components/route/RouteWeatherPanel'
import { RideChooserSheet } from '@/components/route/RideChooserSheet'
import {
  closeWhatsAppPlaceholder,
  openWhatsAppPlaceholder,
  shareRouteCard,
} from '@/lib/shareCard'
import { buildInstructionAtMeters, stashGpsRoute } from '@/lib/gpsRouteHandoff'
import { stashReadyRoute } from '@/lib/readyRouteHandoff'
import { buildRouteWindOverlay } from '@/lib/routeWindOverlay'
import {
  formatWeatherHourCaption,
  formatWeatherWindowCaption,
} from '@/lib/weatherFormat'
import { bearingLabel, windRelativePhrase } from '@/lib/wind'
import { track } from '@/lib/analytics'
import { canSaveRoute } from '@/services/EntitlementService'
import { routeRepository } from '@/services/RouteRepository'
import { alertService } from '@/services/AlertService'
import type { RouteDraft } from '@/domain/types'
import type { HourlyWeatherPoint, RideWindowAdvice } from '@/services/WeatherService'
import type { FeatureCollection } from 'geojson'

type Props = {
  draft: RouteDraft
  showPaywall: (reason: string) => void
  /** Parent paints these on MapView. */
  onWindOverlayChange?: (overlay: {
    overlay: FeatureCollection | null
    caption: string | null
    showArrows: boolean
    loading: boolean
  }) => void
}

/**
 * Salir a rodar / Compartir / Guardar + viento for Trazar (map-first) without
 * leaving the planner. Mirrors /ruta behaviour; keeps A→B / Objetivo untouched.
 */
export function TraceReadyPanel({ draft, showPaywall, onWindOverlayChange }: Props) {
  const navigate = useNavigate()
  const { user, profile, firebaseReady } = useAuth()
  const [rideOpen, setRideOpen] = useState(false)
  const [windOpen, setWindOpen] = useState(true)
  const [shareBusy, setShareBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null)
  const [selectedWindWindow, setSelectedWindWindow] = useState<RideWindowAdvice | null>(null)
  const [selectedWindHour, setSelectedWindHour] = useState<HourlyWeatherPoint | null>(null)
  const [showWindArrows, setShowWindArrows] = useState(true)
  const [windLoading, setWindLoading] = useState(false)
  const [bestLine, setBestLine] = useState<string | null>(null)
  const draftKey = `${draft.selectedOptionId ?? 'main'}-${Math.round(draft.stats.distanceMeters)}-${draft.geometry?.coordinates?.length ?? 0}`

  // New calculate / option → clear save id + action message for this draft.
  useEffect(() => {
    setSavedRouteId(null)
    setMessage(null)
  }, [draftKey])

  const windOverlay = useMemo(() => {
    if (!draft.geometry) return null
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
      return `${formatWeatherWindowCaption(selectedWindWindow.startHour, selectedWindWindow.endHour)} · ${selectedWindWindow.windSpeedKmh} km/h ${selectedWindWindow.windDirLabel} (${windRelativePhrase(selectedWindWindow.relative)})`
    }
    return null
  }, [selectedWindHour, selectedWindWindow])

  // Reset wind when geometry / option changes.
  useEffect(() => {
    setSelectedWindWindow(null)
    setSelectedWindHour(null)
    setBestLine(null)
    setWindLoading(Boolean(draft.geometry?.coordinates?.length))
  }, [draft.geometry, draft.selectedOptionId, draft.stats.distanceMeters])

  useEffect(() => {
    if (windOverlay?.features?.length) setWindLoading(false)
  }, [windOverlay])

  useEffect(() => {
    onWindOverlayChange?.({
      overlay: windOverlay,
      caption: windCaption,
      showArrows: showWindArrows,
      loading: windLoading,
    })
  }, [windOverlay, windCaption, showWindArrows, windLoading, onWindOverlayChange])

  function stashForRide() {
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
      const draftToSave: RouteDraft = selectedWindWindow
        ? {
            ...draft,
            bestWindWindow: {
              startHour: selectedWindWindow.startHour,
              endHour: selectedWindWindow.endHour,
              score: selectedWindWindow.score,
              label: selectedWindWindow.label,
              caption: formatWeatherWindowCaption(
                selectedWindWindow.startHour,
                selectedWindWindow.endHour,
              ),
            },
          }
        : draft
      if (savedRouteId) {
        await routeRepository.update(savedRouteId, user.uid, draftToSave)
        setMessage('Ruta actualizada en Mis rutas.')
      } else {
        const saved = await routeRepository.save(user.uid, draftToSave, { isPublic: false })
        setSavedRouteId(saved.id)
        stashReadyRoute({
          draft: draftToSave,
          savedRouteId: saved.id,
          shareSlug: saved.shareSlug ?? null,
          source: 'saved',
        })
        setMessage(
          draftToSave.bestWindWindow
            ? `Guardada · mejor ventana ${draftToSave.bestWindWindow.caption}`
            : 'Ruta guardada en Mis rutas.',
        )
      }
      track('route_saved', { distance_m: draft.stats.distanceMeters, via: 'trazar' })
      void alertService.notifyRouteSaved({
        routeTitle: draftToSave.title,
        distanceMeters: draftToSave.stats.distanceMeters,
        elevationGainMeters: draftToSave.stats.elevationGainMeters,
      })
    } catch (error) {
      console.error('[trazar] save', error)
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
    const waWindow = openWhatsAppPlaceholder()
    if (!user || user.isAnonymous || !firebaseReady || !routeRepository.isConfigured()) {
      closeWhatsAppPlaceholder(waWindow)
      setMessage('Inicia sesión con una cuenta real para publicar.')
      return
    }
    setShareBusy(true)
    setMessage('Publicando ruta…')
    try {
      const published = await routeRepository.publishForShare(user.uid, draft, {
        routeId: savedRouteId,
      })
      setSavedRouteId(published.routeId)
      const url = `${window.location.origin}/route/${published.shareSlug}`
      stashReadyRoute({
        draft,
        savedRouteId: published.routeId,
        shareSlug: published.shareSlug,
        source: 'calculate',
      })
      const result = await shareRouteCard(draft, url, { waWindow })
      setMessage(
        result === 'whatsapp' || result === 'shared'
          ? `WhatsApp listo · ${url}`
          : result === 'copied'
            ? `Mensaje copiado · ${url}`
            : `Enlace: ${url}`,
      )
      track('route_shared', { via: 'trazar', public: true, share_after: true })
      void alertService.notifyRouteSaved({
        routeTitle: draft.title,
        shareSlug: published.shareSlug,
        distanceMeters: draft.stats.distanceMeters,
        elevationGainMeters: draft.stats.elevationGainMeters,
      })
    } catch (error) {
      closeWhatsAppPlaceholder(waWindow)
      console.error('[trazar] share', error)
      const msg = error instanceof Error ? error.message : ''
      if (msg.includes('save_limit')) {
        showPaywall('save_limit')
        setMessage('Has alcanzado el límite de rutas guardadas en Free.')
        return
      }
      setMessage('No se pudo compartir la ruta.')
    } finally {
      setShareBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {bestLine ? (
        <button
          type="button"
          className="w-full rounded-2xl bg-[color-mix(in_oklab,var(--color-signal)_22%,white)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--color-forest)] ring-1 ring-[var(--color-trail)]/30"
          onClick={() => setWindOpen(true)}
        >
          Mejor salida · {bestLine}
        </button>
      ) : null}

      <Button className="w-full !py-3 text-base" onClick={() => setRideOpen(true)}>
        Salir a rodar
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={shareBusy} onClick={() => void handleShare()}>
          {shareBusy ? 'Publicando…' : 'Compartir'}
        </Button>
        <Button variant="ghost" disabled={saveBusy} onClick={() => void handleSave()}>
          {saveBusy ? 'Guardando…' : savedRouteId ? 'Actualizar' : 'Guardar'}
        </Button>
      </div>

      {message ? (
        <div
          className="rounded-2xl bg-[var(--color-mist)] px-3 py-3 text-sm text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]"
          role="status"
        >
          <p>{message}</p>
          {message.includes('Inicia sesión') ? (
            <Link className="mt-2 inline-block font-semibold text-[var(--color-trail)] underline" to="/login">
              Ir a login
            </Link>
          ) : null}
        </div>
      ) : null}

      <details
        className="rounded-2xl bg-[var(--color-mist)]/50"
        open={windOpen}
        onToggle={(e) => setWindOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--color-forest)]">
          Viento y mejor salida
        </summary>
        <div className="border-t border-[var(--color-fog)] px-1 pb-2 pt-1">
          <div className="mb-2 flex items-center justify-between gap-2 px-2">
            <p className="text-xs text-[var(--color-stone)]">
              {windLoading && !windOverlay?.features?.length
                ? 'Cargando viento…'
                : windCaption ?? 'Elige una hora o ventana'}
            </p>
            {windOverlay?.features?.length ? (
              <button
                type="button"
                className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]"
                aria-pressed={showWindArrows}
                onClick={() => setShowWindArrows((v) => !v)}
              >
                {showWindArrows ? 'Ocultar flechas' : 'Mostrar flechas'}
              </button>
            ) : null}
          </div>
          <RouteWeatherPanel
            route={draft}
            selectedWindow={selectedWindWindow}
            selectedHour={selectedWindHour}
            onSelectWindow={(w) => {
              setSelectedWindWindow(w)
              setSelectedWindHour(null)
              if (w) {
                setBestLine(
                  `${formatWeatherWindowCaption(w.startHour, w.endHour)} · ${w.label}`,
                )
              }
            }}
            onSelectHour={(h) => {
              setSelectedWindHour(h)
              if (h) {
                setBestLine(`${formatWeatherHourCaption(h.time)} · ${h.windSpeedKmh} km/h`)
              }
            }}
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
              if (!selectedWindHour && !selectedWindWindow) {
                setSelectedWindWindow(best)
              }
            }}
          />
        </div>
      </details>

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
          stashReadyRoute({ draft, savedRouteId, source: 'calculate' })
          setRideOpen(false)
          navigate('/ruta')
        }}
      />
    </div>
  )
}
