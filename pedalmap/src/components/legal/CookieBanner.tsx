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

  useEffect(() => {
    setVisible(getConsent() === null)
  }, [])

  function choose(value: ConsentValue) {
    setConsent(value)
    track('consent_updated', { value: value === 'accepted' ? 'accepted' : 'rejected' })
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={
        onPlanner || onNav
          ? 'fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
          : 'fixed inset-x-0 z-[70] mx-auto max-w-lg px-3 bottom-[calc(var(--tabbar-h)+0.5rem)] md:bottom-4'
      }
      role="dialog"
      aria-modal="true"
      aria-label="Consentimiento de cookies"
    >
      <div className="rounded-2xl bg-[var(--color-panel)] p-4 text-sm text-white shadow-2xl ring-1 ring-white/15">
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
      </div>
    </div>
  )
}
