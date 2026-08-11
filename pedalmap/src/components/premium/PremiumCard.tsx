import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics'
import { ANNUAL_TRIAL_DAYS, FREE_TRIALS } from '@/domain/types'

interface PremiumCardProps {
  reason?: string | null
  onClose?: () => void
}

export function PremiumCard({ reason, onClose }: PremiumCardProps) {
  const title =
    reason === 'guest_limit'
      ? 'Cupo de invitado agotado en este dispositivo'
      : reason === 'circular_premium'
        ? 'Tu Objetivo gratis de este mes ya está usado'
        : reason === 'gpx_export'
          ? 'Tu GPX gratis de esta semana ya está usado'
          : reason === 'filter_limit'
            ? 'Free permite hasta 2 filtros a la vez'
            : reason === 'save_limit'
              ? 'Has llegado al límite de rutas guardadas'
              : 'Has llegado a un límite Free'

  const body =
    reason === 'circular_premium'
      ? `Free incluye ${FREE_TRIALS.circularPerMonth} Objetivo al mes para probar. Premium deja Objetivo ilimitado, además de GPX y guardados sin techo.`
      : reason === 'gpx_export'
        ? `Free incluye ${FREE_TRIALS.gpxPerWeek} GPX a la semana. Premium exporta sin límite a Garmin, Wahoo y apps.`
        : reason === 'filter_limit'
          ? 'Desactiva un filtro o pasa a Premium para combinar más de 2.'
          : reason === 'guest_limit'
            ? 'Entra o crea cuenta para seguir creando rutas Free este mes.'
            : reason === 'save_limit'
              ? 'Free guarda hasta 5 rutas. Premium las guarda todas.'
              : 'Desbloquea PedalMap Premium cuando quieras planificar sin fricciones.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_oklab,black_28%,transparent)] p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-title"
    >
      <div className="w-full max-w-md animate-rise rounded-[1.75rem] bg-[var(--color-panel)] p-6 text-white shadow-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-signal)]/90">
          PedalMap Premium
        </p>
        <h2 id="premium-title" className="mt-2 font-display text-2xl font-extrabold leading-tight">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{body}</p>
        <ul className="mt-5 space-y-2 text-sm text-white/80">
          {[
            'Rutas y guardados ilimitados',
            'GPX ilimitado a tu GPS',
            'Objetivo ilimitado',
            'Más de 2 filtros a la vez',
            'Avisos de viento en todas tus rutas',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-[var(--color-signal)]" aria-hidden>
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-white/55">
          Anual: {ANNUAL_TRIAL_DAYS} días de prueba antes de cobrar.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/premium"
            onClick={() => track('premium_clicked', { reason: reason ?? 'unknown' })}
          >
            <Button>Ver Premium</Button>
          </Link>
          {onClose && (
            <Button variant="ghost" className="!text-white/90 !border-white/15" onClick={onClose}>
              Seguir
            </Button>
          )}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-white/45">
          Free ya incluye 1 GPX/semana y 1 Objetivo/mes. Premium quita los topes.
        </p>
      </div>
    </div>
  )
}
