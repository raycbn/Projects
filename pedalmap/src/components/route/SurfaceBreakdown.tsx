import type { SurfaceStats } from '@/domain/types'
import { formatDistance } from '@/lib/stats'
import { getBikeModality, PROFILE_MIN_SCORE } from '@/lib/bikeSurfaceProfile'
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
  const bikeLabel = suitability ? getBikeModality(suitability.bikeType).label : null
  const topSurfaces = surfaces.slice(0, 3)
  const topWays = waytypes.slice(0, 3)

  return (
    <section aria-label="Superficie e idoneidad" className="space-y-3">
      {suitability && (
        <div
          className={clsx(
            'rounded-2xl px-4 py-3 ring-1',
            recommended
              ? 'bg-[color-mix(in_oklab,var(--color-signal)_22%,white)] ring-[color-mix(in_oklab,var(--color-trail)_35%,white)]'
              : 'bg-[#fff1f1] ring-[#f0c2c2]',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">{bikeLabel ?? 'Perfil'}</p>
              <p
                className={clsx(
                  'mt-1 font-display text-xl font-extrabold',
                  recommended ? 'text-[var(--color-forest)]' : 'text-[var(--color-danger)]',
                )}
              >
                {recommended ? 'Apta para tu bici' : 'No apta para tu bici'}
              </p>
              <p className="mt-1 text-xs text-[var(--color-stone)]">
                {recommended
                  ? `Idoneidad ${suitability.score}% · objetivo ≥${PROFILE_MIN_SCORE}%`
                  : `Idoneidad ${suitability.score}% (mínimo ${PROFILE_MIN_SCORE}%). Cambia bici o puntos.`}
              </p>
            </div>
            <p
              className={clsx(
                'font-display text-3xl font-extrabold leading-none',
                recommended ? 'text-[var(--color-forest)]' : 'text-[var(--color-danger)]',
              )}
              aria-label={`Idoneidad ${suitability.score} por ciento`}
            >
              {suitability.score}
              <span className="text-base font-semibold text-[var(--color-stone)]">%</span>
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-end justify-between gap-2">
          <h3 className="font-display text-base font-bold text-[var(--color-forest)]">Composición</h3>
          <p className="text-[10px] text-[var(--color-stone)]">OSM · ORS</p>
        </div>
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
          {unknown > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--color-fog)]" />
              Sin clasificar {Math.round(unknown)}%
            </li>
          )}
        </ul>
      </div>

      {(topSurfaces.length > 0 || topWays.length > 0) && (
        <details className="rounded-xl bg-[var(--color-mist)]/60 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-forest)]">
            Ver detalle de superficie y vías
          </summary>
          <div className="mt-3 space-y-3">
            {topSurfaces.length > 0 && (
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
                      <div className="h-1.5 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-[var(--color-trail)]"
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {topWays.length > 0 && (
              <ul className="space-y-1 border-t border-[var(--color-fog)] pt-2 text-xs text-[var(--color-stone)]">
                {topWays.map((row) => (
                  <li key={`${row.type}-${row.value ?? 'x'}`} className="flex justify-between gap-2">
                    <span>{row.type}</span>
                    <span>
                      {formatDistance(row.distanceMeters)} · {Math.round(row.percent)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {suitability?.notes?.length ? (
              <ul className="space-y-0.5 border-t border-[var(--color-fog)] pt-2 text-xs text-[var(--color-stone)]">
                {suitability.notes.slice(0, 3).map((note) => (
                  <li key={note}>· {note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>
      )}
    </section>
  )
}
