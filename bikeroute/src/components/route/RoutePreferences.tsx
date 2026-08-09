import clsx from 'clsx'
import type { RoutePreference } from '@/domain/types'

const OPTIONS: Array<{ id: RoutePreference; label: string }> = [
  { id: 'prefer_bike_lanes', label: 'Priorizar carril bici' },
  { id: 'prefer_secondary_roads', label: 'Carreteras secundarias' },
  { id: 'avoid_primary_roads', label: 'Evitar principales' },
  { id: 'avoid_traffic', label: 'Evitar tráfico' },
  { id: 'avoid_unpaved', label: 'Evitar sin asfaltar' },
  { id: 'prefer_unpaved', label: 'Priorizar sin asfaltar' },
  { id: 'prefer_less_elevation', label: 'Menor desnivel' },
  { id: 'prefer_shorter', label: 'Menor distancia' },
  { id: 'prefer_faster', label: 'Más rápida' },
]

interface RoutePreferencesProps {
  value: RoutePreference[]
  onChange: (value: RoutePreference[]) => void
}

export function RoutePreferencesPanel({ value, onChange }: RoutePreferencesProps) {
  function toggle(id: RoutePreference) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        Preferencias
      </legend>
      <div className="flex flex-col gap-1.5">
        {OPTIONS.map((opt) => {
          const checked = value.includes(opt.id)
          return (
            <label
              key={opt.id}
              className={clsx(
                'flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm',
                checked ? 'bg-[var(--color-mist)]' : 'hover:bg-white/70',
              )}
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-trail)]"
                checked={checked}
                onChange={() => toggle(opt.id)}
              />
              <span>{opt.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
