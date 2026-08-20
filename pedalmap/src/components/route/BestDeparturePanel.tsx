import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import type { BestDepartureResult, DepartureWindow } from '@/domain/routeBestDeparture'

interface BestDeparturePanelProps {
  result: BestDepartureResult | undefined
  loading?: boolean
  degraded?: boolean
  degradedReason?: string
  onSelectWindow?: (window: DepartureWindow) => void
  className?: string
}

function stateClass(state: DepartureWindow['state']): string {
  switch (state) {
    case 'recommended':
      return 'border-l-[var(--color-trail)] bg-[color-mix(in_oklab,var(--color-signal)_12%,white)]'
    case 'alternative':
      return 'border-l-transparent bg-white'
    case 'unfavorable':
      return 'border-l-[var(--color-warning)] bg-[#fff8f0]'
    case 'not_viable':
      return 'border-l-[var(--color-danger)] bg-[#fff0f0] opacity-60'
    default:
      return 'border-l-transparent bg-white'
  }
}

function stateBadge(state: DepartureWindow['state']): string {
  switch (state) {
    case 'recommended':
      return 'RECOMENDADA'
    case 'alternative':
      return 'ALTERNATIVA'
    case 'unfavorable':
      return 'DESFAVORABLE'
    case 'not_viable':
      return 'NO VIABLE'
    default:
      return ''
  }
}

function stateBadgeClass(state: DepartureWindow['state']): string {
  switch (state) {
    case 'recommended':
      return 'bg-[var(--color-trail)] text-white'
    case 'alternative':
      return 'bg-[var(--color-fog)] text-[var(--color-forest)]'
    case 'unfavorable':
      return 'bg-[#efd2b0] text-[#9a4b00]'
    case 'not_viable':
      return 'bg-[#fecaca] text-[var(--color-danger)]'
    default:
      return 'bg-[var(--color-fog)] text-[var(--color-forest)]'
  }
}

export function BestDeparturePanel({
  result,
  loading = false,
  degraded = false,
  degradedReason,
  onSelectWindow,
  className,
}: BestDeparturePanelProps) {
  if (loading) {
    return (
      <section className={clsx('rounded-2xl bg-[var(--color-mist)]/70 px-3 py-3 animate-pulse-soft', className)}>
        <div className="h-4 w-40 rounded bg-[var(--color-fog)]" />
        <div className="mt-2 h-3 w-56 rounded bg-[var(--color-fog)]" />
      </section>
    )
  }

  if (degraded) {
    return (
      <section className={clsx('rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]', className)}>
        <p className="text-xs text-[var(--color-stone)]">
          No se pudo calcular la mejor hora.{degradedReason ? ` (${degradedReason})` : ''}
        </p>
      </section>
    )
  }

  if (!result?.windows.length) {
    return (
      <section className={clsx('rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]', className)}>
        <p className="text-xs text-[var(--color-stone)]">
          No hay ventanas disponibles para recomendar.
        </p>
      </section>
    )
  }

  const recommended = result.recommended ?? result.windows[0]

  return (
    <section className={clsx('rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]', className)}>
      <h2 className="font-display text-base font-bold text-[var(--color-forest)]">
        🕐 Mejor hora para salir
      </h2>

      {recommended && (
        <div className="mt-2 rounded-xl bg-white px-3 py-3 ring-1 ring-[var(--color-fog)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--color-forest)]">
                {recommended.label}
              </p>
              <p className="text-[11px] text-[var(--color-stone)]">
                {recommended.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                {recommended.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <span
              className={clsx(
                'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                stateBadgeClass(recommended.state),
              )}
            >
              {stateBadge(recommended.state)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-stone)]">
            {recommended.reasons.join(' · ') || 'Condiciones aceptables'}
          </p>
        </div>
      )}

      <ul className="mt-2 space-y-2" role="list" aria-label="Ventanas de salida">
        {result.windows.map((w, idx) => (
          <li
            key={idx}
            className={clsx(
              'rounded-xl px-3 py-2 ring-1 border-l-4',
              stateClass(w.state),
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-forest)]">
                  {w.label}
                </p>
                <p className="text-[11px] text-[var(--color-stone)]">
                  {w.score}/100
                  {w.reasons.length > 0 ? ` · ${w.reasons[0]}` : ''}
                </p>
              </div>
              {onSelectWindow && w.state !== 'not_viable' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onSelectWindow(w)}
                  className="shrink-0 !text-[11px] !px-2 !py-1"
                >
                  Usar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
