import clsx from 'clsx'
import type { RoutePreference } from '@/domain/types'
import { ORS_SUPPORTED_PREFERENCES } from '@/adapters/routing/OpenRouteServiceProvider'

const OPTIONS: Array<{ id: RoutePreference; label: string; supported: boolean; hint?: string }> = [
  { id: 'prefer_shorter', label: 'Menor distancia', supported: true },
  { id: 'prefer_faster', label: 'Más rápida', supported: true },
  {
    id: 'prefer_less_elevation',
    label: 'Menor desnivel',
    supported: true,
    hint: 'ORS steepness_difficulty = 0',
  },
  {
    id: 'avoid_unpaved',
    label: 'Evitar sin asfaltar',
    supported: true,
    hint: 'Perfil más carretera/regular',
  },
  {
    id: 'prefer_unpaved',
    label: 'Priorizar caminos',
    supported: true,
    hint: 'Perfil mountain + steepness MTB',
  },
  {
    id: 'prefer_bike_lanes',
    label: 'Priorizar carril bici',
    supported: true,
    hint: 'Perfil regular + ponderación green',
  },
  {
    id: 'prefer_secondary_roads',
    label: 'Carreteras secundarias',
    supported: true,
    hint: 'Sesgo ORS green (vías más tranquilas / verdes)',
  },
  {
    id: 'avoid_primary_roads',
    label: 'Evitar principales',
    supported: true,
    hint: 'Sesgo green máximo (ORS no permite avoid highways en cycling)',
  },
  {
    id: 'avoid_traffic',
    label: 'Evitar ferry/vado',
    supported: true,
    hint: 'ORS cycling: avoid ferries + fords',
  },
]

interface RoutePreferencesProps {
  value: RoutePreference[]
  onChange: (value: RoutePreference[]) => void
}

export function RoutePreferencesPanel({ value, onChange }: RoutePreferencesProps) {
  function toggle(id: RoutePreference, supported: boolean) {
    if (!supported) return
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else {
      let next = [...value, id]
      if (id === 'prefer_shorter') next = next.filter((v) => v !== 'prefer_faster')
      if (id === 'prefer_faster') next = next.filter((v) => v !== 'prefer_shorter')
      if (id === 'avoid_unpaved') next = next.filter((v) => v !== 'prefer_unpaved')
      if (id === 'prefer_unpaved') next = next.filter((v) => v !== 'avoid_unpaved')
      onChange(next.filter((v) => ORS_SUPPORTED_PREFERENCES.includes(v) || v === id))
    }
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        Preferencias avanzadas
      </legend>
      <div className="flex flex-col gap-1.5">
        {OPTIONS.map((opt) => {
          const checked = value.includes(opt.id)
          return (
            <label
              key={opt.id}
              className={clsx(
                'flex items-start gap-2 rounded-xl px-2 py-1.5 text-sm',
                opt.supported ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                checked && opt.supported ? 'bg-[var(--color-mist)]' : 'hover:bg-white/70',
              )}
              title={opt.hint}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--color-trail)]"
                checked={checked && opt.supported}
                disabled={!opt.supported}
                onChange={() => toggle(opt.id, opt.supported)}
              />
              <span>
                {opt.label}
                {opt.supported && opt.hint && (
                  <span className="mt-0.5 block text-[11px] text-[var(--color-stone)]">{opt.hint}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
