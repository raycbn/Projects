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
      'Rutas ilimitadas, GPX, filtros avanzados y rutas circulares. 4,99 €/mes o 39,99 €/año (Stripe test).',
    path: '/premium',
  })

  const { user } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(() => {
    if (params.get('checkout') === 'success') {
      return 'Checkout de prueba completado. Premium se activará cuando el webhook escriba en Firestore.'
    }
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
        'Falta el Worker API (VITE_PEDALMAP_API_URL) o VITE_STRIPE_ENABLED. Sin Blaze: usa Cloudflare Workers.',
      )
      return
    }
    setBusy(true)
    try {
      const { url } = await stripeService.startCheckout(interval)
      window.location.assign(url)
    } catch (error) {
      console.error('[stripe]', error)
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo abrir Stripe Checkout. Revisa el Worker y los precios.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function openPortal() {
    if (!stripeReady) {
      setMessage('Portal disponible cuando el Worker Stripe esté activo.')
      return
    }
    setBusy(true)
    try {
      const { url } = await stripeService.openCustomerPortal()
      window.location.assign(url)
    } catch (error) {
      console.error('[stripe portal]', error)
      setMessage(
        error instanceof Error
          ? error.message
          : 'No hay suscripción Stripe asociada a esta cuenta.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 pb-24">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
        Premium · Stripe test
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-[var(--color-forest)]">
        PedalMap Premium
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--color-stone)]">
        Sandbox de Stripe (sin cobros reales). Infra en Cloudflare Workers + Firebase Spark — sin
        Blaze.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white/80 p-6 ring-1 ring-[var(--color-fog)]">
          <h2 className="font-display text-2xl font-bold">Free</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--color-stone)]">
            <li>Creación limitada de rutas</li>
            <li>Guardado limitado</li>
            <li>Hasta 2 filtros a la vez</li>
            <li>Compartir básico</li>
          </ul>
        </div>
        <div className="rounded-3xl bg-[var(--color-panel)] p-6 text-white">
          <h2 className="font-display text-2xl font-bold text-[var(--color-signal)]">Premium</h2>
          <p className="mt-2 text-sm text-white/70">4,99 €/mes · 39,99 €/año</p>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>Rutas ilimitadas</li>
            <li>Exportación GPX</li>
            <li>Filtros ilimitados</li>
            <li>Rutas circulares avanzadas</li>
            <li>Estadísticas avanzadas</li>
            <li>Base para navegación GPS</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void startCheckout('month')}>
              Mensual 4,99 €
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void startCheckout('year')}
            >
              Anual 39,99 €
            </Button>
            <Button
              variant="ghost"
              className="!text-white !border-white/20"
              disabled={busy}
              onClick={() => void openPortal()}
            >
              Gestionar
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/50">
            {stripeReady
              ? 'Checkout test vía Cloudflare Worker + webhook → Firestore.'
              : 'Activa VITE_STRIPE_ENABLED y el Worker API para probar el checkout.'}
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
