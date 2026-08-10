import type { SurfaceStats } from '@/domain/types'
import { formatDistance } from '@/lib/stats'
import { PROFILE_MIN_SCORE } from '@/lib/bikeSurfaceProfile'
import clsx from 'clsx'

interface SurfaceBreakdownProps {
  surfaceStats: SurfaceStats
}

function Bar({
  percent,
  tone,
}: {
  percent: number
  tone: 'paved' | 'unpaved' | 'unknown' | 'neutral' | 'warn'
}) {
  const colors = {
    paved: 'bg-[var(--color-forest)]',
    unpaved: 'bg-[#8b5a2b]',
    unknown: 'bg-[var(--color-fog)]',
    neutral: 'bg-[var(--color-trail)]',
    warn: 'bg-[var(--color-danger)]',
  }
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-mist)]">
      <div
        className={`h-full rounded-full ${colors[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  )
}

export function SurfaceBreakdown({ surfaceStats }: SurfaceBreakdownProps) {
  const surfaces = surfaceStats.surfaces ?? []
  const waytypes = surfaceStats.waytypes ?? []
  const suitability = surfaceStats.suitability
  const total =
    surfaces.reduce((sum, s) => sum + s.distanceMeters, 0) ||
    waytypes.reduce((sum, s) => sum + s.distanceMeters, 0)
  const recommended = (suitability?.score ?? 0) >= PROFILE_MIN_SCORE
  const suitTone = recommended ? 'paved' : suitability && suitability.score >= 75 ? 'neutral' : 'warn'

  return (
    <section aria-label="Composición de la ruta" className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-[var(--color-forest)]">Superficie</h3>
        <p className="text-xs text-[var(--color-stone)]">
          Datos reales de OpenRouteService / OSM · objetivo ≥{PROFILE_MIN_SCORE}% para el perfil
        </p>
      </div>

      {suitability && (
        <div
          className={clsx(
            'rounded-2xl px-3 py-3 ring-1',
            recommended
              ? 'bg-white/85 ring-[var(--color-fog)]'
              : 'bg-[#fff4f4] ring-[color-mix(in_oklab,var(--color-danger)_35%,white)]',
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
              Idoneidad {suitability.bikeType}
            </p>
            <p
              className={clsx(
                'font-display text-xl font-bold',
                recommended ? 'text-[var(--color-forest)]' : 'text-[var(--color-danger)]',
              )}
            >
              {suitability.score}/100 ·{' '}
              {recommended ? 'recomendada' : suitability.label.replaceAll('_', ' ')}
            </p>
          </div>
          <Bar percent={suitability.score} tone={suitTone} />
          {!recommended && (
            <p className="mt-2 text-xs font-semibold text-[var(--color-danger)]">
              Por debajo del {PROFILE_MIN_SCORE}%: no encaja bien con este perfil. Cambia el tipo de
              bici o los puntos.
            </p>
          )}
          <ul className="mt-2 space-y-1 text-[11px] text-[var(--color-stone)]">
            {suitability.notes.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-[var(--color-fog)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
            Asfalto / pavimento
          </p>
          <p className="font-display text-xl font-bold text-[var(--color-forest)]">
            {Math.round(surfaceStats.pavedPercent ?? 0)}%
          </p>
          <Bar percent={surfaceStats.pavedPercent ?? 0} tone="paved" />
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-[var(--color-fog)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
            Tierra / grava
          </p>
          <p className="font-display text-xl font-bold text-[var(--color-forest)]">
            {Math.round(surfaceStats.unpavedPercent ?? 0)}%
          </p>
          <Bar percent={surfaceStats.unpavedPercent ?? 0} tone="unpaved" />
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-[var(--color-fog)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
            Sin clasificar
          </p>
          <p className="font-display text-xl font-bold text-[var(--color-forest)]">
            {Math.round(surfaceStats.unknownPercent ?? 0)}%
          </p>
          <Bar percent={surfaceStats.unknownPercent ?? 0} tone="unknown" />
        </div>
      </div>

      {surfaces.length > 0 && (
        <ul className="space-y-2" aria-label="Detalle de superficies">
          {surfaces.map((row) => {
            const percent = total > 0 ? (row.distanceMeters / total) * 100 : 0
            return (
              <li key={`${row.type}-${row.value ?? 'x'}`}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-[var(--color-ink)]">{row.type}</span>
                  <span className="text-[var(--color-stone)]">
                    {formatDistance(row.distanceMeters)} · {Math.round(percent)}%
                  </span>
                </div>
                <Bar percent={percent} tone="neutral" />
              </li>
            )
          })}
        </ul>
      )}

      {waytypes.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
            Tipo de vía
          </h4>
          <ul className="space-y-2" aria-label="Detalle de tipos de vía">
            {waytypes.map((row) => (
              <li key={`${row.type}-${row.value ?? 'x'}`}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-[var(--color-ink)]">{row.type}</span>
                  <span className="text-[var(--color-stone)]">
                    {formatDistance(row.distanceMeters)} · {Math.round(row.percent)}%
                  </span>
                </div>
                <Bar percent={row.percent} tone="neutral" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
