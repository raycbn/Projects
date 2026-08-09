import { lazy, Suspense, useMemo, useState } from 'react'
import { usePlanner } from '@/app/PlannerContext'
import { useAuth } from '@/app/AuthContext'
import { SearchLocation } from '@/components/route/SearchLocation'
import { BikeSelector } from '@/components/route/BikeSelector'
import { RoutePreferencesPanel } from '@/components/route/RoutePreferences'
import { RouteSummary } from '@/components/route/RouteSummary'
import { ElevationChart } from '@/components/route/ElevationChart'
import { PremiumCard } from '@/components/premium/PremiumCard'
import { GPXExporter } from '@/components/gpx/GPXExporter'
import { GPXImporter } from '@/components/gpx/GPXImporter'
import { Button } from '@/components/ui/Button'
import { routeRepository } from '@/services/RouteRepository'
import { canSaveRoute } from '@/services/EntitlementService'
import { track } from '@/lib/analytics'
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
    draft,
    editDraft,
    hoverPoint,
    setHoverPoint,
    calculate,
    startEditing,
    cancelEditing,
    saveEdits,
    setDraftFromImport,
    paywallReason,
    clearPaywall,
    showPaywall,
    updateWaypointPosition,
  } = usePlanner()
  const { user, profile, firebaseReady } = useAuth()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const activeDraft = editDraft ?? draft
  const fitKey = useMemo(
    () => (activeDraft ? `${activeDraft.stats.distanceMeters}-${activeDraft.geometry.coordinates.length}` : ''),
    [activeDraft],
  )

  async function handleSave() {
    if (!draft) return
    if (!user || user.isAnonymous) {
      setSaveMessage('Crea una cuenta o inicia sesión para guardar y sincronizar tus rutas.')
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
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1600px] grid-cols-1 lg:grid-cols-[360px_1fr]">
      {paywallReason && (
        <PremiumCard
          reason={paywallReason}
          onClose={clearPaywall}
        />
      )}

      <aside
        className={clsx(
          'z-20 flex flex-col gap-4 border-[var(--color-fog)] bg-[color-mix(in_oklab,white_82%,var(--color-mist))] p-4 lg:border-r',
          'fixed inset-x-0 bottom-14 max-h-[55vh] overflow-auto rounded-t-3xl shadow-2xl lg:static lg:max-h-none lg:rounded-none lg:shadow-none',
          panelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3.5rem)]',
          'transition-transform lg:translate-y-0',
        )}
      >
        <div className="flex items-center justify-between lg:block">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-trail)]">
              Planificador
            </p>
            <h1 className="font-display text-2xl font-extrabold text-[var(--color-forest)]">Crear ruta</h1>
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

        {routeType !== 'circular' && (
          <SearchLocation
            label="Destino"
            placeholder="¿Dónde quieres llegar?"
            valueLabel={waypoints.find((w) => w.kind === 'end')?.name}
            onSelect={(place) => setEnd(place.position, place.label)}
          />
        )}

        {routeType === 'circular' && (
          <p className="rounded-xl bg-[var(--color-mist)] px-3 py-2 text-sm text-[var(--color-stone)]">
            Las rutas circulares por distancia aproximada están preparadas en la arquitectura y se
            implementarán en la Fase 3. Mientras tanto usa A → B o Ida y vuelta.
          </p>
        )}

        <BikeSelector value={bikeType} onChange={setBikeType} />
        <RoutePreferencesPanel value={preferences} onChange={setPreferences} />

        <Button
          className="w-full !py-3 text-base"
          disabled={status === 'calculating'}
          onClick={() => void calculate()}
        >
          {status === 'calculating' ? 'Calculando ruta…' : 'Crear ruta'}
        </Button>

        {errorMessage && (
          <div className="rounded-2xl bg-[#fff4f4] px-3 py-3 text-sm text-[var(--color-danger)]" role="alert">
            {errorMessage}
          </div>
        )}

        {activeDraft && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {status === 'editing' ? (
                <>
                  <Button onClick={saveEdits}>Guardar cambios</Button>
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
                Guardar
              </Button>
              <GPXExporter
                route={activeDraft}
                onPremiumRequired={() => showPaywall('gpx_export')}
              />
              <GPXImporter onImported={setDraftFromImport} />
            </div>
            {saveMessage && <p className="text-sm text-[var(--color-trail)]">{saveMessage}</p>}
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

        <div className="space-y-4 border-t border-[var(--color-fog)] bg-[color-mix(in_oklab,var(--color-mist)_90%,white)] p-4">
          {activeDraft ? (
            <>
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
            </>
          ) : (
            <p className="text-sm text-[var(--color-stone)]">
              Elige inicio y destino, pulsa <strong>Crear ruta</strong> y verás distancia, desnivel,
              tiempo y el perfil de elevación.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
