import clsx from 'clsx'
import type { RoutePreference } from '@/domain/types'
import { ORS_SUPPORTED_PREFERENCES } from '@/adapters/routing/OpenRouteServiceProvider'

const OPTIONS: Array<{ id: RoutePreference; label: string; supported: boolean }> = [
  { id: 'prefer_shorter', label: 'Menor distancia', supported: true },
  { id: 'prefer_faster', label: 'Más rápida', supported: true },
  { id: 'prefer_less_elevation', label: 'Menor desnivel', supported: true },
  { id: 'prefer_bike_lanes', label: 'Priorizar carril bici', supported: false },
  { id: 'prefer_secondary_roads', label: 'Carreteras secundarias', supported: false },
  { id: 'avoid_primary_roads', label: 'Evitar principales', supported: false },
  { id: 'avoid_traffic', label: 'Evitar tráfico', supported: false },
  { id: 'avoid_unpaved', label: 'Evitar sin asfaltar', supported: false },
  { id: 'prefer_unpaved', label: 'Priorizar caminos', supported: false },
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
      // shorter/faster are mutually exclusive at the provider level
      let next = [...value, id]
      if (id === 'prefer_shorter') next = next.filter((v) => v !== 'prefer_faster')
      if (id === 'prefer_faster') next = next.filter((v) => v !== 'prefer_shorter')
      onChange(next.filter((v) => ORS_SUPPORTED_PREFERENCES.includes(v) || v === id))
    }
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
                'flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm',
                opt.supported ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                checked && opt.supported ? 'bg-[var(--color-mist)]' : 'hover:bg-white/70',
              )}
              title={
                opt.supported
                  ? undefined
                  : 'OpenRouteService no aplica este filtro directamente. Preparado para fases futuras.'
              }
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-trail)]"
                checked={checked && opt.supported}
                disabled={!opt.supported}
                onChange={() => toggle(opt.id, opt.supported)}
              />
              <span>
                {opt.label}
                {!opt.supported && (
                  <span className="ml-1 text-[11px] text-[var(--color-stone)]">(próximamente)</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-stone)]">
        Solo se aplican filtros que OpenRouteService soporta de verdad. El resto queda documentado
        para GraphHopper/Valhalla o self-host.
      </p>
    </fieldset>
  )
}
