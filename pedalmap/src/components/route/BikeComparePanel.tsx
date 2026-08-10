import clsx from 'clsx'
import type { BikeCompareRow } from '@/lib/bikeCompare'
import { formatDistance, formatElevation } from '@/lib/stats'
import { Button } from '@/components/ui/Button'

interface BikeComparePanelProps {
  rows: BikeCompareRow[]
  busy: boolean
  onPick: (row: BikeCompareRow) => void
  onClose: () => void
}

export function BikeComparePanel({ rows, busy, onPick, onClose }: BikeComparePanelProps) {
  if (busy) {
    return (
      <div className="rounded-2xl bg-[var(--color-mist)]/70 px-4 py-4 text-sm text-[var(--color-forest)] animate-pulse-soft">
        Comparando Carretera · Gravel · MTB con los mismos puntos…
      </div>
    )
  }

  if (!rows.length) return null

  return (
    <section className="space-y-3 rounded-2xl bg-[var(--color-mist)]/60 px-3 py-3 ring-1 ring-[var(--color-fog)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
          Comparador de bici
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <p className="text-xs text-[var(--color-stone)]">
        Misma ruta recalculada con tres perfiles. Elige la que mejor encaje.
      </p>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li
            key={row.bikeType}
            className={clsx(
              'rounded-xl bg-white px-3 py-3 ring-1',
              index === 0 ? 'ring-[var(--color-trail)]' : 'ring-[var(--color-fog)]',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--color-forest)]">
                  {row.label}
                  {index === 0 ? ' · mejor fit' : ''}
                </p>
                <p className="mt-1 text-xs text-[var(--color-stone)]">
                  {formatDistance(row.distanceMeters)} · {formatElevation(row.elevationGainMeters)} ·
                  pavimento {Math.round(row.pavedPercent)}% · tierra {Math.round(row.unpavedPercent)}%
                </p>
              </div>
              <p className="font-display text-2xl font-extrabold text-[var(--color-forest)]">
                {row.score}
                <span className="text-sm font-semibold text-[var(--color-stone)]">%</span>
              </p>
            </div>
            <Button className="mt-2 w-full" size="sm" onClick={() => onPick(row)}>
              Usar {row.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
