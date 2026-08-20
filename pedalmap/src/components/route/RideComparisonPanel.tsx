import clsx from 'clsx'
import { formatDistance, formatDuration, formatElevation } from '@/lib/stats'
import { Button } from '@/components/ui/Button'
import type { RankedRideOption } from '@/domain/pedalScore'

interface RideComparisonPanelProps {
  ranked: RankedRideOption[]
  onSelect: (optionId: string) => void
  activeOptionId?: string
  loading?: boolean
}

export function RideComparisonPanel({
  ranked,
  onSelect,
  activeOptionId,
  loading = false,
}: RideComparisonPanelProps) {
  if (!ranked.length) return null

  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl bg-[var(--color-mist)]/70 px-3 py-3 text-sm animate-pulse-soft">
        Calculando alternativas…
      </div>
    )
  }

  return (
    <section className="space-y-3 rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
          Planifica mi salida
        </h2>
        <span className="text-[11px] text-[var(--color-stone)]">
          Hasta 3 alternativas reales
        </span>
      </div>
      <p className="text-xs text-[var(--color-stone)]">
        Elige la que mejor encaje. La recomendada destaca en verde.
      </p>
      <ul className="space-y-2" role="list" aria-label="Alternativas de ruta">
        {ranked.map((row) => (
          <li
            key={row.optionId}
            className={clsx(
              'rounded-xl px-3 py-3 ring-1 transition',
              row.recommended
                ? 'bg-[var(--color-signal)]/15 ring-[var(--color-trail)]'
                : 'bg-white ring-[var(--color-fog)]',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      row.recommended
                        ? 'bg-[var(--color-trail)] text-white'
                        : 'bg-[var(--color-fog)] text-[var(--color-forest)]',
                    )}
                  >
                    {row.label}
                    {row.recommended && ' · RECOMENDADA'}
                  </span>
                  <span className="font-display text-xl font-extrabold text-[var(--color-forest)]">
                    {row.score.total}
                    <span className="text-sm font-semibold text-[var(--color-stone)]">/100</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-stone)]">
                  {row.score.explanation}
                </p>
                <dl className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--color-stone)]">
                  <dt>Distancia:</dt>
                  <dd className="font-mono">{formatDistance(row.stats.distanceMeters)}</dd>
                  <dt>Desnivel +:</dt>
                  <dd className="font-mono">{formatElevation(row.stats.elevationGainMeters)}</dd>
                  <dt>Tiempo:</dt>
                  <dd className="font-mono">{formatDuration(row.stats.estimatedDurationSeconds)}</dd>
                  {row.stats.surfaceStats?.pavedPercent !== undefined && (
                    <>
                      <dt>Pavimento:</dt>
                      <dd className="font-mono">{Math.round(row.stats.surfaceStats.pavedPercent)}%</dd>
                    </>
                  )}
                </dl>
                {row.score.breakdown.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-[var(--color-forest)]">
                      Ver desglose PedalScore
                    </summary>
                    <ul className="mt-1 space-y-1 text-[10px] text-[var(--color-stone)]">
                      {row.score.breakdown.map((factor) => (
                        <li key={factor.id}>
                          <span className="font-medium">{factor.label}:</span>{' '}
                          {factor.points}/{factor.maxPoints}{' '}
                          <span className="font-mono">({Math.round((factor.points / factor.maxPoints) * 100)}%)</span>
                          {' — ' + factor.detail}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <Button
                size="sm"
                variant={activeOptionId === row.optionId ? 'primary' : 'secondary'}
                onClick={() => onSelect(row.optionId)}
                className="shrink-0"
              >
                {activeOptionId === row.optionId ? 'Activa' : 'Seleccionar'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
