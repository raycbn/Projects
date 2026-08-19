import { useState } from 'react'
import type { SurfaceStats } from '@/domain/types'
import { formatDistance } from '@/lib/stats'
import { getBikeModality, PROFILE_MIN_SCORE } from '@/lib/bikeSurfaceProfile'
import clsx from 'clsx'

interface SurfaceBreakdownProps {
  surfaceStats: SurfaceStats
}

type Tone = 'good' | 'ok' | 'warn'

function fitCopy(score: number, bikeLabel: string): { title: string; hint: string; tone: Tone } {
  if (score >= PROFILE_MIN_SCORE) {
    return {
      title: `Óptima para ${bikeLabel}`,
      hint: `Encaja muy bien con este perfil`,
      tone: 'good',
    }
  }
  if (score >= 75) {
    return {
      title: `Buena para ${bikeLabel}`,
      hint: `Mejor opción encontrada cerca de tus puntos`,
      tone: 'ok',
    }
  }
  if (score >= 55) {
    return {
      title: `Pasable para ${bikeLabel}`,
      hint: `Hay tramos menos ideales; prueba otra bici o puntos si quieres más ajuste`,
      tone: 'warn',
    }
  }
  return {
    title: `Poco ideal para ${bikeLabel}`,
    hint: `Es la mejor candidata entre alternativas; cambia de perfil si el suelo no te encaja`,
    tone: 'warn',
  }
}

const TONE_STYLES: Record<Tone, { card: string; score: string; title: string; icon: string }> = {
  good: {
    card: 'bg-[color-mix(in_oklab,var(--color-signal)_24%,white)] ring-[color-mix(in_oklab,var(--color-trail)_35%,white)]',
    score: 'text-[var(--color-forest)]',
    title: 'text-[var(--color-forest)]',
    icon: 'bg-[var(--color-trail)] text-white',
  },
  ok: {
    card: 'bg-[color-mix(in_oklab,var(--color-trail)_12%,white)] ring-[var(--color-fog)]',
    score: 'text-[var(--color-forest)]',
    title: 'text-[var(--color-forest)]',
    icon: 'bg-[var(--color-forest)] text-white',
  },
  warn: {
    card: 'bg-[#fff8f0] ring-[#efd2b0]',
    score: 'text-[#9a4b00]',
    title: 'text-[#9a4b00]',
    icon: 'bg-[#9a4b00] text-white',
  },
}

function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  if (tone === 'good') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (tone === 'ok') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="0.6" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 4.5 21 19H3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 10.5v3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="0.7" fill="currentColor" />
    </svg>
  )
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={clsx(className, 'transition-transform duration-200', open && 'rotate-180')}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SurfaceBreakdown({ surfaceStats }: SurfaceBreakdownProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const surfaces = surfaceStats.surfaces ?? []
  const waytypes = surfaceStats.waytypes ?? []
  const suitability = surfaceStats.suitability
  const paved = Math.max(0, Math.min(100, surfaceStats.pavedPercent ?? 0))
  const unpaved = Math.max(0, Math.min(100, surfaceStats.unpavedPercent ?? 0))
  const unknown = Math.max(0, Math.min(100, surfaceStats.unknownPercent ?? 0))
  const bikeLabel = suitability ? getBikeModality(suitability.bikeType).label : 'tu bici'
  const fit = suitability ? fitCopy(suitability.score, bikeLabel) : null
  const toneStyle = fit ? TONE_STYLES[fit.tone] : null
  const topSurfaces = surfaces.slice(0, 3)
  const topWays = waytypes.slice(0, 3)
  const hasDetail = topSurfaces.length > 0 || topWays.length > 0

  return (
    <section aria-label="Superficie e idoneidad" className="space-y-3">
      {suitability && fit && toneStyle && (
        <div className={clsx('rounded-2xl px-4 py-3.5 ring-1', toneStyle.card)}>
          <div className="flex items-start gap-3">
            <span
              className={clsx(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                toneStyle.icon,
              )}
            >
              <ToneIcon tone={fit.tone} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className={clsx('font-display text-lg font-extrabold leading-tight', toneStyle.title)}>
                  {fit.title}
                </p>
                <p
                  className={clsx('shrink-0 font-display text-2xl font-extrabold leading-none', toneStyle.score)}
                  aria-label={`Idoneidad ${suitability.score} por ciento`}
                >
                  {suitability.score}
                  <span className="text-sm font-semibold text-[var(--color-stone)]">%</span>
                </p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-stone)]">{fit.hint}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-end justify-between gap-2">
          <h3 className="font-display text-base font-bold text-[var(--color-forest)]">Composición</h3>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-stone)]">OSM · Valhalla</p>
        </div>
        <div
          className="flex h-3.5 overflow-hidden rounded-full bg-[var(--color-mist)] ring-1 ring-[var(--color-fog)]"
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
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--color-stone)]">
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[var(--color-forest)]" />
            <span className="font-medium text-[var(--color-ink)]">{Math.round(paved)}%</span> pavimento
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#8b5a2b]" />
            <span className="font-medium text-[var(--color-ink)]">{Math.round(unpaved)}%</span> tierra/grava
          </li>
          {unknown > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--color-fog)]" />
              <span className="font-medium text-[var(--color-ink)]">{Math.round(unknown)}%</span> sin clasificar
            </li>
          )}
        </ul>
      </div>

      {hasDetail && (
        <div className="rounded-xl bg-[var(--color-mist)]/60">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[var(--color-forest)]"
            aria-expanded={detailOpen}
            onClick={() => setDetailOpen((v) => !v)}
          >
            Ver detalle de superficie y vías
            <ChevronIcon open={detailOpen} className="size-4 shrink-0 text-[var(--color-stone)]" />
          </button>
          <div
            className={clsx(
              'grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out',
              detailOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="min-h-0 space-y-3 px-3 pb-3">
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
              {(surfaceStats.cycleNetworkPercent ?? 0) > 0 && (
                <p className="border-t border-[var(--color-fog)] pt-2 text-xs text-[var(--color-stone)]">
                  {Math.round(surfaceStats.cycleNetworkPercent ?? 0)}% discurre por red ciclista
                  señalizada (EuroVelo, Vías Verdes, redes locales)
                </p>
              )}
              {suitability?.notes?.length ? (
                <ul className="space-y-0.5 border-t border-[var(--color-fog)] pt-2 text-xs text-[var(--color-stone)]">
                  {suitability.notes.slice(0, 3).map((note) => (
                    <li key={note}>· {note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
