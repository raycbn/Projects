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
  const items = [
    { label: 'Distancia', value: formatDistance(stats.distanceMeters) },
    {
      label: 'Desnivel +',
      value: formatElevation(stats.elevationGainMeters),
      hint: 'Desnivel positivo ciclista (suma de subidas, umbral DEM)',
    },
    { label: 'Desnivel −', value: formatElevation(-stats.elevationLossMeters) },
    { label: 'Tiempo', value: formatDuration(stats.estimatedDurationSeconds) },
    { label: 'Dificultad', value: difficultyLabel(stats.difficulty) },
  ]

  if (!compact) {
    if (stats.highestPointMeters !== undefined) {
      items.push({ label: 'Máx.', value: `${stats.highestPointMeters} m` })
    }
    if (stats.lowestPointMeters !== undefined) {
      items.push({ label: 'Mín.', value: `${stats.lowestPointMeters} m` })
    }
    if (stats.significantClimbs !== undefined) {
      items.push({ label: 'Ascensos', value: String(stats.significantClimbs) })
    }
  }

  return (
    <div className="space-y-4">
      <dl
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        aria-label="Resumen de la ruta"
      >
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl bg-white/70 px-3 py-3 ring-1 ring-[var(--color-fog)]"
            title={'hint' in item ? item.hint : undefined}
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
              {item.label}
            </dt>
            <dd className="mt-1 font-display text-xl font-bold text-[var(--color-forest)]">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      {!compact && stats.surfaceStats && (
        <SurfaceBreakdown surfaceStats={stats.surfaceStats} />
      )}
    </div>
  )
}
