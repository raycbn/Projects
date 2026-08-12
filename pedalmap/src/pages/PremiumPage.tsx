import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useAuth } from '@/app/AuthContext'
import { stripeService } from '@/services/StripeService'
import { fetchServerEntitlements, syncServerPlan } from '@/lib/planSync'
import { ANNUAL_TRIAL_DAYS } from '@/domain/types'

export function PremiumPage() {
  usePageMeta({
    title: 'PedalMap Premium',
    description: `Rutas ilimitadas, GPX a tu GPS y Objetivo avanzado. Prueba ${ANNUAL_TRIAL_DAYS} días con el plan anual · 39,99 €/año o 4,99 €/mes.`,
    path: '/premium',
  })

  const { user, profile } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [syncingPlan, setSyncingPlan] = useState(false)
  const [message, setMessage] = useState<string | null>(() => {
    if (params.get('checkout') === 'success') {
      return params.get('trial') === '1'
        ? `Checkout completado. Activando tu prueba de ${ANNUAL_TRIAL_DAYS} días…`
        : 'Checkout completado. Activando Premium…'
    }
    if (params.get('checkout') === 'cancel') return 'Checkout cancelado.'
    return null
  })
  const stripeReady = stripeService.isConfigured()
  const isPremium = profile?.plan === 'premium'
  const startedWithTrial = params.get('trial') === '1'

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
        setMessage(
          startedWithTrial
            ? `¡Prueba de ${ANNUAL_TRIAL_DAYS} días activa! Premium listo: Objetivo, GPX y guardados ilimitados.`
            : '¡Premium activado! Ya puedes usar Objetivo, GPX y guardados ilimitados.',
        )
        setSyncingPlan(false)
        track('premium_activated', {
          source: 'checkout_poll',
          trial: startedWithTrial,
        })
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
  }, [params, user, startedWithTrial])

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
      <p className="mt-3 max-w-xl text-[var(--color-stone)] leading-relaxed">
        Free ya deja probar: 1 GPX a la semana y 1 Objetivo al mes. Premium quita los topes.
        El anual incluye {ANNUAL_TRIAL_DAYS} días de prueba.
      </p>

      {isPremium && (
        <p className="mt-4 text-sm font-medium text-[var(--color-forest)]">
          Tu cuenta es Premium{profile?.email ? ` (${profile.email})` : ''}.
        </p>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-[1.75rem] bg-[color-mix(in_oklab,var(--color-mist)_55%,white)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-stone)]">
            Free
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--color-forest)]/90">
            <li>Hasta 5 rutas guardadas</li>
            <li>15 creaciones / mes</li>
            <li>1 GPX / semana · 1 Objetivo / mes</li>
            <li>2 filtros a la vez</li>
            <li>1 ruta con aviso de viento</li>
          </ul>
        </div>

        <div className="rounded-[1.75rem] bg-[var(--color-panel)] p-6 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-signal)]">
            Premium
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/85">
            <li>Rutas y guardados ilimitados</li>
            <li>GPX ilimitado a Garmin / Wahoo / apps</li>
            <li>Objetivo ilimitado</li>
            <li>Filtros sin techo</li>
            <li>Avisos de viento en todas tus rutas</li>
          </ul>
          <p className="mt-5 text-sm text-white/65">
            {ANNUAL_TRIAL_DAYS} días gratis con el anual · luego 39,99 €/año
          </p>
          <p className="mt-1 text-xs text-white/45">o 4,99 €/mes sin prueba</p>
          <div className="mt-4 space-y-2">
            <Button
              className="w-full"
              disabled={busy || isPremium}
              onClick={() => void startCheckout('year')}
            >
              Probar {ANNUAL_TRIAL_DAYS} días · Anual
            </Button>
            <Button
              variant="ghost"
              className="w-full !border-white/30 !text-white"
              disabled={busy || isPremium}
              onClick={() => void startCheckout('month')}
            >
              Mensual 4,99 €
            </Button>
            {isPremium && (
              <Button
                variant="ghost"
                className="w-full !border-white/30 !text-white"
                disabled={busy}
                onClick={() => void openPortal()}
              >
                Gestionar suscripción
              </Button>
            )}
          </div>
        </div>
      </div>

      {(message || syncingPlan) && (
        <p className="mt-6 rounded-2xl bg-[var(--color-mist)] px-4 py-3 text-sm text-[var(--color-forest)]">
          {syncingPlan && !message?.includes('activado') && !message?.includes('Prueba')
            ? 'Activando Premium…'
            : message}
        </p>
      )}

      <section className="mt-10 space-y-2 rounded-[1.75rem] bg-white/80 p-6 ring-1 ring-[var(--color-fog)]">
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Pack Grupeta</h2>
        <p className="text-sm text-[var(--color-stone)]">
          Invita a 2 amigos. En el checkout anual usa el código promo{' '}
          <strong className="text-[var(--color-forest)]">GRUPETA</strong> (Stripe) o comparte este
          enlace. Hecho en España.
        </p>
        {params.get('grupeta') === '1' ? (
          <p className="text-sm font-semibold text-[var(--color-trail)]">
            Código GRUPETA listo — elígelo en Checkout al pagar el anual.
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const url = `${window.location.origin}/premium?grupeta=1`
            const text = `Únete a PedalMap Premium (rutas bici con viento y GPX). Checkout anual + código GRUPETA: ${url}`
            void navigator.clipboard?.writeText(text)
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
          }}
        >
          Compartir invitación
        </Button>
      </section>

      <Link to="/route-planner" className="mt-8 inline-block">
        <Button variant="ghost">Volver a crear ruta</Button>
      </Link>
    </main>
  )
}
