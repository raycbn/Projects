import clsx from 'clsx'
import type { RouteAlternative } from '@/domain/types'
import { formatDistance, formatElevation } from '@/lib/stats'
import { isRouteOptionPremiumLocked } from '@/lib/routeOptionAccess'

type Props = {
  options: RouteAlternative[]
  selectedOptionId?: string
  isPremium: boolean
  onSelect: (optionId: string) => void
  onPremiumRequired: () => void
  /** Compact label for planner / ready page */
  heading?: string
}

/**
 * Ranked route options (Opción 1..N). Free sees Opción 3+ locked with Premium CTA.
 */
export function RouteOptionsPicker({
  options,
  selectedOptionId,
  isPremium,
  onSelect,
  onPremiumRequired,
  heading,
}: Props) {
  if (options.length < 2) return null
  const activeId = selectedOptionId ?? options[0]?.id

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        {heading ?? `Opciones (${options.length})`}
      </p>
      <p className="text-xs text-[var(--color-stone)]">
        Elige la variante con mejor superficie o menos desnivel.
        {!isPremium ? ' La 3.ª opción es Premium.' : ''}
      </p>
      {options.map((opt, index) => {
        const active = activeId === opt.id
        const locked = isRouteOptionPremiumLocked(opt, isPremium, index)
        const score = opt.stats.surfaceStats?.suitability?.score
        return (
          <button
            key={opt.id}
            type="button"
            className={clsx(
              'w-full rounded-xl px-3 py-2 text-left text-xs ring-1 transition',
              locked
                ? 'bg-[color-mix(in_oklab,var(--color-mist)_70%,white)] font-semibold text-[var(--color-stone)] ring-[var(--color-fog)]'
                : active
                  ? 'bg-[var(--color-signal)] font-semibold ring-[var(--color-trail)]'
                  : 'bg-[var(--color-mist)] font-semibold ring-[var(--color-fog)]',
            )}
            onClick={() => {
              if (locked) {
                onPremiumRequired()
                return
              }
              onSelect(opt.id)
            }}
          >
            <span className="block">
              {opt.label}
              {locked ? ' · Premium' : active ? ' · activa' : ''}
            </span>
            <span className="mt-0.5 block font-medium opacity-80">
              {formatDistance(opt.stats.distanceMeters)} ·{' '}
              {formatElevation(opt.stats.elevationGainMeters)}
              {score != null ? ` · aptitud ${Math.round(score)}` : ''}
              {locked ? ' · desbloquear' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
