import type { RouteStats } from '@/domain/types'
import {
  difficultyLabel,
  formatDistance,
  formatDuration,
  formatElevation,
} from '@/lib/stats'
import { SurfaceBreakdown } from '@/components/route/SurfaceBreakdown'

interface RouteSummaryProps {
  stats: RouteStats
  compact?: boolean
}

export function RouteSummary({ stats, compact }: RouteSummaryProps) {
  const meta: Array<{ label: string; value: string }> = []
  if (!compact) {
    if (stats.highestPointMeters !== undefined) {
      meta.push({ label: 'Máx.', value: `${stats.highestPointMeters} m` })
    }
    if (stats.lowestPointMeters !== undefined) {
      meta.push({ label: 'Mín.', value: `${stats.lowestPointMeters} m` })
    }
    if (stats.significantClimbs !== undefined) {
      meta.push({ label: 'Ascensos', value: String(stats.significantClimbs) })
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl bg-white/90 px-4 py-4 ring-1 ring-[var(--color-fog)]"
        aria-label="Resumen de la ruta"
      >
        <p className="label-caps">Distancia</p>
        <p className="mt-1 font-display text-xl font-extrabold tracking-tight text-[var(--color-forest)] md:text-2xl">
          {formatDistance(stats.distanceMeters)}
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--color-fog)] pt-3">
          <div>
            <dt className="label-caps" title="Desnivel positivo ciclista (suma de subidas)">
              Desnivel +
            </dt>
            <dd className="mt-1 font-display text-lg font-bold text-[var(--color-forest)]">
              {formatElevation(stats.elevationGainMeters)}
            </dd>
          </div>
          <div>
            <dt className="label-caps">Tiempo</dt>
            <dd className="mt-1 font-display text-lg font-bold text-[var(--color-forest)]">
              {formatDuration(stats.estimatedDurationSeconds)}
            </dd>
          </div>
          <div>
            <dt className="label-caps">Dificultad</dt>
            <dd className="mt-1 font-display text-lg font-bold text-[var(--color-forest)]">
              {difficultyLabel(stats.difficulty)}
            </dd>
          </div>
        </dl>

        {(meta.length > 0 || stats.elevationLossMeters > 0) && (
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-stone)]">
            <span>Descenso {formatElevation(-stats.elevationLossMeters)}</span>
            {meta.map((item) => (
              <span key={item.label}>
                {item.label} {item.value}
              </span>
            ))}
          </p>
        )}

        {!compact && (
          <details className="mt-3 rounded-xl bg-[var(--color-mist)]/60 px-3 py-2 text-xs text-[var(--color-stone)]">
            <summary className="cursor-pointer font-semibold text-[var(--color-forest)]">
              ¿Por qué mi desnivel no coincide con Strava/Garmin?
            </summary>
            <p className="mt-2">
              PedalMap cuenta el desnivel como un GPS con barómetro (subidas de unos 3 m), igual
              al crear la ruta que al importar un GPX. El mapa no ve todos los lomos de 4–8 m, así
              que Garmin o Wahoo pueden marcar un poco más en terreno rompepiernas — nunca
              deberíamos quedarnos muy por debajo a propósito.
            </p>
          </details>
        )}
      </div>

      {!compact && stats.surfaceStats && <SurfaceBreakdown surfaceStats={stats.surfaceStats} />}
    </div>
  )
}
