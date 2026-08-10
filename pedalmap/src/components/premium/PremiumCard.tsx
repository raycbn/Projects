import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics'

interface PremiumCardProps {
  reason?: string | null
  onClose?: () => void
}

export function PremiumCard({ reason, onClose }: PremiumCardProps) {
  const title =
    reason === 'guest_limit'
      ? 'Has probado el planificador como invitado'
      : reason === 'circular_premium'
        ? 'Las rutas circulares avanzadas son Premium'
        : reason === 'gpx_export'
          ? 'La exportación GPX es Premium'
          : reason === 'filter_limit'
            ? 'Free permite hasta 2 filtros a la vez'
            : 'Has llegado al límite de rutas gratuitas'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-title"
    >
      <div className="w-full max-w-md animate-rise rounded-3xl bg-[var(--color-panel)] p-6 text-white shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-signal)]">
          PedalMap Premium
        </p>
        <h2 id="premium-title" className="mt-2 font-display text-2xl font-extrabold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-white/75">
          {reason === 'circular_premium'
            ? 'Puedes seguir con A → B o Ida y vuelta en Free. Objetivo (km + desnivel) es Premium.'
            : reason === 'filter_limit'
              ? 'Desactiva un filtro o pasa a Premium para combinar más de 2.'
              : 'Desbloquea PedalMap Premium y planifica sin fricciones.'}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {[
            'Rutas ilimitadas',
            'Exportación GPX',
            'Más de 2 filtros a la vez',
            'Modo Objetivo (circular con km/desnivel)',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-[var(--color-signal)]" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/premium"
            onClick={() => track('premium_clicked', { reason: reason ?? 'unknown' })}
          >
            <Button>Probar Premium</Button>
          </Link>
          {onClose && (
            <Button variant="ghost" className="!text-white !border-white/20" onClick={onClose}>
              Seguir explorando
            </Button>
          )}
        </div>
        <p className="mt-4 text-xs text-white/50">
          Stripe test vía Cloudflare Workers (sin Blaze). Free: hasta 2 filtros a la vez.
        </p>
      </div>
    </div>
  )
}
