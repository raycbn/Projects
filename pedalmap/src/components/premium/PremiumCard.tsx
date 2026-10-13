import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics'
import { FREE_TRIALS } from '@/domain/types'
import { useAuth } from '@/app/AuthContext'

interface PremiumCardProps {
  reason?: string | null
  onClose?: () => void
}

const COPY: Record<string, { title: string; body: string }> = {
  free_circular_limit: {
    title: 'Tu Objetivo gratis de este mes ya está usado',
    body: 'Free incluye un Objetivo al mes. Premium desbloquea Objetivo circular ilimitado.',
  },
  filter_limit: {
    title: 'Free permite hasta 2 filtros a la vez',
    body: 'Desactiva un filtro o pasa a Premium para combinar más de 2.',
  },
  anonymous_limit_reached: {
    title: 'Has usado tus 3 rutas de prueba',
    body: 'Crea tu cuenta gratis para seguir usando PedalMap.',
  },
  guest_identity_limit_reached: {
    title: 'La prueba de invitado ya se ha usado en esta red este mes',
    body: 'Crea una cuenta gratis para seguir usando PedalMap, conservar tus rutas y disponer del límite Free de 15 rutas al mes.',
  },
  guest_limit: {
    title: 'Cupo de invitado agotado en este dispositivo',
    body: 'Entra o crea cuenta para seguir creando rutas Free este mes.',
  },
  circular_premium: {
    title: 'Tu Objetivo gratis de este mes ya está usado',
    body: `Free incluye ${FREE_TRIALS.circularPerMonth} Objetivo al mes. Premium deja Objetivo ilimitado, GPX y guardados sin techo.`,
  },
  free_circular_guest_limit: {
    title: 'Conserva tu progreso y crea una cuenta gratis',
    body: 'Ya has usado el Objetivo gratuito de este mes. Tu cuenta Free te dará 15 creaciones al mes, 5 rutas guardadas y 1 GPX semanal; el Objetivo se renueva el próximo mes.',
  },
  route_option_premium: {
    title: 'La 3.ª opción de ruta es Premium',
    body: 'Free compara las 2 mejores variantes. Premium desbloquea la 3.ª opción completa (más superficie / menos desnivel).',
  },
  gpx_export: {
    title: 'Tu GPX gratis de esta semana ya está usado',
    body: `Free incluye ${FREE_TRIALS.gpxPerWeek} GPX a la semana. Premium exporta sin límite a Garmin, Wahoo y apps.`,
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

interface PremiumCardProps {
  reason?: string | null
  onClose?: () => void
}

export function PremiumCard({ reason, onClose }: PremiumCardProps) {
  const key = reason || 'default'
  const copy = COPY[key] || {
    title: 'Has llegado a un límite Free',
    body: 'Desbloquea PedalMap Premium cuando quieras planificar sin fricciones.',
  }
  const auth = useAuth()
  const { signInGoogle } = auth
  const isCircularGuestWall = reason === 'free_circular_guest_limit'
  const isAnonymousWall =
    reason === 'anonymous_limit_reached' ||
    reason === 'guest_identity_limit_reached' ||
    reason === 'guest_limit' ||
    isCircularGuestWall

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_oklab,black_28%,transparent)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-title"
    >
      <div className="w-full max-w-md animate-rise rounded-t-[1.75rem] bg-[var(--color-panel)] p-6 text-white shadow-xl safe-pb sm:rounded-[1.75rem]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-signal)]/90">
          {isAnonymousWall ? 'Crear cuenta' : 'PedalMap Premium'}
        </p>
        <h2 id="premium-title" className="mt-2 font-display text-2xl font-extrabold leading-tight">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{copy.body}</p>

        {/* Body content */}
        {isAnonymousWall ? (
          <>
            <p className="mt-3 text-sm text-white/80">
              {isCircularGuestWall
                ? 'Ya has usado el Objetivo gratis de este mes. Regístrate para conservar tus rutas y disponer de 15 creaciones mensuales.'
                : 'Te quedan 0 rutas de prueba. Regístrate gratis para seguir creando rutas.'}
            </p>
            <div className="mt-5 space-y-2 text-sm text-white/80">
              <ul className="space-y-2">
                {!isCircularGuestWall && (
                  <li className="flex gap-2">
                    <span className="text-[var(--color-signal)]" aria-hidden>·</span>
                    <span>3 rutas de prueba gratis</span>
                  </li>
                )}
                <li className="flex gap-2">
                  <span className="text-[var(--color-signal)]" aria-hidden>·</span>
                  <span>Cuenta gratis para siempre (plan Free)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--color-signal)]" aria-hidden>·</span>
                  <span>15 rutas/mes, 5 guardadas, 1 GPX/semana</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--color-signal)]" aria-hidden>·</span>
                  <span>Premium opcional cuando quieras</span>
                </li>
              </ul>
            </div>
          </>
        ) : (
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
                <span className="text-[var(--color-signal)]" aria-hidden>·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {isAnonymousWall ? (
            <>
              <Button onClick={signInGoogle} className="w-full sm:w-auto">
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.15 4.91l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuar con Google
              </Button>
              <Link to="/register" onClick={() => track('signup_email_clicked' as const, { from: 'anonymous_limit' })}>
                <Button variant="secondary">
                  Crear cuenta gratis
                </Button>
              </Link>
              <Link to="/login" onClick={() => track('login_existing_clicked' as const, { from: 'anonymous_limit' })}>
                <Button variant="ghost" className="!text-white/90 !border-white/15">
                  Ya tengo una cuenta
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/premium"
                onClick={() => track('premium_clicked' as const, { reason: reason ?? 'unknown' })}
              >
                <Button>Ver Premium</Button>
              </Link>
              <Button variant="ghost" className="!text-white/90 !border-white/15" onClick={onClose}>
                Seguir Free
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}