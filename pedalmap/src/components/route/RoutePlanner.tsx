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
      return `${selectedWindHour.time.slice(0, 10)} ${selectedWindHour.time.slice(11, 16)} · ${Math.round(selectedWindHour.windSpeedKmh)} km/h desde ${Math.round(selectedWindHour.windDirectionDeg)}° · ida/vuelta según tramo`
    }
    if (selectedWindWindow) {
      return `${selectedWindWindow.startHour.slice(0, 10)} ${selectedWindWindow.startHour.slice(11, 16)}–${selectedWindWindow.endHour.slice(11, 16)} · ${selectedWindWindow.windSpeedKmh} km/h ${selectedWindWindow.windDirLabel} (${selectedWindWindow.relative})`
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
    <div className="flex h-[calc(100dvh-4rem-3.5rem)] flex-col overflow-hidden md:h-[calc(100dvh-4rem)] lg:grid lg:grid-cols-2">
      {paywallReason && <PremiumCard reason={paywallReason} onClose={clearPaywall} />}

      {/* Datos — mitad inferior (móvil) / mitad izquierda (desktop) */}
      <aside className="order-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t border-[var(--color-fog)] bg-[color-mix(in_oklab,white_82%,var(--color-mist))] p-4 lg:order-1 lg:border-r lg:border-t-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-trail)]">
            PedalMap
          </p>
          <h1 className="font-display text-2xl font-extrabold text-[var(--color-forest)]">
            Crear ruta
          </h1>
          {!routeService.isRoutingConfigured() && (
            <p className="mt-1 text-xs text-amber-800">
              Routing no configurado: falta VITE_ORS_API_KEY en el entorno.
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
                'rounded-xl px-3 py-2 text-sm font-semibold',
                routeType === id
                  ? 'bg-[var(--color-signal)] text-[var(--color-ink)]'
                  : 'bg-white ring-1 ring-[var(--color-fog)]',
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
                className="flex items-start justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm ring-1 ring-[var(--color-fog)]"
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
              className="!py-2"
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
          <div className="space-y-3 rounded-xl bg-white/80 px-3 py-3 text-sm ring-1 ring-[var(--color-fog)]">
            <p className="text-xs text-[var(--color-stone)]">
              Indica el punto de partida, los km y el desnivel que quieres. Generamos una circular
              real (ORS <code>round_trip</code>) y buscamos el mejor ajuste al desnivel.
            </p>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                Distancia objetivo
              </span>
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
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                Desnivel positivo objetivo
              </span>
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
              <p className="mt-1 text-[11px] text-[var(--color-stone)]">
                0 = sin objetivo de desnivel. Si pones metros, probamos varias direcciones y
                elegimos la más cercana.
              </p>
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

        <Button
          className="w-full !py-3 text-base"
          disabled={status === 'calculating'}
          onClick={() => void calculate()}
        >
          {status === 'calculating' ? 'Calculando ruta…' : 'Crear ruta'}
        </Button>

        {errorMessage && (
          <div
            className="rounded-2xl bg-[#fff4f4] px-3 py-3 text-sm text-[var(--color-danger)]"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {activeDraft && (
          <div className="space-y-3">
            <RouteSummary stats={activeDraft.stats} />
            <div>
              <h2 className="mb-2 font-display text-lg font-bold text-[var(--color-forest)]">
                Perfil de elevación
              </h2>
              <ElevationChart
                profile={activeDraft.elevationProfile}
                onHover={(point) => setHoverPoint(point)}
              />
            </div>

            {draft?.alternatives && draft.alternatives.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void calculate()}>
                  Ruta principal
                </Button>
                {draft.alternatives.map((alt, index) => (
                  <Button key={alt.id} variant="ghost" onClick={() => selectAlternative(index)}>
                    {alt.label} · {formatDistance(alt.stats.distanceMeters)}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {status === 'editing' ? (
                <>
                  <Button onClick={() => void saveEdits()}>Recalcular cambios</Button>
                  <Button variant="ghost" onClick={cancelEditing}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={startEditing}>
                  Editar ruta
                </Button>
              )}
              <Button variant="ghost" onClick={() => void handleSave()}>
                Guardar ruta
              </Button>
              <GPXImporter onImported={setDraftFromImport} />
              <Link
                to={`/actividad?title=${encodeURIComponent(activeDraft.title || 'Salida PedalMap')}&bike=${bikeType}`}
              >
                <Button variant="secondary">Iniciar GPS</Button>
              </Link>
            </div>

            <RouteWeatherPanel
              route={activeDraft}
              selectedWindow={selectedWindWindow}
              selectedHour={selectedWindHour}
              onSelectWindow={setSelectedWindWindow}
              onSelectHour={setSelectedWindHour}
            />
            <GpsExportPanel
              route={activeDraft}
              onPremiumRequired={() => showPaywall('gpx_export')}
            />

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
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-stone)]">
              Elige inicio y destino, pulsa <strong>Crear ruta</strong> y verás distancia, desnivel,
              superficie y el perfil de elevación.
            </p>
            <div className="flex flex-wrap gap-2">
              <GPXImporter onImported={setDraftFromImport} />
            </div>
          </div>
        )}
      </aside>

      {/* Mapa — mitad superior (móvil) / mitad derecha (desktop) */}
      <section className="relative order-1 min-h-0 flex-1 bg-[var(--color-fog)] lg:order-2">
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
          <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl bg-white/90 px-3 py-2 text-sm font-medium text-[var(--color-forest)] shadow-sm animate-pulse-soft">
            Calculando la mejor ruta ciclista…
          </p>
        )}
      </section>
    </div>
  )
}
