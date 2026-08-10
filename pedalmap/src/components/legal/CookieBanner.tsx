import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { getConsent, setConsent, type ConsentValue } from '@/lib/consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(getConsent() === null)
  }, [])

  function choose(value: ConsentValue) {
    setConsent(value)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-50 mx-auto max-w-lg px-3 md:bottom-4"
      role="dialog"
      aria-label="Consentimiento de cookies"
    >
      <div className="rounded-2xl bg-[var(--color-panel)] p-4 text-sm text-white shadow-xl ring-1 ring-white/10">
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
          <Button className="!py-2" onClick={() => choose('accepted')}>
            Aceptar
          </Button>
          <Button variant="ghost" className="!border-white/30 !text-white !py-2" onClick={() => choose('rejected')}>
            Rechazar
          </Button>
        </div>
      </div>
    </div>
  )
}
