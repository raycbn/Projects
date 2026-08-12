import type { HeatDay } from '@/lib/athleteStats'

type Props = {
  days: HeatDay[]
  className?: string
}

function level(meters: number): number {
  if (meters <= 0) return 0
  if (meters < 15000) return 1
  if (meters < 40000) return 2
  if (meters < 80000) return 3
  return 4
}

const FILLS = [
  'var(--color-fog)',
  'color-mix(in srgb, var(--color-trail) 35%, white)',
  'color-mix(in srgb, var(--color-trail) 55%, white)',
  'color-mix(in srgb, var(--color-trail) 75%, var(--color-forest))',
  'var(--color-forest)',
]

/** Compact year heatmap — low visual volume, one row of weeks. */
export function ActivityHeatmap({ days, className = '' }: Props) {
  if (!days.length) return null
  // Pad to start on Monday for a tidy grid
  const first = new Date(`${days[0]!.date}T12:00:00`)
  const pad = (first.getDay() + 6) % 7
  const cells: Array<HeatDay | null> = [...Array.from({ length: pad }, () => null), ...days]

  return (
    <div className={className}>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${Math.ceil(cells.length / 7)}, minmax(0, 1fr))` }}
        title="Kilómetros por día"
      >
        {cells.map((day, i) => {
          const lv = day ? level(day.distanceMeters) : 0
          return (
            <span
              key={day?.date ?? `pad-${i}`}
              className="aspect-square rounded-[2px]"
              style={{ background: day ? FILLS[lv] : 'transparent' }}
              title={
                day
                  ? `${day.date}: ${(day.distanceMeters / 1000).toFixed(1)} km · ${day.rides} salidas`
                  : undefined
              }
            />
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-stone)]">Año en curso · color = km/día</p>
    </div>
  )
}
