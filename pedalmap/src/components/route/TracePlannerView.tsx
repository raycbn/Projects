import { Suspense, lazy, type ReactNode } from 'react'
import type { FeatureCollection } from 'geojson'
import clsx from 'clsx'
import { BikeSelector } from '@/components/route/BikeSelector'
import { RoutePreferencesPanel } from '@/components/route/RoutePreferences'
import { RouteSummary } from '@/components/route/RouteSummary'
import { RouteOptionsPicker } from '@/components/route/RouteOptionsPicker'
import { TraceReadyPanel } from '@/components/route/TraceReadyPanel'
import { RideComparisonPanel } from '@/components/route/RideComparisonPanel'
import { WaterContextPanel } from '@/components/route/WaterContextPanel'
import { WeatherContextPanel } from '@/components/route/WeatherContextPanel'
import { BestDeparturePanel } from '@/components/route/BestDeparturePanel'
import { PlannerCtaBar } from '@/components/route/PlannerCtaBar'
import { Button } from '@/components/ui/Button'
import type {
  BikeType,
  LatLng,
  PlannerStatus,
  RouteDraft,
  RouteGeometry,
  RoutePreference,
  UserProfile,
  Waypoint,
} from '@/domain/types'
import type { RankedRideOption } from '@/domain/pedalScore'
import type { RouteWeatherPoint, RouteWeatherTimeline } from '@/domain/routeWeatherTimeline'
import type { BestDepartureResult, DepartureWindow } from '@/domain/routeBestDeparture'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

interface TraceWindState {
  overlay: FeatureCollection | null
  caption: string | null
  showArrows: boolean
  loading: boolean
}

interface TracePlannerViewProps {
  modeChips: ReactNode
  mapExpanded: boolean
  waypoints: Waypoint[]
  activeDraft: RouteDraft | null
  alternateGeometries: RouteGeometry[] | null
  hoverPoint: LatLng | null
  surfaceOverlay: FeatureCollection | null
  traceWind: TraceWindState
  showCycleNetwork: boolean
  onToggleCycleNetwork: () => void
  showWaterSources: boolean
  onToggleWaterSources: () => void
  waterOverlay: FeatureCollection | null
  weatherTimeline: RouteWeatherTimeline | undefined
  weatherLoading?: boolean
  weatherDegraded?: boolean
  weatherReason?: string | undefined
  onSelectWeatherPoint?: (point: RouteWeatherPoint) => void
  fitKey: string
  onMapClick: (position: LatLng) => void
  onWaypointDrag: (id: string, position: LatLng) => void
  status: PlannerStatus
  bikeModalityLabel: string
  tapHint: string | null
  traceSheetOpen: boolean
  onToggleSheet: () => void
  locating: boolean
  onLocate: () => void
  canReset: boolean
  onResetPlan: () => void
  onRemoveWaypoint: (id: string) => void
  bikeType: BikeType
  onBikeTypeChange: (t: BikeType) => void
  preferences: RoutePreference[]
  onPreferencesChange: (p: RoutePreference[]) => void
  profile: UserProfile | null
  onLimitReached: (reason: string) => void
  wantAlternatives: boolean
  onWantAlternativesChange: (value: boolean) => void
  panelError: string | null
  surfaceAlert: string | null
  onSelectRouteOption: (optionId: string) => void
  onPremiumRequired: () => void
  onWindOverlayChange: (v: TraceWindState) => void
  onSaveEdits: () => void
  onCancelEditing: () => void
  onGoToReady: () => void
  ctaDisabled: boolean
  ctaLabel: string
  onCreate: () => void
  onSelectRide?: (optionId: string) => void
  rideRecommendations?: RankedRideOption[]
  departureResult?: BestDepartureResult | undefined
  departureLoading?: boolean
  departureDegraded?: boolean
  departureReason?: string | undefined
  onSelectDepartureWindow?: (window: DepartureWindow) => void
}

/**
 * "Trazar en mapa" mode: the map is the protagonist, with a draggable
 * bottom sheet holding the bike/preferences form and results. Mirrors
 * Strava-style tap-to-draw flows so it stays legible while riding or
 * planning one-handed on a phone.
 */
export function TracePlannerView({
  modeChips,
  mapExpanded,
  waypoints,
  activeDraft,
  alternateGeometries,
  hoverPoint,
  surfaceOverlay,
  traceWind,
  showCycleNetwork,
  onToggleCycleNetwork,
  showWaterSources,
  onToggleWaterSources,
  waterOverlay,
  fitKey,
  onMapClick,
  onWaypointDrag,
  status,
  bikeModalityLabel,
  tapHint,
  traceSheetOpen,
  onToggleSheet,
  locating,
  onLocate,
  canReset,
  onResetPlan,
  onRemoveWaypoint,
  bikeType,
  onBikeTypeChange,
  preferences,
  onPreferencesChange,
  profile,
  onLimitReached,
  wantAlternatives,
  onWantAlternativesChange,
  panelError,
  surfaceAlert,
  onSelectRouteOption,
  onPremiumRequired,
  onWindOverlayChange,
  onSaveEdits,
  onCancelEditing,
  onGoToReady,
  ctaDisabled,
  ctaLabel,
  onCreate,
  onSelectRide,
  rideRecommendations,
  weatherTimeline,
  weatherLoading,
  weatherDegraded,
  weatherReason,
  onSelectWeatherPoint,
  departureResult,
  departureLoading,
  departureDegraded,
  departureReason,
  onSelectDepartureWindow,
}: TracePlannerViewProps) {
  const editing = status === 'editing'

  return (
    <div
      className={clsx(
        'relative flex min-h-[calc(100dvh-var(--header-h,3.5rem))] flex-col bg-[var(--color-fog)]',
        mapExpanded && 'max-lg:fixed max-lg:inset-0 max-lg:z-50',
      )}
    >
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
            alternateGeometries={alternateGeometries}
            hoverPoint={hoverPoint}
            surfaceOverlay={surfaceOverlay}
            windOverlay={traceWind.overlay}
            windCaption={traceWind.caption}
            showWindArrows={traceWind.showArrows}
            showCycleNetwork={showCycleNetwork}
            showWaterSources={showWaterSources}
            waterOverlay={waterOverlay}
            fitKey={fitKey}
            onMapClick={onMapClick}
            onWaypointDrag={onWaypointDrag}
          />
        </Suspense>

        <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap gap-2">{modeChips}</div>

        <div className="absolute right-3 top-[4.75rem] z-10 flex flex-col items-end gap-2">
          <button
            type="button"
            className={clsx(
              'rounded-xl px-3 py-2 text-xs font-semibold shadow-sm ring-1 ring-[var(--color-fog)] transition',
              showCycleNetwork
                ? 'bg-[var(--color-forest)] text-white'
                : 'bg-white/95 text-[var(--color-forest)]',
            )}
            aria-pressed={showCycleNetwork}
            title="Redes ciclistas señalizadas (EuroVelo, Vías Verdes…) — capa gratis, datos OSM"
            onClick={onToggleCycleNetwork}
          >
            {showCycleNetwork ? 'Ocultar red ciclista' : 'Ver red ciclista'}
          </button>
          <button
            type="button"
            className={clsx(
              'rounded-xl px-3 py-2 text-xs font-semibold shadow-sm ring-1 ring-[var(--color-fog)] transition',
              showWaterSources
                ? 'bg-[var(--color-signal)] text-white'
                : 'bg-white/95 text-[var(--color-forest)]',
            )}
            aria-pressed={showWaterSources}
            title="Fuentes de agua en la ruta — datos OSM"
            onClick={onToggleWaterSources}
          >
            {showWaterSources ? 'Ocultar fuentes' : '💧 Fuentes agua'}
          </button>
        </div>

        {traceWind.loading && activeDraft && !traceWind.overlay?.features?.length ? (
          <p className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-[var(--color-forest)] shadow-sm ring-1 ring-[var(--color-fog)]">
            Cargando viento…
          </p>
        ) : null}

        {status === 'calculating' && (
          <p className="pointer-events-none absolute left-3 top-24 z-10 max-w-[min(92%,20rem)] rounded-xl bg-white/95 px-3 py-2 text-sm font-medium text-[var(--color-forest)] shadow-sm animate-pulse-soft">
            Buscando mejores caminos y superficie para {bikeModalityLabel}…
          </p>
        )}
      </div>

      <div
        className={clsx(
          'z-20 flex flex-col rounded-t-2xl border-t border-[var(--color-fog)] bg-white/95 backdrop-blur transition-[max-height] duration-200 ease-out',
          traceSheetOpen
            ? activeDraft
              ? 'max-h-[62vh]'
              : 'max-h-[48vh]'
            : 'max-h-[3.25rem] overflow-hidden',
        )}
      >
        <button
          type="button"
          className="flex w-full shrink-0 flex-col items-center gap-1.5 pt-2 pb-1"
          onClick={onToggleSheet}
          aria-expanded={traceSheetOpen}
        >
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-fog)]" aria-hidden="true" />
        </button>

        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-fog)] px-4 pb-2">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-forest)]">
            {status === 'calculating'
              ? `Optimizando · ${bikeModalityLabel}`
              : editing
                ? 'Ajustando ruta · recalcula al terminar'
                : tapHint ?? 'Trazar en mapa'}
          </p>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-[var(--color-mist)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-forest)]"
            onClick={onToggleSheet}
          >
            {traceSheetOpen ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <div
          className={clsx(
            'min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3',
            !traceSheetOpen && 'hidden',
          )}
        >
          <div>
            <h1 className="font-display text-xl font-extrabold text-[var(--color-forest)]">
              Trazar en mapa
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-stone)]">
              Toca puntos como en Strava. PedalMap busca la mejor red para{' '}
              <strong className="text-[var(--color-forest)]">{bikeModalityLabel}</strong> (superficie
              y tipo de vía), no solo la línea recta.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={locating} onClick={onLocate}>
              {locating ? 'Localizando…' : 'Estoy aquí'}
            </Button>
            {canReset && (
              <Button size="sm" variant="ghost" onClick={onResetPlan}>
                Empezar otra
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
                    <span className="min-w-0 truncate font-semibold text-[var(--color-forest)]">
                      {w.kind === 'start' ? 'Inicio' : w.kind === 'end' ? 'Destino' : `Punto ${i}`}
                      <span className="ml-2 font-normal text-[var(--color-stone)]">
                        {w.name || `${w.position.lat.toFixed(4)}, ${w.position.lng.toFixed(4)}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-[var(--color-danger)]"
                      onClick={() => onRemoveWaypoint(w.id)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
            </ul>
          )}

          <BikeSelector value={bikeType} onChange={onBikeTypeChange} />

          <RoutePreferencesPanel
            value={preferences}
            onChange={onPreferencesChange}
            profile={profile}
            onLimitReached={onLimitReached}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-trail)]"
              checked={wantAlternatives}
              onChange={(e) => onWantAlternativesChange(e.target.checked)}
            />
            Pedir varias opciones (hasta 3 · la 3.�� es Premium)
          </label>

          {panelError && (
            <div className="rounded-2xl bg-[#fff4f4] px-3 py-3 text-sm text-[var(--color-danger)]" role="alert">
              {panelError}
            </div>
          )}

          {activeDraft && (
            <div className="space-y-2">
              {(activeDraft.routeOptions?.length ?? 0) > 1 && (
                <RouteOptionsPicker
                  options={activeDraft.routeOptions!}
                  selectedOptionId={activeDraft.selectedOptionId}
                  isPremium={profile?.plan === 'premium'}
                  onSelect={onSelectRouteOption}
                  onPremiumRequired={onPremiumRequired}
                  heading={`Mejores opciones para ${bikeModalityLabel}`}
                />
              )}
              {activeDraft.stats.surfaceStats?.suitability && (
                <p className="rounded-2xl bg-[color-mix(in_oklab,var(--color-signal)_22%,white)] px-3 py-2 text-xs font-semibold text-[var(--color-forest)] ring-1 ring-[var(--color-trail)]/25">
                  Aptitud {bikeModalityLabel}:{' '}
                  {activeDraft.stats.surfaceStats.suitability.label.replaceAll('_', ' ')} ·{' '}
                  {Math.round(activeDraft.stats.surfaceStats.suitability.score)}/100
                  {activeDraft.stats.surfaceStats.suitability.notes[0]
                    ? ` · ${activeDraft.stats.surfaceStats.suitability.notes[0]}`
                    : ''}
                </p>
              )}
              <RouteSummary stats={activeDraft.stats} />
              {surfaceAlert && (
                <p className="rounded-2xl bg-[#fff8f0] px-3 py-2 text-xs text-[#9a4b00]">{surfaceAlert}</p>
              )}

              <WaterContextPanel
                waterPoints={[]}
                loading={false}
                degraded={false}
              />

              <WeatherContextPanel
                timeline={weatherTimeline}
                loading={weatherLoading}
                degraded={weatherDegraded}
                degradedReason={weatherReason}
                onSelectPoint={onSelectWeatherPoint}
              />

              <BestDeparturePanel
                result={departureResult}
                loading={departureLoading}
                degraded={departureDegraded}
                degradedReason={departureReason}
                onSelectWindow={onSelectDepartureWindow}
              />

              {rideRecommendations && onSelectRide && (
                <RideComparisonPanel
                  ranked={rideRecommendations}
                  activeOptionId={activeDraft.selectedOptionId}
                  onSelect={onSelectRide}
                />
              )}

              {!editing ? (
                <TraceReadyPanel
                  draft={activeDraft}
                  showPaywall={onLimitReached}
                  onWindOverlayChange={onWindOverlayChange}
                />
              ) : null}

              {editing ? (
                <div className="flex flex-wrap gap-2">
                  <Button className="flex-1" onClick={onSaveEdits}>
                    Recalcular
                  </Button>
                  <Button variant="ghost" className="flex-1" onClick={onCancelEditing}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={status === 'calculating'}
                    onClick={onGoToReady}
                  >
                    Ver ruta lista
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={onResetPlan}>
                    Empezar otra ruta
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <PlannerCtaBar
        variant="sticky"
        editing={editing}
        ctaLabel={ctaLabel}
        ctaDisabled={ctaDisabled}
        onCreate={onCreate}
        onSaveEdits={onSaveEdits}
        onCancelEdits={onCancelEditing}
      />
    </div>
  )
}
