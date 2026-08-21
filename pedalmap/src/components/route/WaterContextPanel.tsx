import React from 'react'
import clsx from 'clsx'
import { formatDistance } from '@/lib/stats'
import { Button } from '@/components/ui/Button'
import type { WaterPoint } from '@/domain/routeEnricher'

interface WaterContextPanelProps {
  waterPoints: WaterPoint[] | undefined
  loading?: boolean
  degraded?: boolean
  degradedReason?: string
  onNavigate?: (source: WaterPoint) => void
  onFocusMap?: (source: WaterPoint) => void
  className?: string
}

export function WaterContextPanel({
  waterPoints,
  loading = false,
  degraded = false,
  degradedReason,
  onNavigate,
  onFocusMap,
  className,
}: WaterContextPanelProps) {
  const [selected, setSelected] = React.useState<WaterPoint | null>(null)

  if (loading) {
    return (
      <section className={clsx('rounded-2xl bg-[var(--color-mist)]/70 px-3 py-3 animate-pulse-soft', className)}>
        <div className="h-4 w-32 rounded bg-[var(--color-fog)]" />
        <div className="mt-2 h-3 w-48 rounded bg-[var(--color-fog)]" />
      </section>
    )
  }

  if (degraded) {
    return (
      <section className={clsx('rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]', className)}>
        <p className="text-xs text-[var(--color-stone)]">
          No se pudieron cargar las fuentes de agua.{degradedReason ? ` (${degradedReason})` : ''}
        </p>
      </section>
    )
  }

  if (!waterPoints?.length) {
    return (
      <section className={clsx('rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]', className)}>
        <p className="text-xs text-[var(--color-stone)]">
          No se detectaron fuentes de agua en esta ruta.
        </p>
      </section>
    )
  }

  const next = waterPoints[0]

  return (
    <section className={clsx('rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-[var(--color-forest)]">
          💧 Fuentes en ruta
        </h2>
        <span className="text-[11px] text-[var(--color-stone)]">
          {waterPoints.length} {waterPoints.length === 1 ? 'fuente' : 'fuentes'}
        </span>
      </div>

      {next && (
        <p className="mt-1 text-xs text-[var(--color-stone)]">
          Próxima fuente a {formatDistance(next.distanceAlongRouteMeters ?? 0)}
          {next.name ? ` · ${next.name}` : ''}
        </p>
      )}

      <ul className="mt-2 space-y-2" role="list" aria-label="Fuentes de agua en la ruta">
        {waterPoints.map((src) => (
          <li
            key={src.id}
            className="rounded-xl bg-white px-3 py-2 ring-1 ring-[var(--color-fog)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-forest)]">
                  {src.name ?? 'Fuente de agua'}
                </p>
                <p className="text-[11px] text-[var(--color-stone)]">
                  A {formatDistance(src.distanceAlongRouteMeters ?? 0)} del inicio
                  {src.detourMeters ? ` · +${formatDistance(src.detourMeters)} desvío` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelected(src)}
                  className="!text-[11px] !px-2 !py-1"
                >
                  Ver fuente
                </Button>
                {onNavigate && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onNavigate(src)}
                    className="!text-[11px] !px-2 !py-1"
                  >
                    Ir
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg rounded-t-2xl bg-white p-4 shadow-lg sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[var(--color-forest)]">
                  {selected.name ?? 'Fuente de agua'}
                </h3>
                <p className="mt-1 text-xs text-[var(--color-stone)]">
                  A {formatDistance(selected.distanceAlongRouteMeters ?? 0)} del inicio
                  {selected.detourMeters ? ` · +${formatDistance(selected.detourMeters)} desvío` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-[var(--color-stone)] hover:text-[var(--color-forest)]"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 space-y-1 text-xs text-[var(--color-stone)]">
              {selected.address && (
                <p>📍 Dirección: {selected.address}</p>
              )}
              {selected.access && (
                <p>🚲 Acceso: {selected.access}</p>
              )}
              {selected.drinkingWater && (
                <p>💧 Agua potable: {selected.drinkingWater}</p>
              )}
              {selected.description && (
                <p>ℹ️ {selected.description}</p>
              )}
              {selected.website && (
                <p>
                  🌐{' '}
                  <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    {selected.website}
                  </a>
                </p>
              )}
              {selected.phone && (
                <p>📞 {selected.phone}</p>
              )}
              <p className="text-[10px] text-[var(--color-stone)]/70">
                {selected.position.lat.toFixed(5)}, {selected.position.lng.toFixed(5)}
              </p>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
              {onFocusMap && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onFocusMap(selected)
                    setSelected(null)
                  }}
                  className="w-full sm:w-auto"
                >
                  Ver en mapa
                </Button>
              )}
              {onNavigate && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    onNavigate(selected)
                    setSelected(null)
                  }}
                  className="w-full sm:w-auto"
                >
                  Cómo llegar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
