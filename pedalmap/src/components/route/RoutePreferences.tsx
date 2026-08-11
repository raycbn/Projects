import clsx from 'clsx'
import type { RoutePreference, UserProfile } from '@/domain/types'
import { ORS_SUPPORTED_PREFERENCES } from '@/adapters/routing/OpenRouteServiceProvider'
import { applyPreferenceToggle, maxActivePreferences } from '@/services/EntitlementService'
import { FREE_LIMITS } from '@/domain/types'

const OPTIONS: Array<{ id: RoutePreference; label: string; hint?: string }> = [
  { id: 'prefer_shorter', label: 'Menor distancia', hint: 'Prioriza el camino más corto' },
  { id: 'prefer_faster', label: 'Más rápida', hint: 'Prioriza tiempo estimado' },
  { id: 'prefer_less_elevation', label: 'Menor desnivel', hint: 'Evita cuestas fuertes' },
  { id: 'avoid_unpaved', label: 'Evitar sin asfaltar', hint: 'Más asfalto / pavimento' },
  { id: 'prefer_unpaved', label: 'Priorizar caminos', hint: 'Más tierra, grava o pista' },
  { id: 'prefer_bike_lanes', label: 'Priorizar carril bici', hint: 'Prefiere vías ciclistas' },
  {
    id: 'prefer_secondary_roads',
    label: 'Carreteras secundarias',
    hint: 'Menos tráfico, vías calmadas',
  },
  {
    id: 'avoid_primary_roads',
    label: 'Evitar principales',
    hint: 'Huye de arterias rápidas',
  },
  { id: 'avoid_traffic', label: 'Evitar ferry/vado', hint: 'Menos ferry y tramos complicados' },
]

interface RoutePreferencesProps {
  value: RoutePreference[]
  onChange: (value: RoutePreference[]) => void
  profile?: UserProfile | null
  onLimitReached?: (reason: string) => void
}

export function RoutePreferencesPanel({
  value,
  onChange,
  profile = null,
  onLimitReached,
}: RoutePreferencesProps) {
  const limit = maxActivePreferences(profile)
  const unlimited = !Number.isFinite(limit)

  function toggle(id: RoutePreference) {
    if (!ORS_SUPPORTED_PREFERENCES.includes(id)) return
    const result = applyPreferenceToggle(value, id, profile)
    if (!result.ok) {
      onLimitReached?.(result.reason)
      return
    }
    onChange(result.next)
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        Preferencias avanzadas
      </legend>
      <p className="mb-2 text-[11px] text-[var(--color-stone)]">
        Puedes combinar varios filtros a la vez
        {unlimited
          ? ' (Premium: sin límite).'
          : ` (Free: hasta ${FREE_LIMITS.maxActivePreferences} · ${value.length}/${limit}).`}
      </p>
      <div className="flex flex-col gap-1.5">
        {OPTIONS.map((opt) => {
          const checked = value.includes(opt.id)
          const atLimit = !checked && !unlimited && value.length >= limit
          return (
            <label
              key={opt.id}
              className={clsx(
                'flex items-start gap-2 rounded-xl px-2 py-1.5 text-sm',
                atLimit ? 'cursor-pointer opacity-70' : 'cursor-pointer',
                checked ? 'bg-[var(--color-mist)]' : 'hover:bg-white/70',
              )}
              title={
                atLimit
                  ? 'Límite Free alcanzado — desactiva otro filtro o mejora el plan'
                  : opt.hint
              }
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--color-trail)]"
                checked={checked}
                onChange={() => toggle(opt.id)}
              />
              <span>
                {opt.label}
                {opt.hint && (
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
