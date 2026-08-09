import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'

export function PremiumPage() {
  usePageMeta({
    title: 'PedalMap Premium',
    description:
      'Rutas ilimitadas, GPX, filtros avanzados y rutas circulares. Suscripción preparada para Stripe.',
    path: '/premium',
  })

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 pb-24">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
        Monetización
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-[var(--color-forest)]">
        PedalMap Premium
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--color-stone)]">
        El plan gratuito sirve para probar y planificar. Premium quita límites cuando la app se
        convierte en tu herramienta habitual.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white/80 p-6 ring-1 ring-[var(--color-fog)]">
          <h2 className="font-display text-2xl font-bold">Free</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--color-stone)]">
            <li>Creación limitada de rutas</li>
            <li>Guardado limitado</li>
            <li>Compartir básico</li>
            <li>Perfil de elevación</li>
          </ul>
        </div>
        <div className="rounded-3xl bg-[var(--color-panel)] p-6 text-white">
          <h2 className="font-display text-2xl font-bold text-[var(--color-signal)]">Premium</h2>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>Rutas ilimitadas</li>
            <li>Exportación GPX</li>
            <li>Filtros avanzados</li>
            <li>Rutas circulares avanzadas</li>
            <li>Estadísticas avanzadas</li>
            <li>Base para navegación y offline</li>
          </ul>
          <Button
            className="mt-6"
            onClick={() => track('premium_clicked', { source: 'premium_page' })}
          >
            Probar Premium
          </Button>
          <p className="mt-3 text-xs text-white/50">
            Stripe estará conectado en la Fase 4. No hay cobros reales todavía.
          </p>
        </div>
      </div>

      <Link to="/route-planner" className="mt-8 inline-block">
        <Button variant="ghost">Volver al planificador</Button>
      </Link>
    </main>
  )
}
