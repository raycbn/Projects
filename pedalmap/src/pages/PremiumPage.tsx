import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useAuth } from '@/app/AuthContext'
import { stripeService } from '@/services/StripeService'
import { fetchServerEntitlements, syncServerPlan } from '@/lib/planSync'

export function PremiumPage() {
  usePageMeta({
    title: 'PedalMap Premium',
    description:
      'Rutas ilimitadas, GPX, filtros avanzados y rutas circulares. 4,99 €/mes o 39,99 €/año (Stripe test).',
    path: '/premium',
  })

  const { user, profile } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [syncingPlan, setSyncingPlan] = useState(false)
  const [message, setMessage] = useState<string | null>(() => {
    if (params.get('checkout') === 'success') {
      return 'Checkout completado. Activando Premium…'
    }
    if (params.get('checkout') === 'cancel') return 'Checkout cancelado.'
    return null
  })
  const stripeReady = stripeService.isConfigured()
  const isPremium = profile?.plan === 'premium'

  // After Stripe success, poll Worker entitlements until plan flips (webhook lag).
  useEffect(() => {
    if (params.get('checkout') !== 'success') return
    if (!user || user.isAnonymous) return
    let cancelled = false
    let tries = 0
    setSyncingPlan(true)
    const tick = async () => {
      tries += 1
      await syncServerPlan().catch(() => null)
      const ent = await fetchServerEntitlements()
      if (cancelled) return
      if (ent?.plan === 'premium') {
        setMessage('¡Premium activado! Ya puedes usar Objetivo, GPX y guardados ilimitados.')
        setSyncingPlan(false)
        track('premium_activated', { source: 'checkout_poll' })
        return
      }
      if (tries >= 12) {
        setMessage(
          'Checkout OK. Si Premium no aparece en unos minutos, revisa el webhook Stripe o recarga el perfil.',
        )
        setSyncingPlan(false)
        return
      }
      window.setTimeout(() => {
        void tick()
      }, 2500)
    }
    void tick()
    return () => {
      cancelled = true
    }
  }, [params, user])

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
      <p className="label-caps text-[var(--color-trail)]">Premium</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-[var(--color-forest)]">
        PedalMap Premium
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--color-stone)]">
        Quita los límites Free: rutas, filtros y GPX sin techo. Empieza gratis y sube cuando lo
        necesites.
      </p>

      {isPremium && (
        <p className="mt-4 rounded-2xl bg-[color-mix(in_oklab,var(--color-signal)_28%,white)] px-4 py-3 text-sm font-semibold text-[var(--color-forest)]">
          Tu cuenta es Premium{profile?.email ? ` (${profile.email})` : ''}.
        </p>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white/90 p-6 ring-1 ring-[var(--color-fog)]">
          <h2 className="font-display text-2xl font-bold text-[var(--color-forest)]">Free</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--color-stone)]">
            <li>Creación limitada de rutas</li>
            <li>Hasta 5 rutas guardadas</li>
            <li>Hasta 2 filtros a la vez</li>
            <li>Compartir básico</li>
          </ul>
          <Link to="/route-planner" className="mt-6 inline-block">
            <Button variant="ghost">Probar gratis</Button>
          </Link>
        </div>
        <div className="rounded-3xl bg-[var(--color-panel)] p-6 text-white">
          <h2 className="font-display text-2xl font-bold text-[var(--color-signal)]">Premium</h2>
          <p className="mt-2 text-sm text-white/70">4,99 €/mes · 39,99 €/año</p>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>Rutas ilimitadas</li>
            <li>Exportación GPX</li>
            <li>Filtros ilimitados</li>
            <li>Modo Objetivo (circular km + desnivel)</li>
            <li>Sin paywall en el planificador</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button disabled={busy || isPremium} onClick={() => void startCheckout('year')}>
              Anual 39,99 €
            </Button>
            <Button
              variant="ghost"
              className="!border-white/40 !text-white"
              disabled={busy || isPremium}
              onClick={() => void startCheckout('month')}
            >
              Mensual 4,99 €
            </Button>
            <Button
              variant="ghost"
              className="!border-white/40 !text-white"
              disabled={busy}
              onClick={() => void openPortal()}
            >
              Gestionar
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/50">
            {stripeReady
              ? 'Checkout en modo test (sin cobro real) hasta activar Stripe live.'
              : 'Activa VITE_STRIPE_ENABLED y el Worker API para probar el checkout.'}
          </p>
        </div>
      </div>

      {(message || syncingPlan) && (
        <p className="mt-6 rounded-2xl bg-[var(--color-mist)] px-4 py-3 text-sm text-[var(--color-forest)]">
          {syncingPlan && !message?.includes('activado')
            ? 'Esperando confirmación del webhook Stripe…'
            : message}
        </p>
      )}

      <Link to="/route-planner" className="mt-8 inline-block">
        <Button variant="ghost">Volver al planificador</Button>
      </Link>
    </main>
  )
}
