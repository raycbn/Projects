import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useAuth } from '@/app/AuthContext'
import { stripeService } from '@/services/StripeService'

export function PremiumPage() {
  usePageMeta({
    title: 'PedalMap Premium',
    description:
      'Rutas ilimitadas, GPX, filtros avanzados y rutas circulares. Suscripción vía Stripe (Fase 4).',
    path: '/premium',
  })

  const { user } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(() => {
    if (params.get('checkout') === 'success') return 'Pago recibido. Premium se activará en unos segundos.'
    if (params.get('checkout') === 'cancel') return 'Checkout cancelado.'
    return null
  })
  const stripeReady = stripeService.isConfigured()

  async function startCheckout(interval: 'month' | 'year') {
    if (!user || user.isAnonymous) {
      setMessage('Inicia sesión para suscribirte.')
      return
    }
    if (!stripeReady) {
      track('premium_clicked', { source: 'premium_page_preview' })
      setMessage(
        'Stripe está cableado en código (Cloud Functions). Activa VITE_STRIPE_ENABLED=true y despliega Functions en Blaze para cobrar de verdad.',
      )
      return
    }
    setBusy(true)
    try {
      const { url } = await stripeService.startCheckout(interval)
      window.location.assign(url)
    } catch (error) {
      console.error('[stripe]', error)
      setMessage('No se pudo abrir Stripe Checkout. Revisa Functions y precios.')
    } finally {
      setBusy(false)
    }
  }

  async function openPortal() {
    if (!stripeReady) {
      setMessage('Portal de cliente disponible cuando Stripe esté activo.')
      return
    }
    setBusy(true)
    try {
      const { url } = await stripeService.openCustomerPortal()
      window.location.assign(url)
    } catch (error) {
      console.error('[stripe portal]', error)
      setMessage('No hay suscripción Stripe asociada a esta cuenta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 pb-24">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
        Fase 4 · Monetización
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
            <li>Base para navegación GPS</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void startCheckout('month')}>
              Mensual
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void startCheckout('year')}
            >
              Anual
            </Button>
            <Button variant="ghost" className="!text-white !border-white/20" disabled={busy} onClick={() => void openPortal()}>
              Gestionar
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/50">
            {stripeReady
              ? 'Checkout real vía Stripe + webhook (Cloud Functions).'
              : 'Scaffold Fase 4 listo. Sin cobros hasta activar Stripe + Functions.'}
          </p>
        </div>
      </div>

      {message && (
        <p className="mt-6 rounded-2xl bg-[var(--color-mist)] px-4 py-3 text-sm text-[var(--color-forest)]">
          {message}
        </p>
      )}

      <Link to="/route-planner" className="mt-8 inline-block">
        <Button variant="ghost">Volver al planificador</Button>
      </Link>
    </main>
  )
}
