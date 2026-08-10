import clsx from 'clsx'
import type { BikeType } from '@/domain/types'
import { mapBikeProfile } from '@/adapters/routing/OpenRouteServiceProvider'

const OPTIONS: Array<{ id: BikeType; label: string; note?: string }> = [
  {
    id: 'road',
    label: 'Carretera',
    note: 'Perfil cycling-road; si ORS lo tiene caído, se usa cycling-regular',
  },
  { id: 'mtb', label: 'MTB' },
  { id: 'gravel', label: 'Gravel', note: 'Usa perfil cycling-regular (ORS no tiene gravel dedicado)' },
  { id: 'urban', label: 'Urbana', note: 'Usa perfil cycling-regular' },
  {
    id: 'ebike',
    label: 'E-bike',
    note: 'Perfil cycling-electric; si ORS lo tiene caído, se usa cycling-regular',
  },
]

interface BikeSelectorProps {
  value: BikeType
  onChange: (value: BikeType) => void
}

export function BikeSelector({ value, onChange }: BikeSelectorProps) {
  const selected = OPTIONS.find((o) => o.id === value)

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
            title={opt.note}
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
      <p className="mt-1.5 text-[11px] text-[var(--color-stone)]">
        Perfil ORS: <code>{mapBikeProfile(value)}</code>
        {selected?.note ? ` — ${selected.note}` : ''}
      </p>
    </fieldset>
  )
}
