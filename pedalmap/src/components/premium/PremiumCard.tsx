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
      ? 'Has usado el cupo de invitado en este dispositivo'
      : reason === 'circular_premium'
        ? 'Las rutas circulares avanzadas son Premium'
        : reason === 'gpx_export'
          ? 'La exportación GPX es Premium'
          : reason === 'filter_limit'
            ? 'Free permite hasta 2 filtros a la vez'
            : 'Has llegado al límite de rutas gratuitas'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-title"
    >
      <div className="w-full max-w-md animate-rise rounded-t-3xl bg-[var(--color-panel)] p-6 text-white shadow-2xl safe-pb sm:rounded-3xl">
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
              : reason === 'guest_limit'
                ? 'Entra o crea cuenta para seguir creando rutas Free este mes.'
                : 'Desbloquea lo que necesitas en el momento del valor.'}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {['Rutas ilimitadas', 'GPX a tu GPS', 'Objetivo avanzado'].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-[var(--color-signal)]" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 space-y-2">
          <Link
            to="/premium"
            className="block"
            onClick={() => track('premium_clicked', { reason: reason ?? 'unknown' })}
          >
            <Button className="w-full">Ver Premium</Button>
          </Link>
          {onClose && (
            <Button
              variant="ghost"
              className="w-full !border-white/20 !text-white"
              onClick={onClose}
            >
              Ahora no
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
