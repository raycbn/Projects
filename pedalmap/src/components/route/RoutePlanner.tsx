import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlanner } from '@/app/PlannerContext'
import { useAuth } from '@/app/AuthContext'
import { SearchLocation } from '@/components/route/SearchLocation'
import { BikeSelector } from '@/components/route/BikeSelector'
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
import { track } from '@/lib/analytics'
import { routeService } from '@/services/RouteService'
import { formatDistance } from '@/lib/stats'
import { buildRouteWindOverlay } from '@/lib/routeWindOverlay'
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
    startEditing,
    cancelEditing,
    saveEdits,
    selectAlternative,
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
  } = usePlanner()
  const { user, profile, firebaseReady } = useAuth()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [viaQueryOpen, setViaQueryOpen] = useState(false)
  const [selectedWindWindow, setSelectedWindWindow] = useState<RideWindowAdvice | null>(null)
  const [selectedWindHour, setSelectedWindHour] = useState<HourlyWeatherPoint | null>(null)

  const activeDraft = editDraft ?? draft
  const vias = waypoints.filter((w) => w.kind === 'via')
  const fitKey = useMemo(
    () =>
      activeDraft
        ? `${activeDraft.stats.distanceMeters}-${activeDraft.geometry.coordinates.length}-${activeDraft.title}`
        : '',
    [activeDraft],
  )

  const windOverlay = useMemo(() => {
    if (!activeDraft?.geometry) return null
    if (!selectedWindHour && !selectedWindWindow) return null
    return buildRouteWindOverlay(activeDraft.geometry, {
      routeType: activeDraft.type,
      hour: selectedWindHour,
      window: selectedWindHour ? null : selectedWindWindow,
    })
  }, [activeDraft, selectedWindHour, selectedWindWindow])

  const windCaption = useMemo(() => {
    if (selectedWindHour) {
      return `${formatWeatherHourCaption(selectedWindHour.time)} · ${Math.round(selectedWindHour.windSpeedKmh)} km/h desde ${Math.round(selectedWindHour.windDirectionDeg)}° · ida/vuelta según tramo`
    }
    if (selectedWindWindow) {
      return `${formatWeatherWindowCaption(selectedWindWindow.startHour, selectedWindWindow.endHour)} · ${selectedWindWindow.windSpeedKmh} km/h ${selectedWindWindow.windDirLabel} (${selectedWindWindow.relative})`
    }
    return null
  }, [selectedWindHour, selectedWindWindow])

  // Wind selection is owned by RouteWeatherPanel after each forecast load.
  // Do not clear it on fitKey — that raced the forecast callback and left the map without overlay.

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
      track('route_saved', { distance_m: draft.stats.distanceMeters })
      setSaveMessage('Ruta guardada en Mis rutas.')
    } catch (error) {
      console.error('[save]', error)
      setSaveMessage('No se pudo guardar la ruta. Inténtalo de nuevo.')
    }
  }

  return (
    <div className="planner-shell flex flex-col overflow-hidden lg:grid lg:grid-cols-2">
      {paywallReason && <PremiumCard reason={paywallReason} onClose={clearPaywall} />}

      {/* Datos — mitad inferior (móvil) / mitad izquierda (desktop) */}
      <aside className="order-2 flex min-h-0 flex-[1.15] flex-col overflow-hidden border-t border-[var(--color-fog)] bg-white lg:order-1 lg:flex-1 lg:border-r lg:border-t-0">
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
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de ruta">
            {(
              [
                ['a_to_b', 'A → B'],
                ['out_and_back', 'Ida y vuelta'],
                ['circular', 'Objetivo'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={routeType === id}
                className={clsx(
                  'rounded-xl px-3 py-2 text-sm font-semibold transition',
                  routeType === id
                    ? 'bg-[var(--color-signal)] text-[var(--color-ink)]'
                    : 'bg-[var(--color-mist)] text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]',
                )}
                onClick={() => setRouteType(id)}
              >
                {label}
              </button>
            ))}
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
                Indica partida, km y desnivel. Generamos una circular con Valhalla (suelo según tu
                bici) buscando el mejor ajuste al objetivo.
              </p>
              <label className="block">
                <span className="label-caps">Distancia objetivo</span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={5000}
                    max={80000}
                    step={1000}
                    value={circularDistanceMeters}
                    onChange={(e) => setCircularDistanceMeters(Number(e.target.value))}
                    className="w-full accent-[var(--color-trail)]"
                  />
                  <strong className="min-w-16 text-right text-[var(--color-forest)]">
                    {formatDistance(circularDistanceMeters)}
                  </strong>
                </div>
              </label>
              <label className="block">
                <span className="label-caps">Desnivel positivo objetivo</span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={2500}
                    step={50}
                    value={targetElevationGainMeters}
                    onChange={(e) => setTargetElevationGainMeters(Number(e.target.value))}
                    className="w-full accent-[var(--color-trail)]"
                  />
                  <strong className="min-w-16 text-right text-[var(--color-forest)]">
                    {targetElevationGainMeters === 0 ? 'Libre' : `${targetElevationGainMeters} m`}
                  </strong>
                </div>
              </label>
            </div>
          )}

          <BikeSelector value={bikeType} onChange={setBikeType} />
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
              Pedir alternativas ORS
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
              <div>
                <h2 className="mb-2 font-display text-lg font-bold text-[var(--color-forest)]">
                  Elevación
                </h2>
                <ElevationChart
                  profile={activeDraft.elevationProfile}
                  onHover={(point) => setHoverPoint(point)}
                />
              </div>

              {draft?.alternatives && draft.alternatives.length > 0 && (
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

              <div className="grid gap-2 sm:grid-cols-2">
                <Button className="w-full" onClick={() => void handleSave()}>
                  Guardar ruta
                </Button>
                <Link
                  className="w-full"
                  to={`/actividad?title=${encodeURIComponent(activeDraft.title || 'Salida PedalMap')}&bike=${bikeType}`}
                >
                  <Button variant="secondary" className="w-full">
                    Iniciar GPS
                  </Button>
                </Link>
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
                    onSelectWindow={setSelectedWindWindow}
                    onSelectHour={setSelectedWindHour}
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

        <div className="sticky bottom-0 z-10 border-t border-[var(--color-fog)] bg-white/95 p-3 backdrop-blur md:p-4">
          <Button
            className="w-full !py-3 text-base"
            disabled={status === 'calculating'}
            onClick={() => void calculate()}
          >
            {status === 'calculating' ? 'Calculando ruta…' : 'Crear ruta'}
          </Button>
        </div>
      </aside>

      {/* Mapa — mitad superior (móvil) / mitad derecha (desktop) */}
      <section className="relative order-1 min-h-[42vh] flex-1 bg-[var(--color-fog)] lg:order-2 lg:min-h-0">
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
            fitKey={fitKey}
            onWaypointDrag={
              status === 'editing'
                ? (id, position) => updateWaypointPosition(id, position)
                : undefined
            }
          />
        </Suspense>
        {status === 'calculating' && (
          <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-sm font-medium text-[var(--color-forest)] shadow-sm animate-pulse-soft">
            Calculando la mejor ruta ciclista…
          </p>
        )}
      </section>
    </div>
  )
}
