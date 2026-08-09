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
          Desbloquea PedalMap Premium y planifica sin fricciones.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {[
            'Rutas ilimitadas',
            'Exportación GPX',
            'Filtros avanzados',
            'Rutas circulares avanzadas',
            'Estadísticas avanzadas',
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
          Los pagos reales se activarán cuando integremos Stripe. Ahora mismo puedes explorar el
          diseño y los límites del plan gratuito.
        </p>
      </div>
    </div>
  )
}
