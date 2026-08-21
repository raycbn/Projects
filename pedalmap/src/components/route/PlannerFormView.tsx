import type { ReactNode } from 'react'
import { SearchLocation } from '@/components/route/SearchLocation'
import { BikeSelector } from '@/components/route/BikeSelector'
import { BikeComparePanel } from '@/components/route/BikeComparePanel'
import { RoutePreferencesPanel } from '@/components/route/RoutePreferences'
import { RouteSummary } from '@/components/route/RouteSummary'
import { RouteOptionsPicker } from '@/components/route/RouteOptionsPicker'
import { RideComparisonPanel } from '@/components/route/RideComparisonPanel'
import { PlannerCtaBar } from '@/components/route/PlannerCtaBar'
import { Button } from '@/components/ui/Button'
import { GPXImporter } from '@/components/gpx/GPXImporter'
import { formatDistance } from '@/lib/stats'
import type { BikeCompareRow } from '@/lib/bikeCompare'
import type { RankedRideOption } from '@/domain/pedalScore'
import type {
  BikeType,
  LatLng,
  PlannerStatus,
  RouteDraft,
  RoutePreference,
  RouteType,
  UserProfile,
  Waypoint,
} from '@/domain/types'

interface PlannerFormViewProps {
  modeChips: ReactNode
  routeType: RouteType
  status: PlannerStatus
  waypoints: Waypoint[]
  locating: boolean
  onLocate: () => void
  canReset: boolean
  onResetPlan: () => void
  onSetStart: (place: { position: LatLng; label: string }) => void
  onSetEnd: (place: { position: LatLng; label: string }) => void
  onAddVia: (position: LatLng, label: string) => void
  onUpdateWaypointPosition: (id: string, position: LatLng, label: string) => void
  onRemoveWaypoint: (id: string) => void
  onMoveWaypoint: (id: string, direction: -1 | 1) => void
  viaQueryOpen: boolean
  onToggleViaQuery: () => void
  circularDistanceMeters: number
  onCircularDistanceChange: (meters: number) => void
  targetElevationGainMeters: number
  onTargetElevationChange: (meters: number) => void
  bikeType: BikeType
  onBikeTypeChange: (t: BikeType) => void
  compareBusy: boolean
  canCalculate: boolean
  onCompare: () => void
  compareRows: BikeCompareRow[] | null
  onPickCompare: (row: BikeCompareRow) => void
  onCloseCompare: () => void
  preferences: RoutePreference[]
  onPreferencesChange: (p: RoutePreference[]) => void
  profile: UserProfile | null
  onLimitReached: (reason: string) => void
  wantAlternatives: boolean
  onWantAlternativesChange: (value: boolean) => void
  panelError: string | null
  activeDraft: RouteDraft | null
  surfaceAlert: string | null
  objetivoFeedback: string | null
  onSelectRouteOption: (optionId: string) => void
  onPremiumRequired: () => void
  onSelectAlternative: (index: number) => void
  onAnotherVariant: () => void
  onGoToReady: () => void
  onAdjustOnMap: () => void
  onGpxImported: (d: RouteDraft) => void
  onSaveEdits: () => void
  onCancelEditing: () => void
  onSelectRide?: (optionId: string) => void
  rideRecommendations?: RankedRideOption[]
  ctaDisabled: boolean
  ctaLabel: string
  onCreate: () => void
}

/**
 * Standard planner form for A→B, Ida y vuelta and Objetivo (circular).
 * Map-free by design so it stays fast and thumb-friendly to fill in
 * on mobile before jumping to the map/results.
 */
export function PlannerFormView({
  modeChips,
  routeType,
  status,
  waypoints,
  locating,
  onLocate,
  canReset,
  onResetPlan,
  onSetStart,
  onSetEnd,
  onAddVia,
  onUpdateWaypointPosition,
  onRemoveWaypoint,
  onMoveWaypoint,
  viaQueryOpen,
  onToggleViaQuery,
  circularDistanceMeters,
  onCircularDistanceChange,
  targetElevationGainMeters,
  onTargetElevationChange,
  bikeType,
  onBikeTypeChange,
  compareBusy,
  canCalculate,
  onCompare,
  compareRows,
  onPickCompare,
  onCloseCompare,
  preferences,
  onPreferencesChange,
  profile,
  onLimitReached,
  wantAlternatives,
  onWantAlternativesChange,
  panelError,
  activeDraft,
  surfaceAlert,
  objetivoFeedback,
  onSelectRouteOption,
  onPremiumRequired,
  onSelectAlternative,
  onAnotherVariant,
  onGoToReady,
  onAdjustOnMap,
  onGpxImported,
  onSaveEdits,
  onCancelEditing,
  onSelectRide,
  rideRecommendations,
  ctaDisabled,
  ctaLabel,
  onCreate,
}: PlannerFormViewProps) {
  const editing = status === 'editing'

  return (
    <div className="mx-auto min-h-[calc(100dvh-var(--header-h,3.5rem))] max-w-lg pb-24 md:pb-0">
      <div className="space-y-4 px-4 py-4 md:px-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--color-forest)]">
            Crear ruta
          </h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            Busca puntos o elige <strong>Trazar</strong> para dibujar en el mapa.
          </p>
        </div>

        {modeChips}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="flex-1" disabled={locating} onClick={onLocate}>
            {locating ? 'Localizando…' : 'Estoy aquí'}
          </Button>
          {canReset && (
            <Button variant="ghost" onClick={onResetPlan}>
              Empezar otra
            </Button>
          )}
        </div>

        <SearchLocation
          label="Inicio"
          placeholder="¿Dónde empiezas?"
          valueLabel={waypoints.find((w) => w.kind === 'start')?.name}
          onSelect={onSetStart}
        />

        {routeType !== 'circular' && (
          <>
            {waypoints
              .filter((w) => w.kind === 'via')
              .map((w) => (
                <div key={w.id} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[12rem] flex-1 basis-[12rem]">
                    <SearchLocation
                      label="Waypoint"
                      placeholder="Punto intermedio"
                      valueLabel={w.name}
                      onSelect={(place) => onUpdateWaypointPosition(w.id, place.position, place.label)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => onRemoveWaypoint(w.id)}>
                      Quitar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Subir waypoint"
                      onClick={() => onMoveWaypoint(w.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Bajar waypoint"
                      onClick={() => onMoveWaypoint(w.id, 1)}
                    >
                      ↓
                    </Button>
                  </div>
                </div>
              ))}
            <Button size="sm" variant="ghost" onClick={onToggleViaQuery}>
              {viaQueryOpen ? 'Cerrar waypoint' : 'Añadir waypoint'}
            </Button>
            {viaQueryOpen && (
              <SearchLocation
                label="Punto intermedio"
                placeholder="Añade un punto entre origen y destino"
                onSelect={(place) => onAddVia(place.position, place.label)}
              />
            )}
            <SearchLocation
              label="Destino"
              placeholder="¿Dónde quieres llegar?"
              valueLabel={waypoints.find((w) => w.kind === 'end')?.name}
              onSelect={onSetEnd}
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
                onChange={(e) => onCircularDistanceChange(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--color-trail)]"
              />
              <span className="text-xs text-[var(--color-stone)]">
                {formatDistance(circularDistanceMeters)}
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-[var(--color-forest)]">
                Desnivel objetivo (opcional)
              </span>
              <input
                type="range"
                min={0}
                max={2500}
                step={50}
                value={targetElevationGainMeters}
                onChange={(e) => onTargetElevationChange(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--color-trail)]"
              />
              <span className="text-xs text-[var(--color-stone)]">
                {targetElevationGainMeters > 0 ? `${targetElevationGainMeters} m` : 'Sin objetivo'}
              </span>
            </label>
          </div>
        )}

        <BikeSelector value={bikeType} onChange={onBikeTypeChange} />

        <Button
          variant="ghost"
          className="w-full"
          disabled={compareBusy || !canCalculate}
          onClick={onCompare}
        >
          {compareBusy ? 'Comparando…' : 'Comparar Carretera / Gravel / MTB'}
        </Button>
        {compareRows && (
          <BikeComparePanel
            rows={compareRows}
            busy={compareBusy}
            onPick={onPickCompare}
            onClose={onCloseCompare}
          />
        )}

        <RoutePreferencesPanel
          value={preferences}
          onChange={onPreferencesChange}
          profile={profile}
          onLimitReached={onLimitReached}
        />

        {(routeType === 'a_to_b' || routeType === 'out_and_back') && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-trail)]"
              checked={wantAlternatives}
              onChange={(e) => onWantAlternativesChange(e.target.checked)}
            />
            Pedir varias opciones (hasta 3 · la 3.ª es Premium)
          </label>
        )}

        {panelError && (
          <div className="rounded-2xl bg-[#fff4f4] px-3 py-3 text-sm text-[var(--color-danger)]" role="alert">
            {panelError}
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

            {(activeDraft.routeOptions?.length ?? 0) > 1 && (
              <RouteOptionsPicker
                options={activeDraft.routeOptions!}
                selectedOptionId={activeDraft.selectedOptionId}
                isPremium={profile?.plan === 'premium'}
                onSelect={onSelectRouteOption}
                onPremiumRequired={onPremiumRequired}
              />
            )}

            {!activeDraft.routeOptions?.length &&
              activeDraft.alternatives &&
              activeDraft.alternatives.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-[var(--color-signal)] px-3 py-1.5 text-xs font-semibold"
                    onClick={() => onSelectAlternative(0)}
                  >
                    Principal
                  </button>
                  {activeDraft.alternatives.map((alt, index) => (
                    <button
                      key={alt.id}
                      type="button"
                      className="rounded-xl bg-[var(--color-mist)] px-3 py-1.5 text-xs font-semibold ring-1 ring-[var(--color-fog)]"
                      onClick={() => onSelectAlternative(index + 1)}
                    >
                      {alt.label} · {formatDistance(alt.stats.distanceMeters)}
                    </button>
                  ))}
                </div>
              )}

            {rideRecommendations && onSelectRide && (
              <RideComparisonPanel
                ranked={rideRecommendations}
                activeOptionId={activeDraft.selectedOptionId}
                onSelect={onSelectRide}
              />
            )}

            {routeType === 'circular' && (
              <Button
                variant="secondary"
                className="w-full"
                disabled={status === 'calculating' || !canCalculate}
                onClick={onAnotherVariant}
              >
                Otra variante
              </Button>
            )}

            <Button
              className="w-full !py-3"
              disabled={editing || status === 'calculating'}
              onClick={onGoToReady}
            >
              Ver ruta lista
            </Button>

            <Button variant="ghost" className="w-full" onClick={onResetPlan}>
              Empezar otra ruta
            </Button>

            <div className="flex flex-wrap gap-2">
              {editing ? (
                <>
                  <Button size="sm" onClick={onSaveEdits}>
                    Recalcular
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCancelEditing}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={onAdjustOnMap}>
                  Ajustar en mapa
                </Button>
              )}
              <GPXImporter onImported={onGpxImported} />
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
              <GPXImporter onImported={onGpxImported} />
            </div>
          </div>
        )}
      </div>

      <PlannerCtaBar
        variant="fixed-on-mobile"
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
