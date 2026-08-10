import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
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
import { GPXExporter } from '@/components/gpx/GPXExporter'
import { routeRepository } from '@/services/RouteRepository'
import { canSaveRoute } from '@/services/EntitlementService'
import { track } from '@/lib/analytics'
import { routeService } from '@/services/RouteService'
import { formatDistance } from '@/lib/stats'
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
    wantAlternatives,
    setWantAlternatives,
    setDraftFromImport,
  } = usePlanner()
  const { user, profile, firebaseReady } = useAuth()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [viaQueryOpen, setViaQueryOpen] = useState(false)

  const activeDraft = editDraft ?? draft
  const vias = waypoints.filter((w) => w.kind === 'via')
  const fitKey = useMemo(
    () =>
      activeDraft
        ? `${activeDraft.stats.distanceMeters}-${activeDraft.geometry.coordinates.length}-${activeDraft.title}`
        : '',
    [activeDraft],
  )

  useEffect(() => {
    if (status === 'success' && draft) setPanelOpen(true)
  }, [status, draft])

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
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1600px] grid-cols-1 lg:grid-cols-[380px_1fr]">
      {paywallReason && <PremiumCard reason={paywallReason} onClose={clearPaywall} />}

      <aside
        className={clsx(
          'z-20 flex flex-col gap-4 border-[var(--color-fog)] bg-[color-mix(in_oklab,white_82%,var(--color-mist))] p-4 lg:border-r',
          'fixed inset-x-0 bottom-14 max-h-[62vh] overflow-auto rounded-t-3xl shadow-2xl lg:static lg:max-h-none lg:rounded-none lg:shadow-none',
          panelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3.5rem)]',
          'transition-transform lg:translate-y-0',
        )}
      >
        <div className="flex items-center justify-between lg:block">
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
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--color-forest)] lg:hidden"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
          >
            {panelOpen ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {activeDraft && (
          <div className="space-y-3 rounded-2xl bg-white/85 p-3 ring-1 ring-[var(--color-fog)] lg:hidden">
            <RouteSummary stats={activeDraft.stats} />
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de ruta">
          {(
            [
              ['a_to_b', 'A → B'],
              ['out_and_back', 'Ida y vuelta'],
              ['circular', 'Circular'],
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
          <label className="block rounded-xl bg-white/80 px-3 py-3 text-sm ring-1 ring-[var(--color-fog)]">
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
            <p className="mt-2 text-[11px] text-[var(--color-stone)]">
              Circular real vía OpenRouteService <code>round_trip</code> desde el punto de inicio.
            </p>
          </label>
        )}

        <BikeSelector value={bikeType} onChange={setBikeType} />
        <RoutePreferencesPanel value={preferences} onChange={setPreferences} />

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
            <div className="hidden lg:block">
              <RouteSummary stats={activeDraft.stats} />
              <div className="mt-3">
                <h2 className="mb-2 font-display text-lg font-bold text-[var(--color-forest)]">
                  Perfil de elevación
                </h2>
                <ElevationChart
                  profile={activeDraft.elevationProfile}
                  onHover={(point) => setHoverPoint(point)}
                />
              </div>
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
              <GPXExporter route={activeDraft} onPremiumRequired={() => showPaywall('gpx_export')} />
              <GPXImporter onImported={setDraftFromImport} />
            </div>
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
          <div className="flex flex-wrap gap-2">
            <GPXImporter onImported={setDraftFromImport} />
          </div>
        )}
      </aside>

      <section className="flex min-h-[70vh] flex-col pb-40 lg:pb-0">
        <div className="relative min-h-[50vh] flex-1 lg:min-h-0">
          <Suspense
            fallback={
              <div className="flex h-full min-h-[50vh] items-center justify-center bg-[var(--color-fog)] text-sm text-[var(--color-stone)]">
                Cargando mapa…
              </div>
            }
          >
            <MapView
              className="absolute inset-0 h-full w-full"
              waypoints={waypoints}
              geometry={activeDraft?.geometry}
              hoverPoint={hoverPoint}
              fitKey={fitKey}
              onWaypointDrag={
                status === 'editing'
                  ? (id, position) => updateWaypointPosition(id, position)
                  : undefined
              }
            />
          </Suspense>
        </div>

        <div className="hidden space-y-4 border-t border-[var(--color-fog)] bg-[color-mix(in_oklab,var(--color-mist)_90%,white)] p-4 lg:block">
          {status === 'calculating' && (
            <p className="animate-pulse-soft text-sm font-medium text-[var(--color-forest)]">
              Calculando la mejor ruta ciclista…
            </p>
          )}
          {!activeDraft && (
            <p className="text-sm text-[var(--color-stone)]">
              Elige inicio y destino, pulsa <strong>Crear ruta</strong> y verás distancia, desnivel,
              superficie y el perfil de elevación.
            </p>
          )}
        </div>

        {activeDraft && (
          <div className="space-y-4 border-t border-[var(--color-fog)] bg-[color-mix(in_oklab,var(--color-mist)_90%,white)] p-4 lg:hidden">
            <ElevationChart
              profile={activeDraft.elevationProfile}
              onHover={(point) => setHoverPoint(point)}
            />
          </div>
        )}
      </section>
    </div>
  )
}
