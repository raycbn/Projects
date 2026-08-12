import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { getConsent, setConsent, type ConsentValue } from '@/lib/consent'
import { track } from '@/lib/analytics'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const { pathname } = useLocation()
  const onPlanner = pathname.startsWith('/route-planner')
  const onNav = pathname.startsWith('/navegacion')
  const onReadyRoute = pathname === '/ruta'
  // Same routes where AppShell hides the tab bar — don't offset for a bar that isn't there.
  const hideTabbar = onPlanner || onNav || onReadyRoute
  const compact = onPlanner || onNav

  useEffect(() => {
    // On the planner, wait until the first interaction tick so the sticky CTA is usable.
    const consent = getConsent()
    if (consent !== null) {
      setVisible(false)
      return
    }
    if (onPlanner) {
      const t = window.setTimeout(() => setVisible(true), 1800)
      return () => window.clearTimeout(t)
    }
    setVisible(true)
  }, [onPlanner])

  function choose(value: ConsentValue) {
    setConsent(value)
    track('consent_updated', { value: value === 'accepted' ? 'accepted' : 'rejected' })
    setVisible(false)
  }

  if (!visible) return null

  const bottomClass = hideTabbar
    ? 'bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:bottom-4'
    : 'bottom-[calc(var(--tabbar-h)+0.5rem)] md:bottom-4'

  return (
    <div
      className={`fixed inset-x-0 z-[70] mx-auto max-w-lg px-3 ${bottomClass}`}
      role="dialog"
      aria-modal="true"
      aria-label="Consentimiento de cookies"
    >
      <div
        className={
          compact
            ? 'flex items-center gap-2 rounded-xl bg-[var(--color-panel)] px-3 py-2 text-xs text-white shadow-lg ring-1 ring-white/15'
            : 'rounded-2xl bg-[var(--color-panel)] p-4 text-sm text-white shadow-2xl ring-1 ring-white/15'
        }
      >
        {compact ? (
          <>
            <p className="min-w-0 flex-1 leading-snug text-white/90">
              Cookies técnicas + analítica opcional.{' '}
              <Link className="underline" to="/cookies">
                Info
              </Link>
            </p>
            <Button className="!min-h-10 shrink-0 !px-3 !py-1.5 !text-xs" onClick={() => choose('accepted')}>
              OK
            </Button>
            <Button
              variant="ghost"
              className="!min-h-10 shrink-0 !border-white/30 !px-2.5 !py-1.5 !text-xs !text-white"
              onClick={() => choose('rejected')}
            >
              No
            </Button>
          </>
        ) : (
          <>
            <p className="font-semibold">Cookies y analítica</p>
            <p className="mt-1 text-white/80">
              Usamos almacenamiento técnico para la sesión. La analítica agregada (sin anuncios) solo si
              aceptas. Más en{' '}
              <Link className="underline" to="/cookies">
                cookies
              </Link>{' '}
              y{' '}
              <Link className="underline" to="/privacidad">
                privacidad
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="!min-h-11 !py-2" onClick={() => choose('accepted')}>
                Aceptar
              </Button>
              <Button
                variant="ghost"
                className="!min-h-11 !border-white/30 !py-2 !text-white"
                onClick={() => choose('rejected')}
              >
                Rechazar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
