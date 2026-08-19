import { Button } from '@/components/ui/Button'
import clsx from 'clsx'

interface PlannerCtaBarProps {
  editing: boolean
  ctaLabel: string
  ctaDisabled: boolean
  onCreate: () => void
  onSaveEdits: () => void
  onCancelEdits: () => void
  className?: string
  /** Fixed on mobile, inline on md+ (form flow). Trace flow keeps it sticky in both. */
  variant?: 'fixed-on-mobile' | 'sticky'
}

/**
 * Shared bottom action bar for the Planner. Keeps the primary CTA
 * consistent (size, position, safe-area padding) across the "Trazar"
 * bottom sheet and the standard A→B / Ida y vuelta / Objetivo form,
 * so riders always find the same button in the same place.
 */
export function PlannerCtaBar({
  editing,
  ctaLabel,
  ctaDisabled,
  onCreate,
  onSaveEdits,
  onCancelEdits,
  className,
  variant = 'sticky',
}: PlannerCtaBarProps) {
  return (
    <div
      className={clsx(
        'z-20 border-t border-[var(--color-fog)] bg-white/95 p-3 backdrop-blur safe-pb',
        variant === 'fixed-on-mobile' &&
          'fixed inset-x-0 bottom-0 md:static md:border-0 md:bg-transparent md:p-4 md:pt-0',
        variant === 'sticky' && 'sticky bottom-0',
        className,
      )}
    >
      <div className="mx-auto max-w-lg">
        {editing ? (
          <div className="flex gap-2">
            <Button className="flex-1 !py-3" onClick={onSaveEdits}>
              Recalcular
            </Button>
            <Button variant="ghost" className="flex-1 !py-3" onClick={onCancelEdits}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            className="w-full !py-3 text-base"
            disabled={ctaDisabled}
            onClick={onCreate}
          >
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
