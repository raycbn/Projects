import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics'
import { ANNUAL_TRIAL_DAYS, FREE_TRIALS } from '@/domain/types'

interface PremiumCardProps {
  reason?: string | null
  onClose?: () => void
}

const COPY: Record<string, { title: string; body: string }> = {
  guest_limit: {
    title: 'Cupo de invitado agotado en este dispositivo',
    body: 'Entra o crea cuenta para seguir creando rutas Free este mes.',
  },
  circular_premium: {
    title: 'Tu Objetivo gratis de este mes ya está usado',
    body: `Free incluye ${FREE_TRIALS.circularPerMonth} Objetivo al mes. Premium deja Objetivo ilimitado, GPX y guardados sin techo.`,
  },
  gpx_export: {
    title: 'Tu GPX gratis de esta semana ya está usado',
    body: `Free incluye ${FREE_TRIALS.gpxPerWeek} GPX a la semana. Premium exporta sin límite a Garmin, Wahoo y apps.`,
  },
  filter_limit: {
    title: 'Free permite hasta 2 filtros a la vez',
    body: 'Desactiva un filtro o pasa a Premium para combinar más de 2.',
  },
  save_limit: {
    title: 'Has llegado al límite de rutas guardadas',
    body: 'Free guarda hasta 5 rutas. Premium las guarda todas y desbloquea GPX/Objetivo.',
  },
  create_limit: {
    title: 'Has llegado al límite de creaciones del mes',
    body: 'Free crea hasta 15 rutas al mes. Premium no tiene techo de creación.',
  },
  wind_alert_limit: {
    title: 'Free avisa en 1 ruta guardada',
    body: 'Quita el aviso de otra ruta o pasa a Premium para vigilar todas.',
  },
}

export function PremiumCard({ reason, onClose }: PremiumCardProps) {
  const key = reason || 'default'
  const copy = COPY[key] || {
    title: 'Has llegado a un límite Free',
    body: 'Desbloquea PedalMap Premium cuando quieras planificar sin fricciones.',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_oklab,black_28%,transparent)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-title"
    >
      <div className="w-full max-w-md animate-rise rounded-t-[1.75rem] bg-[var(--color-panel)] p-6 text-white shadow-xl safe-pb sm:rounded-[1.75rem]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-signal)]/90">
          PedalMap Premium
        </p>
        <h2 id="premium-title" className="mt-2 font-display text-2xl font-extrabold leading-tight">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{copy.body}</p>
        <ul className="mt-5 space-y-2 text-sm text-white/80">
          {[
            'Rutas y guardados ilimitados',
            'GPX ilimitado a tu GPS',
            'Objetivo ilimitado',
            'Más de 2 filtros a la vez',
            'Avisos de viento en todas tus rutas',
            'Pack Grupeta: 4 Premium (14,99 €/mes · 119,99 €/año)',
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
          Anual: {ANNUAL_TRIAL_DAYS} días de prueba antes de cobrar. Hecho en España.
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
              Seguir Free
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
