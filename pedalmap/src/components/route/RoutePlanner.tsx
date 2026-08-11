import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlanner } from '@/app/PlannerContext'
import { useAuth } from '@/app/AuthContext'
import { SearchLocation } from '@/components/route/SearchLocation'
import { BikeSelector } from '@/components/route/BikeSelector'
import { BikeComparePanel } from '@/components/route/BikeComparePanel'
import { RoutePreferencesPanel } from '@/components/route/RoutePreferences'
import { RouteSummary } from '@/components/route/RouteSummary'
import { PremiumCard } from '@/components/premium/PremiumCard'
import { Button } from '@/components/ui/Button'
import { GPXImporter } from '@/components/gpx/GPXImporter'
import { track } from '@/lib/analytics'
import { formatDistance, formatElevation } from '@/lib/stats'
import { buildSurfaceRouteOverlay, summarizeUnpavedAlert } from '@/lib/surfaceRouteOverlay'
import { compareBikesForWaypoints, type BikeCompareRow } from '@/lib/bikeCompare'
import { stashReadyRoute } from '@/lib/readyRouteHandoff'
import type { RouteType } from '@/domain/types'
import clsx from 'clsx'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

const MODE_CHIPS: Array<[RouteType, string]> = [
  ['a_to_b', 'A → B'],
  ['out_and_back', 'Ida y vuelta'],
  ['circular', 'Objetivo'],
  ['map_trace', 'Trazar'],
]

export function RoutePlanner() {
  const navigate = useNavigate()
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
    clearRoute,
  } = usePlanner()
  const { profile } = useAuth()
  const [locating, setLocating] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareRows, setCompareRows] = useState<BikeCompareRow[] | null>(null)
  const [goingToReady, setGoingToReady] = useState(false)
  const [viaQueryOpen, setViaQueryOpen] = useState(false)
  const [traceSheetOpen, setTraceSheetOpen] = useState(true)

  const isTrace = routeType === 'map_trace'
  const activeDraft = editDraft ?? draft

  // Trazar = mapa protagonista; al salir del modo, colapsar.
  useEffect(() => {
    if (isTrace) {
      setMapExpanded(true)
      setTraceSheetOpen(true)
    } else {
      setMapExpanded(false)
    }
  }, [isTrace])

  const fitKey = useMemo(
    () =>
      activeDraft
        ? `${activeDraft.stats.distanceMeters}-${activeDraft.geometry.coordinates.length}-${activeDraft.selectedOptionId ?? 'main'}`
        : `empty-${waypoints.length}`,
    [activeDraft, waypoints.length],
  )

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

  const tapHint = useMemo(() => {
    if (!isTrace) return null
    const hasStart = waypoints.some((w) => w.kind === 'start')
    const hasEnd = waypoints.some((w) => w.kind === 'end')
    if (!hasStart) return 'Toca el mapa: punto de inicio'
    if (!hasEnd) return 'Toca el mapa: destino'
    return 'Toca para alargar la ruta (máx. 5 puntos intermedios)'
  }, [isTrace, waypoints])

  function goToReady(result = activeDraft) {
    if (!result) return
    if (status === 'editing') return
    stashReadyRoute({ draft: result, source: 'calculate' })
    navigate('/ruta')
  }

  async function handleCreate() {
    setGoingToReady(true)
    try {
      const result = await calculate()
      if (result) goToReady(result)
    } finally {
      setGoingToReady(false)
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
        routeType: routeType === 'map_trace' ? 'a_to_b' : routeType,
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
    } finally {
      setCompareBusy(false)
    }
  }

  function handlePickCompare(row: BikeCompareRow) {
    setBikeType(row.bikeType)
    setCompareRows(null)
    const cleaned = {
      ...row.draft,
      title: row.draft.title.replace(/ · comparación$/i, ''),
    }
    setDraftFromImport(cleaned)
    stashReadyRoute({ draft: cleaned, source: 'calculate' })
    navigate('/ruta')
  }

  const ctaDisabled = status === 'calculating' || goingToReady || !canCalculate
  const ctaLabel =
    status === 'calculating' || goingToReady
      ? 'Calculando…'
      : activeDraft
        ? 'Recalcular ruta'
        : isTrace
          ? 'Calcular ruta trazada'
          : 'Crear ruta'

  const modeChips = (
    <div className="flex flex-wrap gap-2">
      {MODE_CHIPS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={clsx(
            'rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition',
            routeType === id
              ? 'bg-[var(--color-signal)] text-[var(--color-ink)] ring-[var(--color-trail)]'
              : 'bg-[var(--color-mist)] text-[var(--color-forest)] ring-[var(--color-fog)]',
          )}
          onClick={() => setRouteType(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )

  /** ——— Modo Trazar: mapa primero ——— */
  if (isTrace) {
    return (
      <div
        className={clsx(
          'relative flex min-h-[calc(100dvh-var(--header-h,3.5rem))] flex-col bg-[var(--color-fog)]',
          mapExpanded && 'max-lg:fixed max-lg:inset-0 max-lg:z-50',
        )}
      >
        {paywallReason && <PremiumCard reason={paywallReason} onClose={clearPaywall} />}

        <div className="relative min-h-0 flex-1">
          <Suspense
            fallback={
              <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-[var(--color-stone)]">
                Cargando mapa…
              </div>
            }
          >
            <MapView
              className="absolute inset-0 h-full w-full"
              waypoints={waypoints}
              geometry={activeDraft?.geometry}
              hoverPoint={hoverPoint}
              surfaceOverlay={surfaceOverlay}
              fitKey={fitKey}
              onMapClick={handleMapTap}
              onWaypointDrag={(id, position) => updateWaypointPosition(id, position)}
            />
          </Suspense>

          <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap gap-2">
            {modeChips}
          </div>

          {tapHint && status !== 'calculating' && (
            <p className="pointer-events-none absolute bottom-[min(42%,14rem)] left-3 z-10 max-w-[min(92%,18rem)] rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-[var(--color-forest)] shadow-sm ring-1 ring-[var(--color-fog)] lg:bottom-40">
              {tapHint}
            </p>
          )}

          {status === 'calculating' && (
            <p className="pointer-events-none absolute left-3 top-24 z-10 rounded-xl bg-white/95 px-3 py-2 text-sm font-medium text-[var(--color-forest)] shadow-sm animate-pulse-soft">
              Encajando tu trazado en la red ciclista…
            </p>
          )}

          <button
            type="button"
            className="absolute bottom-[min(38%,12.5rem)] right-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-[var(--color-forest)] shadow-sm ring-1 ring-[var(--color-fog)] lg:bottom-36"
            onClick={() => setTraceSheetOpen((v) => !v)}
          >
            {traceSheetOpen ? 'Ocultar panel' : 'Mostrar panel'}
          </button>
        </div>

        <div
          className={clsx(
            'z-20 border-t border-[var(--color-fog)] bg-white/95 backdrop-blur transition-[max-height] safe-pb',
            traceSheetOpen ? 'max-h-[48vh] overflow-y-auto' : 'max-h-0 overflow-hidden',
          )}
        >
          <div className="space-y-3 px-4 py-3">
            <div>
              <h1 className="font-display text-xl font-extrabold text-[var(--color-forest)]">
                Trazar en mapa
              </h1>
              <p className="mt-0.5 text-sm text-[var(--color-stone)]">
                Toca puntos como en Strava. PedalMap encaja la ruta por carreteras ciclables.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={locating}
                onClick={() => void handleLocate()}
              >
                {locating ? 'Localizando…' : 'Estoy aquí'}
              </Button>
              {waypoints.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const ids = waypoints.map((w) => w.id)
                    ids.forEach((id) => removeWaypoint(id))
                    clearRoute()
                    setCompareRows(null)
                  }}
                >
                  Borrar puntos
                </Button>
              )}
            </div>

            {waypoints.length > 0 && (
              <ul className="space-y-1.5">
                {[...waypoints]
                  .sort((a, b) => a.order - b.order)
                  .map((w, i) => (
                    <li
                      key={w.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-mist)] px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-[var(--color-forest)]">
                        {w.kind === 'start'
                          ? 'Inicio'
                          : w.kind === 'end'
                            ? 'Destino'
                            : `Punto ${i}`}
                        <span className="ml-2 font-normal text-[var(--color-stone)]">
                          {w.name || `${w.position.lat.toFixed(4)}, ${w.position.lng.toFixed(4)}`}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--color-danger)]"
                        onClick={() => removeWaypoint(w.id)}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
              </ul>
            )}

            <BikeSelector value={bikeType} onChange={setBikeType} />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-trail)]"
                checked={wantAlternatives}
                onChange={(e) => setWantAlternatives(e.target.checked)}
              />
              Pedir varias opciones (hasta 3)
            </label>

            {errorMessage && (
              <div
                className="rounded-2xl bg-[#fff4f4] px-3 py-3 text-sm text-[var(--color-danger)]"
                role="alert"
              >
                {errorMessage}
              </div>
            )}

            {activeDraft && (
              <div className="space-y-2">
                <RouteSummary stats={activeDraft.stats} />
                {surfaceAlert && (
                  <p className="rounded-2xl bg-[#fff8f0] px-3 py-2 text-xs text-[#9a4b00]">
                    {surfaceAlert}
                  </p>
                )}
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={status === 'editing' || status === 'calculating'}
                  onClick={() => goToReady()}
                >
                  Ver ruta lista
                </Button>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-[var(--color-fog)] bg-white/95 p-3">
            <Button
              className="w-full !py-3 text-base"
              disabled={ctaDisabled}
              onClick={() => void handleCreate()}
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /** ——— Modos A→B / Ida y vuelta / Objetivo: formulario, sin mapa ——— */
  return (
    <div className="mx-auto min-h-[calc(100dvh-var(--header-h,3.5rem))] max-w-lg">
      {paywallReason && <PremiumCard reason={paywallReason} onClose={clearPaywall} />}

      <div className="space-y-4 px-4 py-4 pb-28 md:px-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--color-forest)]">
            Crear ruta
          </h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            Busca puntos o elige <strong>Trazar</strong> para dibujar en el mapa.
          </p>
        </div>

        {modeChips}

        <Button
          variant="secondary"
          className="w-full"
          disabled={locating}
          onClick={() => void handleLocate()}
        >
          {locating ? 'Localizando…' : 'Estoy aquí'}
        </Button>

        <SearchLocation
          label="Inicio"
          placeholder="¿Dónde empiezas?"
          valueLabel={waypoints.find((w) => w.kind === 'start')?.name}
          onSelect={(place) => setStart(place.position, place.label)}
        />

        {routeType !== 'circular' && (
          <>
            {waypoints
              .filter((w) => w.kind === 'via')
              .map((w) => (
                <div key={w.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    <SearchLocation
                      label="Waypoint"
                      placeholder="Punto intermedio"
                      valueLabel={w.name}
                      onSelect={(place) => {
                        updateWaypointPosition(w.id, place.position)
                      }}
                    />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeWaypoint(w.id)}>
                    Quitar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => moveWaypoint(w.id, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => moveWaypoint(w.id, 1)}>
                    ↓
                  </Button>
                </div>
              ))}
            <Button size="sm" variant="ghost" onClick={() => setViaQueryOpen((v) => !v)}>
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
          <div className="space-y-3 rounded-2xl bg-[var(--color-mist)]/60 p-3">
            <label className="block text-sm">
              <span className="font-semibold text-[var(--color-forest)]">Distancia objetivo</span>
              <input
                type="range"
                min={5000}
                max={120000}
                step={1000}
                value={circularDistanceMeters}
                onChange={(e) => setCircularDistanceMeters(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--color-trail)]"
              />
              <span className="text-xs text-[var(--color-stone)]">
                {formatDistance(circularDistanceMeters)}
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-[var(--color-forest)]">
                Desnivel objetivo (Premium)
              </span>
              <input
                type="range"
                min={0}
                max={2500}
                step={50}
                value={targetElevationGainMeters}
                onChange={(e) => setTargetElevationGainMeters(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--color-trail)]"
              />
              <span className="text-xs text-[var(--color-stone)]">
                {targetElevationGainMeters > 0 ? `${targetElevationGainMeters} m` : 'Sin objetivo'}
              </span>
            </label>
          </div>
        )}

        <BikeSelector value={bikeType} onChange={setBikeType} />

        <Button
          variant="ghost"
          className="w-full"
          disabled={compareBusy || !canCalculate}
          onClick={() => void handleCompare()}
        >
          {compareBusy ? 'Comparando…' : 'Comparar Carretera / Gravel / MTB'}
        </Button>
        {compareRows && (
          <BikeComparePanel
            rows={compareRows}
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

        {(routeType === 'a_to_b' || routeType === 'out_and_back') && (
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
          <div className="space-y-3 border-t border-[var(--color-fog)] pt-4">
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

            {(draft?.routeOptions?.length ?? 0) > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                  Opciones ({draft!.routeOptions!.length})
                </p>
                {draft!.routeOptions!.map((opt) => {
                  const active =
                    (draft!.selectedOptionId ?? draft!.routeOptions![0]?.id) === opt.id
                  const score = opt.stats.surfaceStats?.suitability?.score
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={clsx(
                        'w-full rounded-xl px-3 py-2 text-left text-xs ring-1 transition',
                        active
                          ? 'bg-[var(--color-signal)] font-semibold ring-[var(--color-trail)]'
                          : 'bg-[var(--color-mist)] font-semibold ring-[var(--color-fog)]',
                      )}
                      onClick={() => selectRouteOption(opt.id)}
                    >
                      {opt.label}
                      {active ? ' · activa' : ''} · {formatDistance(opt.stats.distanceMeters)} ·{' '}
                      {formatElevation(opt.stats.elevationGainMeters)}
                      {score != null ? ` · aptitud ${Math.round(score)}` : ''}
                    </button>
                  )
                })}
              </div>
            )}

            {!draft?.routeOptions?.length &&
              draft?.alternatives &&
              draft.alternatives.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-[var(--color-signal)] px-3 py-1.5 text-xs font-semibold"
                    onClick={() => selectAlternative(0)}
                  >
                    Principal
                  </button>
                  {draft.alternatives.map((alt, index) => (
                    <button
                      key={alt.id}
                      type="button"
                      className="rounded-xl bg-[var(--color-mist)] px-3 py-1.5 text-xs font-semibold ring-1 ring-[var(--color-fog)]"
                      onClick={() => selectAlternative(index + 1)}
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
                onClick={() => void calculateAnotherVariant().then((r) => r && goToReady(r))}
              >
                Otra variante
              </Button>
            )}

            <Button
              className="w-full !py-3"
              disabled={status === 'editing' || status === 'calculating'}
              onClick={() => goToReady()}
            >
              Ver ruta lista
            </Button>

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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRouteType('map_trace')
                    startEditing()
                  }}
                >
                  Ajustar en mapa
                </Button>
              )}
              <GPXImporter onImported={setDraftFromImport} />
            </div>
          </div>
        )}

        {!activeDraft && (
          <div className="rounded-2xl border border-dashed border-[var(--color-fog)] bg-[var(--color-mist)]/40 px-4 py-5">
            <p className="text-sm text-[var(--color-stone)]">
              Elige inicio y destino (o Objetivo), pulsa <strong>Crear ruta</strong>. O usa{' '}
              <strong>Trazar</strong> para tocar puntos en el mapa.
            </p>
            <div className="mt-3">
              <GPXImporter
                onImported={(d) => {
                  setDraftFromImport(d)
                  stashReadyRoute({ draft: d, source: 'import' })
                  navigate('/ruta')
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--color-fog)] bg-white/95 p-3 backdrop-blur safe-pb md:static md:border-0 md:bg-transparent md:p-4 md:pt-0">
        <div className="mx-auto max-w-lg">
          <Button
            className="w-full !py-3 text-base"
            disabled={ctaDisabled}
            onClick={() => void handleCreate()}
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
