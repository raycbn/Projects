import clsx from 'clsx'
import type { BikeType } from '@/domain/types'

const OPTIONS: Array<{ id: BikeType; label: string }> = [
  { id: 'road', label: 'Carretera' },
  { id: 'mtb', label: 'MTB' },
  { id: 'gravel', label: 'Gravel' },
  { id: 'urban', label: 'Urbana' },
  { id: 'ebike', label: 'E-bike' },
]

interface BikeSelectorProps {
  value: BikeType
  onChange: (value: BikeType) => void
}

export function BikeSelector({ value, onChange }: BikeSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        Tipo de bicicleta
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de bicicleta">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={value === opt.id}
            onClick={() => onChange(opt.id)}
            className={clsx(
              'rounded-xl px-3 py-2 text-sm font-semibold transition',
              value === opt.id
                ? 'bg-[var(--color-forest)] text-white'
                : 'bg-white text-[var(--color-forest)] ring-1 ring-[var(--color-fog)] hover:bg-[var(--color-mist)]',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
