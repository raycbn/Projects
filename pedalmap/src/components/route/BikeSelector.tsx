import type { BikeType } from '@/domain/types'
import { getBikeModality, primaryOrsProfile } from '@/lib/bikeSurfaceProfile'
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
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        Tipo de bicicleta
      </legend>
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
                  ? 'bg-[var(--color-forest)] text-white'
                  : 'bg-white text-[var(--color-forest)] ring-1 ring-[var(--color-fog)] hover:bg-[var(--color-mist)]',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      <div className="mt-2 space-y-1 rounded-xl bg-white/70 px-3 py-2 text-[11px] text-[var(--color-stone)] ring-1 ring-[var(--color-fog)]">
        <p>
          <span className="font-semibold text-[var(--color-forest)]">Suelo ideal:</span>{' '}
          {modality.idealSurfaces.join(' · ')}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-forest)]">Evitar:</span>{' '}
          {modality.avoidSurfaces.join(' · ')}
        </p>
        <p>
          Perfil ORS: <code>{primaryOrsProfile(value)}</code> — {modality.blurb}
        </p>
      </div>
    </fieldset>
  )
}
