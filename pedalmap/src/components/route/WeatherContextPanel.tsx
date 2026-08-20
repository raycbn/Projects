import clsx from 'clsx'
import { formatDistance } from '@/lib/stats'
import { Button } from '@/components/ui/Button'
import type { RouteWeatherPoint, RouteWeatherTimeline } from '@/domain/routeWeatherTimeline'

interface WeatherContextPanelProps {
  timeline: RouteWeatherTimeline | undefined
  loading?: boolean
  degraded?: boolean
  degradedReason?: string
  onSelectPoint?: (point: RouteWeatherPoint) => void
  className?: string
}

function relativeWindLabel(rel: RouteWeatherPoint['relativeWind']): string {
  switch (rel) {
    case 'cara':
      return 'cara'
    case 'cola':
      return 'cola'
    default:
      return 'lateral'
  }
}

function conditionClass(rel: RouteWeatherPoint['relativeWind'], precipMm: number): string {
  if (precipMm > 2) return 'border-l-[var(--color-danger)]'
  if (rel === 'cara') return 'border-l-[var(--color-warning)]'
  return 'border-l-transparent'
}

export function WeatherContextPanel({
  timeline,
  loading = false,
  degraded = false,
  degradedReason,
  onSelectPoint,
  className,
}: WeatherContextPanelProps) {
  if (loading) {
    return (
      <section className={clsx('rounded-2xl bg-[var(--color-mist)]/70 px-3 py-3 animate-pulse-soft', className)}>
        <div className="h-4 w-36 rounded bg-[var(--color-fog)]" />
        <div className="mt-2 h-3 w-48 rounded bg-[var(--color-fog)]" />
      </section>
    )
  }

  if (degraded) {
    return (
      <section className={clsx('rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]', className)}>
        <p className="text-xs text-[var(--color-stone)]">
          No se pudo cargar la previsión meteorológica.{degradedReason ? ` (${degradedReason})` : ''}
        </p>
      </section>
    )
  }

  if (!timeline?.points.length) {
    return (
      <section className={clsx('rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]', className)}>
        <p className="text-xs text-[var(--color-stone)]">
          Sin previsión meteorológica para esta ruta.
        </p>
      </section>
    )
  }

  return (
    <section className={clsx('rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-[var(--color-forest)]">
          🌤️ Clima en ruta
        </h2>
        <span className="text-[11px] text-[var(--color-stone)]">
          {timeline.points.length} puntos
        </span>
      </div>

      <ul className="mt-2 space-y-2" role="list" aria-label="Clima a lo largo de la ruta">
        {timeline.points.map((pt, idx) => (
          <li
            key={idx}
            className={clsx(
              'rounded-xl bg-white px-3 py-2 ring-1 ring-[var(--color-fog)] border-l-4',
              conditionClass(pt.relativeWind, pt.precipitationMm),
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-forest)]">
                  {new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  <span className="ml-2 text-[var(--color-stone)]">
                    · {formatDistance(pt.distanceAlongRouteMeters)}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--color-stone)]">
                  {Math.round(pt.temperatureC)}°C
                  {pt.precipitationMm > 0 ? ` · lluvia ${pt.precipitationMm.toFixed(1)} mm` : ' · sin lluvia'}
                  {' · viento '}
                  {Math.round(pt.windSpeedKmh)} km/h {relativeWindLabel(pt.relativeWind)}
                  {pt.windGustsKmh > 0 ? ` · rachas ${Math.round(pt.windGustsKmh)} km/h` : ''}
                </p>
              </div>
              {onSelectPoint && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onSelectPoint(pt)}
                  className="shrink-0 !text-[11px] !px-2 !py-1"
                >
                  Ver
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
