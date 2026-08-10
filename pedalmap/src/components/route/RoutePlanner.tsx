import { lazy, Suspense, startTransition, useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlanner } from '@/app/PlannerContext'
import { useAuth } from '@/app/AuthContext'
import { SearchLocation } from '@/components/route/SearchLocation'
import { BikeSelector } from '@/components/route/BikeSelector'
import { BikeComparePanel } from '@/components/route/BikeComparePanel'
import { RoutePreferencesPanel } from '@/components/route/RoutePreferences'
import { RouteSummary } from '@/components/route/RouteSummary'
import { ElevationChart } from '@/components/route/ElevationChart'
import { PremiumCard } from '@/components/premium/PremiumCard'
import { Button } from '@/components/ui/Button'
import { GPXImporter } from '@/components/gpx/GPXImporter'
import { GpsExportPanel } from '@/components/gpx/GpsExportPanel'
import { RouteWeatherPanel } from '@/components/route/RouteWeatherPanel'
import { routeRepository } from '@/services/RouteRepository'
import { canSaveRoute } from '@/services/EntitlementService'
import { authService } from '@/services/AuthService'
import { track } from '@/lib/analytics'
import { routeService } from '@/services/RouteService'
import { formatDistance, formatElevation } from '@/lib/stats'
import { buildRouteWindOverlay } from '@/lib/routeWindOverlay'
import { buildSurfaceRouteOverlay, summarizeUnpavedAlert } from '@/lib/surfaceRouteOverlay'
import { compareBikesForWaypoints, type BikeCompareRow } from '@/lib/bikeCompare'
import { shareRouteCard } from '@/lib/shareCard'
import { stashGpsRoute } from '@/lib/gpsRouteHandoff'
import {
  formatWeatherHourCaption,
  formatWeatherWindowCaption,
} from '@/lib/weatherFormat'
import type { HourlyWeatherPoint, RideWindowAdvice } from '@/services/WeatherService'
import clsx from 'clsx'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

export function RoutePlanner() {
  const {
    status,
    errorMessage,
    routeType,
    setRouteType,
    bikeType,
    setBikeType,
    preferences,
    setPreferences,
    waypoints,
    setStart,
    setEnd,
    addVia,
    removeWaypoint,
    moveWaypoint,
    draft,
    editDraft,
    hoverPoint,
    setHoverPoint,
    calculate,
    calculateAnotherVariant,
    startEditing,
    cancelEditing,
    saveEdits,
    selectAlternative,
    selectRouteOption,
    paywallReason,
    clearPaywall,
    showPaywall,
    updateWaypointPosition,
    circularDistanceMeters,
    setCircularDistanceMeters,
    targetElevationGainMeters,
    setTargetElevationGainMeters,
    wantAlternatives,
    setWantAlternatives,
    setDraftFromImport,
    handleMapTap,
    useMyLocationAsStart,
    canCalculate,
  } = usePlanner()
  const { user, profile, firebaseReady } = useAuth()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [viaQueryOpen, setViaQueryOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareRows, setCompareRows] = useState<BikeCompareRow[] | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [selectedWindWindow, setSelectedWindWindow] = useState<RideWindowAdvice | null>(null)
  const [selectedWindHour, setSelectedWindHour] = useState<HourlyWeatherPoint | null>(null)
  const deferredWindHour = useDeferredValue(selectedWindHour)
  const deferredWindWindow = useDeferredValue(selectedWindWindow)

  const activeDraft = editDraft ?? draft
  const vias = waypoints.filter((w) => w.kind === 'via')
  const fitKey = useMemo(
    () =>
      activeDraft
        ? `${activeDraft.stats.distanceMeters}-${activeDraft.geometry.coordinates.length}-${activeDraft.selectedOptionId ?? 'main'}`
        : '',
    [activeDraft],
  )

  const windOverlay = useMemo(() => {
    if (!activeDraft?.geometry) return null
    if (!deferredWindHour && !deferredWindWindow) return null
    return buildRouteWindOverlay(activeDraft.geometry, {
      routeType: activeDraft.type,
      hour: deferredWindHour,
      window: deferredWindHour ? null : deferredWindWindow,
      sampleCount: 18,
    })
  }, [activeDraft, deferredWindHour, deferredWindWindow])

  const surfaceOverlay = useMemo(() => {
    if (!activeDraft?.geometry) return null
    return buildSurfaceRouteOverlay(activeDraft.geometry, activeDraft.surfaceEdges)
  }, [activeDraft])

  const surfaceAlert = useMemo(() => {
    if (!activeDraft?.stats.surfaceStats) return null
    const unpavedM =
      ((activeDraft.stats.surfaceStats.unpavedPercent ?? 0) / 100) *
      activeDraft.stats.distanceMeters
    return summarizeUnpavedAlert(
      activeDraft.bikeType,
      activeDraft.stats.surfaceStats.unpavedPercent,
      unpavedM,
    )
  }, [activeDraft])

  const objetivoFeedback = useMemo(() => {
    if (!activeDraft || activeDraft.type !== 'circular') return null
    const targetD = activeDraft.circularDistanceMeters
    const targetE = activeDraft.targetElevationGainMeters
    const parts: string[] = []
    if (targetD && targetD > 0) {
      const err = ((activeDraft.stats.distanceMeters - targetD) / targetD) * 100
      parts.push(
        `Distancia ${formatDistance(activeDraft.stats.distanceMeters)} (objetivo ${formatDistance(targetD)}, ${err >= 0 ? '+' : ''}${err.toFixed(0)}%)`,
      )
    }
    if (targetE && targetE > 0) {
      const err = ((activeDraft.stats.elevationGainMeters - targetE) / targetE) * 100
      parts.push(
        `Desnivel ${formatElevation(activeDraft.stats.elevationGainMeters)} (objetivo ${targetE} m, ${err >= 0 ? '+' : ''}${err.toFixed(0)}%)`,
      )
    }
    return parts.length ? parts.join(' · ') : null
  }, [activeDraft])

  const windCaption = useMemo(() => {
    if (deferredWindHour) {
      return `${formatWeatherHourCaption(deferredWindHour.time)} · ${Math.round(deferredWindHour.windSpeedKmh)} km/h desde ${Math.round(deferredWindHour.windDirectionDeg)}° · ida/vuelta según tramo`
    }
    if (deferredWindWindow) {
      return `${formatWeatherWindowCaption(deferredWindWindow.startHour, deferredWindWindow.endHour)} · ${deferredWindWindow.windSpeedKmh} km/h ${deferredWindWindow.windDirLabel} (${deferredWindWindow.relative})`
    }
    return null
  }, [deferredWindHour, deferredWindWindow])

  async function handleSave() {
    if (!draft) return
    if (!user || user.isAnonymous) {
      setSaveMessage('Inicia sesión para guardar esta ruta.')
      return
    }
    const entitlement = canSaveRoute(profile)
    if (!entitlement.ok) {
      showPaywall(entitlement.reason ?? 'save_limit')
      return
    }
    if (!firebaseReady || !routeRepository.isConfigured()) {
      setSaveMessage('Firebase no está configurado. No se pueden guardar rutas todavía.')
      return
    }
    try {
      await routeRepository.save(user.uid, draft, { isPublic: false })
      void authService.recordRouteSaved(user.uid).catch((err) => {
        console.warn('[save] usage', err)
      })
      track('route_saved', { distance_m: draft.stats.distanceMeters })
      setSaveMessage('Ruta guardada en Mis rutas.')
    } catch (error) {
      console.error('[save]', error)
      setSaveMessage('No se pudo guardar la ruta. Inténtalo de nuevo.')
    }
  }

  async function handleLocate() {
    setLocating(true)
    try {
      await useMyLocationAsStart()
    } finally {
      setLocating(false)
    }
  }

  async function handleCompare() {
    if (!canCalculate) return
    setCompareBusy(true)
    setCompareRows(null)
    try {
      const rows = await compareBikesForWaypoints({
        waypoints,
        preferences,
        routeType,
        circularDistanceMeters:
          routeType === 'circular' ? circularDistanceMeters : undefined,
        targetElevationGainMeters:
          routeType === 'circular' && targetElevationGainMeters > 0
            ? targetElevationGainMeters
            : undefined,
      })
      setCompareRows(rows)
      track('route_created', { bike_type: 'compare', route_type: routeType })
    } catch (error) {
      console.error('[compare]', error)
      setSaveMessage('No se pudo comparar bicis. Revisa puntos o red.')
    } finally {
      setCompareBusy(false)
    }
  }

  function handlePickCompare(row: BikeCompareRow) {
    setDraftFromImport({
      ...row.draft,
      title: row.draft.title.replace(/ · comparación$/i, ''),
    })
    setBikeType(row.bikeType)
    setCompareRows(null)
  }

  async function handleShareCard() {
    if (!activeDraft) return
    setShareBusy(true)
    try {
      const result = await shareRouteCard(activeDraft)
      setSaveMessage(
        result === 'shared'
          ? 'Tarjeta compartida.'
          : result === 'copied'
            ? 'Imagen descargada y enlace copiado.'
            : 'Tarjeta descargada.',
      )
      track('route_shared', { via: 'share_card' })
    } catch (error) {
      console.error('[share-card]', error)
      setSaveMessage('No se pudo generar la tarjeta.')
    } finally {
      setShareBusy(false)
    }
  }

  function stashForRide() {
    if (!activeDraft) return
    stashGpsRoute({
      title: activeDraft.title || 'Salida PedalMap',
      bikeType,
      geometry: activeDraft.geometry,
      instructions: activeDraft.instructions,
    })
  }

  const ctaDisabled = status === 'calculating' || !canCalculate
  const ctaLabel =
    status === 'calculating'
      ? 'Calculando ruta…'
      : !canCalculate
        ? routeType === 'circular'
          ? 'Falta el punto de partida'
          : 'Falta inicio o destino'
        : 'Crear ruta'

  return (
    <div
      className={clsx(
        'planner-shell flex flex-col overflow-hidden lg:grid lg:grid-cols-2',
        mapExpanded && 'max-lg:!grid max-lg:grid-rows-[1fr_0]',
      )}
    >
      {paywallReason && <PremiumCard reason={paywallReason} onClose={clearPaywall} />}

      <aside
        className={clsx(
          'order-2 flex min-h-0 flex-[1.15] flex-col overflow-hidden border-t border-[var(--color-fog)] bg-white lg:order-1 lg:flex-1 lg:border-r lg:border-t-0',
          mapExpanded && 'max-lg:hidden',
        )}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-28 lg:p-5 lg:pb-28">
          <div>
            <p className="label-caps text-[var(--color-trail)]">PedalMap</p>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--color-forest)]">
              Crear ruta
            </h1>
            {!routeService.isRoutingConfigured() && (
              <p className="mt-1 text-xs text-amber-800">
                Routing no configurado: falta el proxy Worker (VITE_PEDALMAP_API_URL).
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--color-stone)]">
              Toca el mapa para poner inicio y destino, o usa búsqueda / Estoy aquí.
            </p>
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de ruta">
            {(
              [
                ['a_to_b', 'A → B', 'Punto a punto'],
                ['out_and_back', 'Ida y vuelta', 'Ida y retorno'],
                ['circular', 'Objetivo', 'Km / desnivel'],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={routeType === id}
                title={hint}
                className={clsx(
                  'min-h-11 rounded-xl px-3 py-2 text-left text-sm font-semibold transition',
                  routeType === id
                    ? 'bg-[var(--color-signal)] text-[var(--color-ink)]'
                    : 'bg-[var(--color-mist)] text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]',
                )}
                onClick={() => setRouteType(id)}
              >
                <span className="block leading-tight">{label}</span>
                <span className="block text-[10px] font-medium opacity-70">{hint}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={locating}
              onClick={() => void handleLocate()}
            >
              {locating ? 'Localizando…' : 'Estoy aquí'}
            </Button>
          </div>

          <SearchLocation
            label="Inicio"
            placeholder="¿Dónde empiezas?"
            valueLabel={waypoints.find((w) => w.kind === 'start')?.name}
            onSelect={(place) => setStart(place.position, place.label)}
          />

          {vias.length > 0 && (
            <ul className="space-y-2" aria-label="Puntos intermedios">
              {vias.map((via, index) => (
                <li
                  key={via.id}
                  className="flex items-start justify-between gap-2 rounded-xl bg-[var(--color-mist)]/60 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-semibold text-[var(--color-forest)]">Via {index + 1}</span>
                    <br />
                    <span className="text-[var(--color-stone)]">{via.name}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--color-trail)]"
                        onClick={() => moveWaypoint(via.id, -1)}
                        disabled={index === 0}
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--color-trail)]"
                        onClick={() => moveWaypoint(via.id, 1)}
                        disabled={index === vias.length - 1}
                      >
                        Bajar
                      </button>
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--color-danger)]"
                      onClick={() => removeWaypoint(via.id)}
                    >
                      Eliminar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {routeType !== 'circular' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViaQueryOpen((v) => !v)}
                aria-expanded={viaQueryOpen}
              >
                {viaQueryOpen ? 'Cerrar waypoint' : 'Añadir waypoint'}
              </Button>
              {viaQueryOpen && (
                <SearchLocation
                  label="Punto intermedio"
                  placeholder="Añade un punto entre origen y destino"
                  onSelect={(place) => {
                    addVia(place.position, place.label)
                    setViaQueryOpen(false)
                  }}
                />
              )}
              <SearchLocation
                label="Destino"
                placeholder="¿Dónde quieres llegar?"
                valueLabel={waypoints.find((w) => w.kind === 'end')?.name}
                onSelect={(place) => setEnd(place.position, place.label)}
              />
            </>
          )}

          {routeType === 'circular' && (
            <div className="space-y-3 rounded-xl bg-[var(--color-mist)]/70 px-3 py-3 text-sm">
              <p className="text-xs text-[var(--color-stone)]">
                Indica partida, km y desnivel. Generamos una circular con el suelo según tu bici.
                Premium desbloquea Objetivo en cuentas Free.
              </p>
              <label className="block">
                <span className="label-caps">Distancia objetivo</span>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-11 min-w-11 rounded-xl bg-white text-lg font-bold text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]"
                    aria-label="Bajar 1 km"
                    onClick={() =>
                      setCircularDistanceMeters(Math.max(5000, circularDistanceMeters - 1000))
                    }
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min={5000}
                    max={80000}
                    step={1000}
                    value={circularDistanceMeters}
                    onChange={(e) => setCircularDistanceMeters(Number(e.target.value))}
                    className="w-full accent-[var(--color-trail)]"
                  />
                  <button
                    type="button"
                    className="min-h-11 min-w-11 rounded-xl bg-white text-lg font-bold text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]"
                    aria-label="Subir 1 km"
                    onClick={() =>
                      setCircularDistanceMeters(Math.min(80000, circularDistanceMeters + 1000))
                    }
                  >
                    +
                  </button>
                  <strong className="min-w-16 text-right text-[var(--color-forest)]">
                    {formatDistance(circularDistanceMeters)}
                  </strong>
                </div>
              </label>
              <label className="block">
                <span className="label-caps">Desnivel positivo objetivo</span>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-11 min-w-11 rounded-xl bg-white text-lg font-bold text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]"
                    aria-label="Bajar 50 m de desnivel"
                    onClick={() =>
                      setTargetElevationGainMeters(Math.max(0, targetElevationGainMeters - 50))
                    }
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={2500}
                    step={50}
                    value={targetElevationGainMeters}
                    onChange={(e) => setTargetElevationGainMeters(Number(e.target.value))}
                    className="w-full accent-[var(--color-trail)]"
                  />
                  <button
                    type="button"
                    className="min-h-11 min-w-11 rounded-xl bg-white text-lg font-bold text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]"
                    aria-label="Subir 50 m de desnivel"
                    onClick={() =>
                      setTargetElevationGainMeters(Math.min(2500, targetElevationGainMeters + 50))
                    }
                  >
                    +
                  </button>
                  <strong className="min-w-16 text-right text-[var(--color-forest)]">
                    {targetElevationGainMeters === 0 ? 'Libre' : `${targetElevationGainMeters} m`}
                  </strong>
                </div>
              </label>
            </div>
          )}

          <BikeSelector value={bikeType} onChange={setBikeType} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canCalculate || compareBusy || status === 'calculating'}
              onClick={() => void handleCompare()}
            >
              {compareBusy ? 'Comparando…' : 'Comparar Carretera / Gravel / MTB'}
            </Button>
          </div>
          {(compareBusy || (compareRows && compareRows.length > 0)) && (
            <BikeComparePanel
              rows={compareRows ?? []}
              busy={compareBusy}
              onPick={handlePickCompare}
              onClose={() => setCompareRows(null)}
            />
          )}
          <RoutePreferencesPanel
            value={preferences}
            onChange={setPreferences}
            profile={profile}
            onLimitReached={(reason) => showPaywall(reason)}
          />

          {routeType === 'a_to_b' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-trail)]"
                checked={wantAlternatives}
                onChange={(e) => setWantAlternatives(e.target.checked)}
              />
              Pedir varias opciones de ruta (hasta 3)
            </label>
          )}

          {errorMessage && (
            <div
              className="rounded-2xl bg-[#fff4f4] px-3 py-3 text-sm text-[var(--color-danger)]"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {activeDraft && (
            <div className="space-y-4 border-t border-[var(--color-fog)] pt-4">
              <RouteSummary stats={activeDraft.stats} />
              {surfaceAlert && (
                <p
                  className="rounded-2xl bg-[#fff8f0] px-3 py-3 text-sm text-[#9a4b00] ring-1 ring-[#efd2b0]"
                  role="status"
                >
                  {surfaceAlert}
                </p>
              )}
              {objetivoFeedback && (
                <p className="rounded-xl bg-[var(--color-mist)] px-3 py-2 text-xs text-[var(--color-forest)]">
                  Objetivo · {objetivoFeedback}
                </p>
              )}
              <div>
                <h2 className="mb-2 font-display text-lg font-bold text-[var(--color-forest)]">
                  Elevación
                </h2>
                <ElevationChart
                  profile={activeDraft.elevationProfile}
                  onHover={(point) => setHoverPoint(point)}
                />
              </div>

              {activeDraft.instructions && activeDraft.instructions.length > 0 && (
                <details className="rounded-2xl bg-[var(--color-mist)]/50">
                  <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--color-forest)]">
                    Indicaciones ({activeDraft.instructions.length})
                  </summary>
                  <ol className="max-h-48 space-y-1.5 overflow-y-auto border-t border-[var(--color-fog)] px-3 py-2 text-xs text-[var(--color-stone)]">
                    {activeDraft.instructions.map((step, i) => (
                      <li key={`${i}-${step.slice(0, 24)}`} className="flex gap-2">
                        <span className="font-semibold text-[var(--color-forest)]">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {(draft?.routeOptions?.length ?? 0) > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                    Opciones de ruta ({draft!.routeOptions!.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {draft!.routeOptions!.map((opt) => {
                      const active = (draft!.selectedOptionId ?? draft!.routeOptions![0]?.id) === opt.id
                      const score = opt.stats.surfaceStats?.suitability?.score
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={clsx(
                            'rounded-xl px-3 py-2 text-left text-xs ring-1 transition',
                            active
                              ? 'bg-[var(--color-signal)] font-semibold text-[var(--color-ink)] ring-[var(--color-trail)]'
                              : 'bg-[var(--color-mist)] font-semibold text-[var(--color-forest)] ring-[var(--color-fog)]',
                          )}
                          onClick={() => selectRouteOption(opt.id)}
                        >
                          <span className="block">
                            {opt.label}
                            {active ? ' · activa' : ''}
                          </span>
                          <span className="mt-0.5 block font-medium text-[var(--color-stone)]">
                            {formatDistance(opt.stats.distanceMeters)} ·{' '}
                            {formatElevation(opt.stats.elevationGainMeters)}
                            {score != null ? ` · aptitud ${Math.round(score)}` : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {!draft?.routeOptions?.length && draft?.alternatives && draft.alternatives.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-[var(--color-signal)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)]"
                    onClick={() => void calculate()}
                  >
                    Principal
                  </button>
                  {draft.alternatives.map((alt, index) => (
                    <button
                      key={alt.id}
                      type="button"
                      className="rounded-xl bg-[var(--color-mist)] px-3 py-1.5 text-xs font-semibold text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]"
                      onClick={() => selectAlternative(index)}
                    >
                      {alt.label} · {formatDistance(alt.stats.distanceMeters)}
                    </button>
                  ))}
                </div>
              )}

              {routeType === 'circular' && (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={status === 'calculating' || !canCalculate}
                  onClick={() => void calculateAnotherVariant()}
                >
                  Otra variante
                </Button>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <Button className="w-full" onClick={() => void handleSave()}>
                  Guardar ruta
                </Button>
                <Link className="w-full" to="/navegacion" onClick={stashForRide}>
                  <Button variant="secondary" className="w-full">
                    Navegar
                  </Button>
                </Link>
                <Link
                  className="w-full sm:col-span-2"
                  to={`/actividad?title=${encodeURIComponent(activeDraft.title || 'Salida PedalMap')}&bike=${bikeType}`}
                  onClick={stashForRide}
                >
                  <Button variant="ghost" className="w-full">
                    Iniciar GPS / grabar
                  </Button>
                </Link>
                <Button
                  className="w-full sm:col-span-2"
                  variant="secondary"
                  disabled={shareBusy}
                  onClick={() => void handleShareCard()}
                >
                  {shareBusy ? 'Generando tarjeta…' : 'Compartir tarjeta (WhatsApp)'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {status === 'editing' ? (
                  <>
                    <Button size="sm" onClick={() => void saveEdits()}>
                      Recalcular
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={startEditing}>
                    Editar ruta
                  </Button>
                )}
                <GPXImporter onImported={setDraftFromImport} />
              </div>

              <details open className="rounded-2xl bg-[var(--color-mist)]/50 open:bg-[var(--color-mist)]/70">
                <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--color-forest)]">
                  Viento y mejor salida
                </summary>
                <div className="border-t border-[var(--color-fog)] px-1 pb-2 pt-1">
                  <RouteWeatherPanel
                    route={activeDraft}
                    selectedWindow={selectedWindWindow}
                    selectedHour={selectedWindHour}
                    onSelectWindow={(w) => {
                      startTransition(() => {
                        setSelectedWindWindow(w)
                        setSelectedWindHour(null)
                      })
                    }}
                    onSelectHour={(h) => {
                      startTransition(() => {
                        setSelectedWindHour(h)
                        if (h) setSelectedWindWindow(null)
                      })
                    }}
                  />
                </div>
              </details>

              <details className="rounded-2xl bg-[var(--color-mist)]/50">
                <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--color-forest)]">
                  Exportar GPX / apps GPS
                </summary>
                <div className="border-t border-[var(--color-fog)] px-1 pb-2 pt-1">
                  <GpsExportPanel
                    route={activeDraft}
                    onPremiumRequired={() => showPaywall('gpx_export')}
                  />
                </div>
              </details>

              {activeDraft.type === 'circular' &&
                activeDraft.targetElevationGainMeters &&
                activeDraft.targetElevationGainMeters > 0 && (
                  <p className="text-xs text-[var(--color-stone)]">
                    Objetivo desnivel {activeDraft.targetElevationGainMeters} m · conseguido{' '}
                    {Math.round(activeDraft.stats.elevationGainMeters)} m · distancia{' '}
                    {formatDistance(activeDraft.stats.distanceMeters)}
                  </p>
                )}

              {saveMessage && (
                <p className="text-sm text-[var(--color-trail)]">
                  {saveMessage}{' '}
                  {saveMessage.includes('Inicia sesión') && (
                    <Link className="underline" to="/login">
                      Ir a login
                    </Link>
                  )}
                </p>
              )}
            </div>
          )}

          {!activeDraft && (
            <div className="rounded-2xl border border-dashed border-[var(--color-fog)] bg-[var(--color-mist)]/40 px-4 py-5">
              <p className="text-sm text-[var(--color-stone)]">
                Elige inicio y destino (o Objetivo), pulsa <strong>Crear ruta</strong> y verás
                distancia, desnivel, superficie e idoneidad del perfil.
              </p>
              <div className="mt-3">
                <GPXImporter onImported={setDraftFromImport} />
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 border-t border-[var(--color-fog)] bg-white/95 p-3 backdrop-blur safe-pb md:p-4">
          <Button
            className="w-full !py-3 text-base"
            disabled={ctaDisabled}
            onClick={() => void calculate()}
          >
            {ctaLabel}
          </Button>
        </div>
      </aside>

      <section
        className={clsx(
          'relative order-1 min-h-[42vh] flex-1 bg-[var(--color-fog)] lg:order-2 lg:min-h-0',
          mapExpanded && 'max-lg:min-h-0 max-lg:flex-1',
        )}
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-[var(--color-stone)]">
              Cargando mapa…
            </div>
          }
        >
          <MapView
            className="absolute inset-0 h-full w-full"
            waypoints={waypoints}
            geometry={activeDraft?.geometry}
            hoverPoint={hoverPoint}
            windOverlay={windOverlay}
            windCaption={windCaption}
            surfaceOverlay={surfaceOverlay}
            fitKey={fitKey}
            onMapClick={handleMapTap}
            onWaypointDrag={
              status === 'editing'
                ? (id, position) => updateWaypointPosition(id, position)
                : undefined
            }
          />
        </Suspense>
        <button
          type="button"
          className="absolute right-3 top-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-[var(--color-forest)] shadow-sm ring-1 ring-[var(--color-fog)] lg:hidden"
          onClick={() => setMapExpanded((v) => !v)}
        >
          {mapExpanded ? 'Ver formulario' : 'Ampliar mapa'}
        </button>
        {status === 'calculating' && (
          <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-sm font-medium text-[var(--color-forest)] shadow-sm animate-pulse-soft">
            Calculando la mejor ruta ciclista…
          </p>
        )}
        {!activeDraft && status !== 'calculating' && !mapExpanded && (
          <p className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[min(92%,18rem)] rounded-xl bg-white/95 px-3 py-2 text-xs text-[var(--color-forest)] shadow-sm ring-1 ring-[var(--color-fog)] lg:bottom-4">
            Toca el mapa: 1º inicio · 2º destino
          </p>
        )}
      </section>
    </div>
  )
}
