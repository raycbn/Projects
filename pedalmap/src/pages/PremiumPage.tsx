import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useAuth } from '@/app/AuthContext'
import { stripeService } from '@/services/StripeService'
import { grupetaService, type GrupetaPackView } from '@/services/GrupetaService'
import { fetchServerEntitlements, syncServerPlan } from '@/lib/planSync'
import {
  ANNUAL_TRIAL_DAYS,
  GRUPETA_MEMBER_SEATS,
  GRUPETA_PRICE_MONTH,
  GRUPETA_PRICE_YEAR,
  GRUPETA_SEAT_LIMIT,
} from '@/domain/types'

export function PremiumPage() {
  usePageMeta({
    title: 'PedalMap Premium',
    description: `Rutas ilimitadas, GPX a tu GPS y Objetivo avanzado. Prueba ${ANNUAL_TRIAL_DAYS} días con el plan anual · 39,99 €/año o 4,99 €/mes. Pack Grupeta: 4 plazas.`,
    path: '/premium',
  })

  const { user, profile } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [syncingPlan, setSyncingPlan] = useState(false)
  const [message, setMessage] = useState<string | null>(() => {
    if (params.get('checkout') === 'success') {
      if (params.get('pack') === 'grupeta') {
        return params.get('trial') === '1'
          ? `Pack Grupeta listo. Activando prueba de ${ANNUAL_TRIAL_DAYS} días… Luego asigna hasta ${GRUPETA_MEMBER_SEATS} emails.`
          : `Pack Grupeta listo. Activando… Luego asigna hasta ${GRUPETA_MEMBER_SEATS} emails.`
      }
      return params.get('trial') === '1'
        ? `Checkout completado. Activando tu prueba de ${ANNUAL_TRIAL_DAYS} días…`
        : 'Checkout completado. Activando Premium…'
    }
    if (params.get('checkout') === 'cancel') return 'Checkout cancelado.'
    return null
  })
  const [pack, setPack] = useState<GrupetaPackView | null>(null)
  const [seatDrafts, setSeatDrafts] = useState<string[]>(['', '', ''])
  const [seatsBusy, setSeatsBusy] = useState(false)
  const stripeReady = stripeService.isConfigured()
  const isPremium = profile?.plan === 'premium'
  const startedWithTrial = params.get('trial') === '1'
  const wantsGrupeta = params.get('pack') === 'grupeta' || params.get('grupeta') === '1'

  const packBillable = Boolean(pack?.billable)

  const memberEmailsFromPack = useMemo(
    () =>
      (pack?.seats || [])
        .filter((s) => s.role === 'member' && s.email)
        .map((s) => s.email as string),
    [pack],
  )

  useEffect(() => {
    if (memberEmailsFromPack.length === 0) return
    setSeatDrafts((prev) => {
      const next = ['', '', '']
      memberEmailsFromPack.slice(0, GRUPETA_MEMBER_SEATS).forEach((e, i) => {
        next[i] = e
      })
      // Keep typing if user already started editing empty form
      if (prev.some((p) => p.trim()) && memberEmailsFromPack.length === 0) return prev
      return next
    })
  }, [memberEmailsFromPack])

  async function reloadPack() {
    if (!user || user.isAnonymous || !grupetaService.isConfigured()) {
      setPack(null)
      return
    }
    try {
      const res = await grupetaService.getPack()
      setPack(res.pack)
    } catch (error) {
      console.warn('[grupeta] pack', error)
    }
  }

  useEffect(() => {
    void reloadPack()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isPremium])

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
      await reloadPack()
      if (cancelled) return
      if (ent?.plan === 'premium') {
        setMessage(
          params.get('pack') === 'grupeta'
            ? `Pack Grupeta activo. Asigna hasta ${GRUPETA_MEMBER_SEATS} emails de tu grupeta abajo.`
            : startedWithTrial
              ? `¡Prueba de ${ANNUAL_TRIAL_DAYS} días activa! Premium listo: Objetivo, GPX y guardados ilimitados.`
              : '¡Premium activado! Ya puedes usar Objetivo, GPX y guardados ilimitados.',
        )
        setSyncingPlan(false)
        track('premium_activated', {
          source: 'checkout_poll',
          trial: startedWithTrial,
          pack: params.get('pack') === 'grupeta' ? 'grupeta' : 'solo',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, user, startedWithTrial])

  async function startCheckout(interval: 'month' | 'year', product: 'solo' | 'grupeta' = 'solo') {
    if (!user || user.isAnonymous) {
      setMessage('Inicia sesión para suscribirte.')
      return
    }
    if (!stripeReady) {
      track('premium_clicked', { source: 'premium_page_preview', product })
      setMessage(
        'Falta el Worker API (VITE_PEDALMAP_API_URL) o VITE_STRIPE_ENABLED. Sin Blaze: usa Cloudflare Workers.',
      )
      return
    }
    setBusy(true)
    try {
      const { url } = await stripeService.startCheckout(interval, product)
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

  async function saveSeats() {
    if (!user || user.isAnonymous) return
    setSeatsBusy(true)
    setMessage(null)
    try {
      const emails = seatDrafts.map((e) => e.trim()).filter(Boolean)
      const res = await grupetaService.setMemberEmails(emails)
      setPack(res.pack)
      const pending = res.pendingSignup?.length
        ? ` Pendientes de registrarse: ${res.pendingSignup.join(', ')}.`
        : ''
      const granted = res.grantedNow?.length
        ? ` Premium ya activo para: ${res.grantedNow.join(', ')}.`
        : ''
      setMessage(`Plazas guardadas.${granted}${pending}`)
      await syncServerPlan().catch(() => null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron guardar las plazas.')
    } finally {
      setSeatsBusy(false)
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
            Premium individual
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
              onClick={() => void startCheckout('year', 'solo')}
            >
              Probar {ANNUAL_TRIAL_DAYS} días · Anual
            </Button>
            <Button
              variant="ghost"
              className="w-full !border-white/30 !text-white"
              disabled={busy || isPremium}
              onClick={() => void startCheckout('month', 'solo')}
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
          {syncingPlan && !message?.includes('activo') && !message?.includes('Prueba') && !message?.includes('Pack')
            ? 'Activando Premium…'
            : message}
        </p>
      )}

      <section
        id="grupeta"
        className={`mt-10 space-y-4 rounded-[1.75rem] bg-white/80 p-6 ring-1 ${
          wantsGrupeta ? 'ring-[var(--color-trail)]' : 'ring-[var(--color-fog)]'
        }`}
      >
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
            Pack Grupeta · {GRUPETA_SEAT_LIMIT} plazas
          </h2>
          <p className="mt-2 text-sm text-[var(--color-stone)]">
            Tú + {GRUPETA_MEMBER_SEATS} compañeros con Premium. Tras el pago asignas los emails (no
            hace falta que tengan cuenta aún). Sin cupones: precio fijo del pack. Hecho en España.
          </p>
          <p className="mt-2 text-sm text-[var(--color-forest)]">
            <strong>{GRUPETA_PRICE_YEAR} €/año</strong> (con {ANNUAL_TRIAL_DAYS} días de prueba) ·{' '}
            <strong>{GRUPETA_PRICE_MONTH} €/mes</strong> sin prueba
          </p>
        </div>

        {!packBillable ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void startCheckout('year', 'grupeta')}
            >
              Pack anual {GRUPETA_PRICE_YEAR} €
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void startCheckout('month', 'grupeta')}
            >
              Pack mensual {GRUPETA_PRICE_MONTH} €
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[var(--color-trail)]">
              Pack activo ({pack?.status}
              {pack?.interval ? ` · ${pack.interval === 'year' ? 'anual' : 'mensual'}` : ''}). Asigna
              hasta {GRUPETA_MEMBER_SEATS} emails:
            </p>
            {seatDrafts.map((value, idx) => (
              <label key={idx} className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                  Compañero {idx + 1}
                </span>
                <input
                  type="email"
                  value={value}
                  onChange={(e) => {
                    const next = [...seatDrafts]
                    next[idx] = e.target.value
                    setSeatDrafts(next)
                  }}
                  placeholder="email@ejemplo.com"
                  className="min-h-11 w-full rounded-xl border-0 bg-[var(--color-mist)]/50 px-3 text-sm text-[var(--color-forest)] ring-1 ring-[var(--color-fog)] outline-none placeholder:text-[var(--color-stone)] focus:ring-2 focus:ring-[var(--color-trail)]"
                />
              </label>
            ))}
            <p className="text-xs text-[var(--color-stone)]">
              Tu email ({profile?.email || 'cuenta'}) ya ocupa 1 plaza. Solo el Worker puede activar
              Premium: nadie se cuela cambiando Firestore.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={seatsBusy} onClick={() => void saveSeats()}>
                {seatsBusy ? 'Guardando…' : 'Guardar plazas'}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void openPortal()}>
                Portal de facturación
              </Button>
            </div>
          </div>
        )}
      </section>

      <Link to="/route-planner" className="mt-8 inline-block">
        <Button variant="ghost">Volver a crear ruta</Button>
      </Link>
    </main>
  )
}
