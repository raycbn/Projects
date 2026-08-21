import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlanner } from '@/app/PlannerContext'
import { useAuth } from '@/app/AuthContext'
import { RouteModeChips } from '@/components/route/RouteModeChips'
import { TracePlannerView } from '@/components/route/TracePlannerView'
import { PlannerFormView } from '@/components/route/PlannerFormView'
import { PremiumCard } from '@/components/premium/PremiumCard'
import { track } from '@/lib/analytics'
import { buildSurfaceRouteOverlay, summarizeUnpavedAlert } from '@/lib/surfaceRouteOverlay'
import { formatDistance, formatElevation } from '@/lib/stats'
import { compareBikesForWaypoints, type BikeCompareRow } from '@/lib/bikeCompare'
import { recommendRide } from '@/domain/pedalScore'
import {
  readCycleNetworkOverlayPreference,
  writeCycleNetworkOverlayPreference,
  readWaterSourcesOverlayPreference,
  writeWaterSourcesOverlayPreference,
} from '@/lib/mapOverlays'
import { stashReadyRoute } from '@/lib/readyRouteHandoff'
import { routeCameraKey } from '@/lib/mapCamera'
import { getBikeModality } from '@/lib/bikeSurfaceProfile'
import { canCreateRoute, canUseAdvancedCircular } from '@/services/EntitlementService'
import { waterSourceService } from '@/services/WaterSourceService'
import { buildRouteWaterOverlay } from '@/lib/routeWaterOverlay'
import type { WaterPoint } from '@/domain/routeEnricher'
import type { FeatureCollection } from 'geojson'

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
    useMyLocationAsStart: myLocationAsStart,
    canCalculate,
    clearRoute,
    adjustOnMap,
    guestCreates,
  } = usePlanner()
  const { profile } = useAuth()
  const [locating, setLocating] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareRows, setCompareRows] = useState<BikeCompareRow[] | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [goingToReady, setGoingToReady] = useState(false)
  const [viaQueryOpen, setViaQueryOpen] = useState(false)
  const [traceSheetOpen, setTraceSheetOpen] = useState(true)
  const [traceWind, setTraceWind] = useState<{
    overlay: FeatureCollection | null
    caption: string | null
    showArrows: boolean
    loading: boolean
  }>({ overlay: null, caption: null, showArrows: true, loading: false })
  const [showCycleNetwork, setShowCycleNetwork] = useState(readCycleNetworkOverlayPreference)
  const [showWaterSources, setShowWaterSources] = useState(readWaterSourcesOverlayPreference)

  const isTrace = routeType === 'map_trace'
  const activeDraft = editDraft ?? draft
  const bikeModality = getBikeModality(bikeType)

  const [allWaterPoints, setAllWaterPoints] = useState<WaterPoint[]>([])

  const waterOverlay = useMemo(() => {
    if (!activeDraft?.geometry || !allWaterPoints.length) return null
    return buildRouteWaterOverlay(activeDraft.geometry, allWaterPoints)
  }, [activeDraft?.geometry, allWaterPoints])

  // Trazar = mapa protagonista; al salir del modo, colapsar.
  useEffect(() => {
    if (isTrace) {
      setMapExpanded(true)
      setTraceSheetOpen(true)
    } else {
      setMapExpanded(false)
      setTraceWind({ overlay: null, caption: null, showArrows: true, loading: false })
    }
  }, [isTrace])

  useEffect(() => {
    if (!activeDraft?.geometry) {
      setAllWaterPoints([])
      return
    }

    let cancelled = false

    waterSourceService
      .fetchForRoute(activeDraft.geometry)
      .then((result) => {
        if (cancelled) return
        setAllWaterPoints(result.allWaterPoints)
      })
      .catch(() => {
        if (cancelled) return
        setAllWaterPoints([])
      })

    return () => {
      cancelled = true
    }
  }, [activeDraft?.geometry])

  const fitKey = useMemo(
    () =>
      routeCameraKey(
        activeDraft?.geometry,
        activeDraft
          ? `${activeDraft.selectedOptionId ?? 'main'}-${Math.round(activeDraft.stats.distanceMeters)}`
          : `wp-${waypoints.length}`,
      ),
    [activeDraft, waypoints.length],
  )

  function handleGpxImported(d: Parameters<typeof setDraftFromImport>[0]) {
    setDraftFromImport(d)
    stashReadyRoute({ draft: d, source: 'import', fitNonce: Date.now() })
    navigate('/ruta')
  }

  const surfaceOverlay = useMemo(() => {
    if (!activeDraft?.geometry) return null
    return buildSurfaceRouteOverlay(activeDraft.geometry, activeDraft.surfaceEdges)
  }, [activeDraft])

  const alternateGeometries = useMemo(() => {
    const opts = activeDraft?.routeOptions
    if (!opts || opts.length < 2) return null
    const selected = activeDraft.selectedOptionId ?? opts[0]?.id
    return opts
      .filter((o) => o.id !== selected)
      .map((o) => o.geometry)
      .filter((g) => (g?.coordinates?.length ?? 0) >= 2)
  }, [activeDraft?.routeOptions, activeDraft?.selectedOptionId])

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
    const actualD = activeDraft.stats.distanceMeters
    const actualE = activeDraft.stats.elevationGainMeters
    const match = activeDraft.objectiveMatch

    const distErr = targetD && targetD > 0 ? Math.abs(actualD - targetD) / targetD : 0
    const elevErr = targetE && targetE > 0 ? Math.abs(actualE - targetE) / targetE : 0

    if (match === 'within_tolerance' || (distErr <= 0.15 && elevErr <= 0.5)) {
      return { status: 'Objetivo conseguido', actual: `${formatDistance(actualD)} · +${formatElevation(actualE)}` }
    }
    if (distErr <= 0.25 && elevErr <= 0.8) {
      return { status: 'Objetivo aproximado', actual: `${formatDistance(actualD)} · +${formatElevation(actualE)}` }
    }
    return { status: 'Alternativa más cercana', actual: `${formatDistance(actualD)} · +${formatElevation(actualE)}` }
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
    // Prefer planner draft if it still holds more ranked options than the arg.
    const fromContext = draft && (draft.routeOptions?.length ?? 0) > (result.routeOptions?.length ?? 0)
      ? draft
      : result
    stashReadyRoute({ draft: fromContext, source: 'calculate' })
    navigate('/ruta')
  }

  const rankedRide = useMemo(() => {
    if (!activeDraft) return null
    return recommendRide(activeDraft)
  }, [activeDraft])

  const rideRecommendations = rankedRide && rankedRide.ranked.length > 1 ? rankedRide.ranked : null

  function handleSelectRide(optionId: string) {
    if (!rideRecommendations) return
    if (optionId === (activeDraft?.selectedOptionId ?? activeDraft?.routeOptions?.[0]?.id)) {
      return
    }
    selectRouteOption(optionId)
    track('planner_recommendation_selected', {
      option_id: optionId,
      ride_count: rideRecommendations.length,
    })
  }

  useEffect(() => {
    if (rankedRide && rankedRide.ranked.length > 1 && rankedRide.recommendedId) {
      track('planner_recommendations_generated', {
        ride_count: rankedRide.ranked.length,
        recommended_id: rankedRide.recommendedId,
      })
    }
  }, [rankedRide])

  async function handleCreate() {
    setGoingToReady(true)
    try {
      const result = await calculate()
      if (!result) return
      // Trazar stays on the map so wind / salir / share / save are usable in-place.
      // Other modes keep the existing jump to /ruta.
      if (isTrace) {
        stashReadyRoute({ draft: result, source: 'calculate' })
        setTraceSheetOpen(true)
      } else {
        goToReady(result)
      }
    } finally {
      setGoingToReady(false)
    }
  }

  async function handleLocate() {
    setLocating(true)
    try {
      await myLocationAsStart()
    } finally {
      setLocating(false)
    }
  }

  async function handleCompare() {
    if (!canCalculate) return
    if (routeType === 'circular' && !canUseAdvancedCircular(profile)) {
      showPaywall('circular_premium')
      return
    }
    const entitlement = canCreateRoute(profile, guestCreates)
    if (!entitlement.ok) {
      showPaywall(entitlement.reason ?? 'create_limit')
      return
    }
    setCompareBusy(true)
    setCompareRows(null)
    setCompareError(null)
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
      setCompareError(
        error instanceof Error && error.message
          ? `No se pudo comparar: ${error.message}`
          : 'No se pudo comparar Carretera / Gravel / MTB. Inténtalo de nuevo.',
      )
    } finally {
      setCompareBusy(false)
    }
  }

  function handlePickCompare(row: BikeCompareRow) {
    setCompareRows(null)
    const cleaned = {
      ...row.draft,
      title: row.draft.title.replace(/ · comparación$/i, ''),
    }
    // setDraftFromImport also applies bikeType — avoid setBikeType (clears draft).
    setDraftFromImport(cleaned)
    stashReadyRoute({ draft: cleaned, source: 'calculate' })
    navigate('/ruta')
  }

  const ctaDisabled = status === 'calculating' || goingToReady || !canCalculate
  const ctaLabel =
    status === 'calculating' || goingToReady
      ? `Optimizando · ${bikeModality.label}…`
      : activeDraft
        ? `Recalcular · ${bikeModality.label}`
        : isTrace
          ? `Calcular · ${bikeModality.label}`
          : 'Crear ruta'

  const panelError = errorMessage || compareError
  const canReset = waypoints.length > 0 || Boolean(activeDraft) || Boolean(panelError)

  function handleResetPlan() {
    clearRoute()
    setCompareRows(null)
    setCompareError(null)
    setViaQueryOpen(false)
  }

  const modeChips = <RouteModeChips value={routeType} onChange={setRouteType} />

  return (
    <>
      {paywallReason && <PremiumCard reason={paywallReason} onClose={clearPaywall} />}

      {isTrace ? (
        <TracePlannerView
          modeChips={modeChips}
          mapExpanded={mapExpanded}
          waypoints={waypoints}
          activeDraft={activeDraft}
          alternateGeometries={alternateGeometries}
          hoverPoint={hoverPoint}
          surfaceOverlay={surfaceOverlay}
          traceWind={traceWind}
          showCycleNetwork={showCycleNetwork}
          onToggleCycleNetwork={() =>
            setShowCycleNetwork((v) => {
              const next = !v
              writeCycleNetworkOverlayPreference(next)
              return next
            })
          }
          showWaterSources={showWaterSources}
          onToggleWaterSources={() => {
            const next = !showWaterSources
            setShowWaterSources(next)
            writeWaterSourcesOverlayPreference(next)
          }}
          waterOverlay={waterOverlay}
          fitKey={fitKey}
          onMapClick={handleMapTap}
          onWaypointDrag={(id, position) => updateWaypointPosition(id, position)}
          status={status}
          bikeModalityLabel={bikeModality.label}
          tapHint={tapHint}
          traceSheetOpen={traceSheetOpen}
          onToggleSheet={() => setTraceSheetOpen((v) => !v)}
          locating={locating}
          onLocate={() => void handleLocate()}
          canReset={canReset}
          onResetPlan={handleResetPlan}
          onRemoveWaypoint={removeWaypoint}
          bikeType={bikeType}
          onBikeTypeChange={setBikeType}
          preferences={preferences}
          onPreferencesChange={setPreferences}
          profile={profile}
          onLimitReached={(reason) => showPaywall(reason)}
          wantAlternatives={wantAlternatives}
          onWantAlternativesChange={setWantAlternatives}
          panelError={panelError}
          surfaceAlert={surfaceAlert}
          onSelectRouteOption={selectRouteOption}
          onPremiumRequired={() => showPaywall('route_option_premium')}
          onWindOverlayChange={setTraceWind}
          onSaveEdits={() => void saveEdits()}
          onCancelEditing={cancelEditing}
          onGoToReady={() => goToReady()}
          ctaDisabled={ctaDisabled}
          ctaLabel={ctaLabel}
          onCreate={() => void handleCreate()}
          onSelectRide={handleSelectRide}
          rideRecommendations={rideRecommendations ?? undefined}
        />
      ) : (
        <PlannerFormView
          modeChips={modeChips}
          routeType={routeType}
          status={status}
          waypoints={waypoints}
          locating={locating}
          onLocate={() => void handleLocate()}
          canReset={canReset}
          onResetPlan={handleResetPlan}
          onSetStart={(place) => setStart(place.position, place.label)}
          onSetEnd={(place) => setEnd(place.position, place.label)}
          onAddVia={addVia}
          onUpdateWaypointPosition={updateWaypointPosition}
          onRemoveWaypoint={removeWaypoint}
          onMoveWaypoint={moveWaypoint}
          viaQueryOpen={viaQueryOpen}
          onToggleViaQuery={() => setViaQueryOpen((v) => !v)}
          circularDistanceMeters={circularDistanceMeters}
          onCircularDistanceChange={setCircularDistanceMeters}
          targetElevationGainMeters={targetElevationGainMeters}
          onTargetElevationChange={setTargetElevationGainMeters}
          bikeType={bikeType}
          onBikeTypeChange={setBikeType}
          compareBusy={compareBusy}
          canCalculate={canCalculate}
          onCompare={() => void handleCompare()}
          compareRows={compareRows}
          onPickCompare={handlePickCompare}
          onCloseCompare={() => setCompareRows(null)}
          preferences={preferences}
          onPreferencesChange={setPreferences}
          profile={profile}
          onLimitReached={(reason) => showPaywall(reason)}
          wantAlternatives={wantAlternatives}
          onWantAlternativesChange={setWantAlternatives}
          panelError={panelError}
          activeDraft={activeDraft}
          surfaceAlert={surfaceAlert}
          objetivoFeedback={objetivoFeedback}
          onSelectRouteOption={selectRouteOption}
          onPremiumRequired={() => showPaywall('route_option_premium')}
          onSelectAlternative={selectAlternative}
          onAnotherVariant={() => void calculateAnotherVariant().then((r) => r && goToReady(r))}
          onGoToReady={() => goToReady()}
          onAdjustOnMap={() => adjustOnMap()}
          onGpxImported={handleGpxImported}
          onSaveEdits={() => void saveEdits()}
          onCancelEditing={cancelEditing}
          ctaDisabled={ctaDisabled}
          ctaLabel={ctaLabel}
          onCreate={() => void handleCreate()}
          onSelectRide={handleSelectRide}
          rideRecommendations={rideRecommendations ?? undefined}
        />
      )}
    </>
  )
}
