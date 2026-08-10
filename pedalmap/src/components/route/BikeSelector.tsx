import type { BikeType } from '@/domain/types'
import { getBikeModality } from '@/lib/bikeSurfaceProfile'
import clsx from 'clsx'

const OPTIONS: BikeType[] = ['road', 'mtb', 'gravel', 'urban', 'ebike']

interface BikeSelectorProps {
  value: BikeType
  onChange: (value: BikeType) => void
}

export function BikeSelector({ value, onChange }: BikeSelectorProps) {
  const modality = getBikeModality(value)

  return (
    <fieldset>
      <legend className="label-caps mb-2">Tipo de bicicleta</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de bicicleta">
        {OPTIONS.map((id) => {
          const opt = getBikeModality(id)
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={value === id}
              title={opt.blurb}
              onClick={() => onChange(id)}
              className={clsx(
                'rounded-xl px-3 py-2 text-sm font-semibold transition',
                value === id
                  ? 'bg-[var(--color-signal)] text-[var(--color-ink)]'
                  : 'bg-white text-[var(--color-forest)] ring-1 ring-[var(--color-fog)] hover:bg-[var(--color-mist)]',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--color-stone)]">
        <span className="font-semibold text-[var(--color-forest)]">Ideal:</span>{' '}
        {modality.idealSurfaces.slice(0, 3).join(' · ')}
        <span className="mx-1.5 text-[var(--color-fog)]">·</span>
        <span className="font-semibold text-[var(--color-forest)]">Evitar:</span>{' '}
        {modality.avoidSurfaces.slice(0, 3).join(' · ')}
      </p>
      <p className="mt-1 text-[11px] text-[var(--color-stone)]">
        Solo devolvemos rutas ≥{modality.acceptScore}% aptas para {modality.label}.
      </p>
    </fieldset>
  )
}
