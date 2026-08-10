import type { SurfaceStats } from '@/domain/types'
import { formatDistance } from '@/lib/stats'
import { PROFILE_MIN_SCORE } from '@/lib/bikeSurfaceProfile'
import clsx from 'clsx'

interface SurfaceBreakdownProps {
  surfaceStats: SurfaceStats
}

export function SurfaceBreakdown({ surfaceStats }: SurfaceBreakdownProps) {
  const surfaces = surfaceStats.surfaces ?? []
  const waytypes = surfaceStats.waytypes ?? []
  const suitability = surfaceStats.suitability
  const paved = Math.max(0, Math.min(100, surfaceStats.pavedPercent ?? 0))
  const unpaved = Math.max(0, Math.min(100, surfaceStats.unpavedPercent ?? 0))
  const unknown = Math.max(0, Math.min(100, surfaceStats.unknownPercent ?? 0))
  const recommended = (suitability?.score ?? 0) >= PROFILE_MIN_SCORE
  const topSurfaces = surfaces.slice(0, 4)
  const restSurfaces = surfaces.slice(4)
  const topWays = waytypes.slice(0, 4)
  const restWays = waytypes.slice(4)

  return (
    <section aria-label="Composición de la ruta" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[var(--color-forest)]">Superficie</h3>
          <p className="text-xs text-[var(--color-stone)]">
            OpenStreetMap via ORS · recomendada ≥{PROFILE_MIN_SCORE}%
          </p>
        </div>
        {suitability && (
          <div className="text-right">
            <p
              className={clsx(
                'font-display text-3xl font-extrabold leading-none',
                recommended ? 'text-[var(--color-forest)]' : 'text-[var(--color-danger)]',
              )}
            >
              {suitability.score}
              <span className="text-base font-semibold text-[var(--color-stone)]">%</span>
            </p>
            <p
              className={clsx(
                'mt-0.5 text-xs font-semibold',
                recommended ? 'text-[var(--color-trail)]' : 'text-[var(--color-danger)]',
              )}
            >
              {recommended ? 'Recomendada' : 'No recomendada'}
            </p>
          </div>
        )}
      </div>

      {/* Strava-like stacked composition bar */}
      <div>
        <div
          className="flex h-3 overflow-hidden rounded-full bg-[var(--color-mist)] ring-1 ring-[var(--color-fog)]"
          role="img"
          aria-label={`Pavimentado ${Math.round(paved)}%, sin pavimentar ${Math.round(unpaved)}%, sin clasificar ${Math.round(unknown)}%`}
        >
          {paved > 0 && (
            <span className="bg-[var(--color-forest)]" style={{ width: `${paved}%` }} />
          )}
          {unpaved > 0 && <span className="bg-[#8b5a2b]" style={{ width: `${unpaved}%` }} />}
          {unknown > 0 && (
            <span className="bg-[var(--color-fog)]" style={{ width: `${unknown}%` }} />
          )}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-stone)]">
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--color-forest)]" />
            Pavimento {Math.round(paved)}%
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#8b5a2b]" />
            Tierra/grava {Math.round(unpaved)}%
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--color-fog)]" />
            Sin clasificar {Math.round(unknown)}%
          </li>
        </ul>
      </div>

      {suitability && (
        <div
          className={clsx(
            'rounded-xl px-3 py-2 text-xs',
            recommended
              ? 'bg-[color-mix(in_oklab,var(--color-signal)_18%,white)] text-[var(--color-forest)]'
              : 'bg-[#fff4f4] text-[var(--color-danger)]',
          )}
        >
          {!recommended && (
            <p className="font-semibold">
              Por debajo del {PROFILE_MIN_SCORE}% para {suitability.bikeType}. Cambia el tipo de bici
              o los puntos.
            </p>
          )}
          <details className={clsx(!recommended && 'mt-1')}>
            <summary className="cursor-pointer font-semibold text-[var(--color-forest)]">
              Detalle de idoneidad
            </summary>
            <ul className="mt-1 space-y-0.5 text-[var(--color-stone)]">
              {suitability.notes.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {topSurfaces.length > 0 && (
        <div>
          <p className="label-caps mb-2">Detalle</p>
          <ul className="space-y-2">
            {topSurfaces.map((row) => {
              const total = surfaces.reduce((s, x) => s + x.distanceMeters, 0) || 1
              const percent = (row.distanceMeters / total) * 100
              return (
                <li key={`${row.type}-${row.value ?? 'x'}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-[var(--color-ink)]">{row.type}</span>
                    <span className="text-[var(--color-stone)]">
                      {formatDistance(row.distanceMeters)} · {Math.round(percent)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-mist)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-trail)]"
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          {restSurfaces.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-[var(--color-trail)]">
                Ver {restSurfaces.length} más
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-[var(--color-stone)]">
                {restSurfaces.map((row) => (
                  <li key={`${row.type}-${row.value ?? 'x'}`}>
                    {row.type} · {formatDistance(row.distanceMeters)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {topWays.length > 0 && (
        <div>
          <p className="label-caps mb-2">Tipo de vía</p>
          <ul className="space-y-2">
            {topWays.map((row) => (
              <li key={`${row.type}-${row.value ?? 'x'}`}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-[var(--color-ink)]">{row.type}</span>
                  <span className="text-[var(--color-stone)]">
                    {formatDistance(row.distanceMeters)} · {Math.round(row.percent)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-mist)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-moss)]"
                    style={{ width: `${Math.min(100, row.percent)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {restWays.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-[var(--color-trail)]">
                Ver {restWays.length} más
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-[var(--color-stone)]">
                {restWays.map((row) => (
                  <li key={`${row.type}-${row.value ?? 'x'}`}>
                    {row.type} · {Math.round(row.percent)}%
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
