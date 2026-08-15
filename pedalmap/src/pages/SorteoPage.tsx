import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/app/AuthContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { BRAND_EMAILS } from '@/lib/brandEmails'
import { consumeSorteoSignup } from '@/lib/sorteoSignup'
import { SORTEO_PREMIUM_50, sorteoStatus } from '@/content/sorteoPremium50'

export function SorteoPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const signedIn = Boolean(user && !user.isAnonymous)
  const justJoined = params.get('listo') === '1'
  const status = sorteoStatus()
  const open = status === 'open'

  useEffect(() => {
    if (justJoined) consumeSorteoSignup()
  }, [justJoined])

  usePageMeta({
    title: `${SORTEO_PREMIUM_50.title} | PedalMap`,
    description: SORTEO_PREMIUM_50.description,
    path: SORTEO_PREMIUM_50.path,
  })

  return (
    <main className="mx-auto max-w-lg px-4 py-12 pb-24">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-trail)]">
        Promoción Instagram
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
        {SORTEO_PREMIUM_50.title}
      </h1>
      <p className="mt-3 text-[var(--color-stone)]">
        Los {SORTEO_PREMIUM_50.winners} primeros que creen una cuenta nueva se llevan Premium{' '}
        {SORTEO_PREMIUM_50.months} meses. Hasta el {SORTEO_PREMIUM_50.endLabel}.
      </p>

      {justJoined && signedIn ? (
        <div className="mt-6 rounded-2xl bg-white/85 px-4 py-4 ring-1 ring-[var(--color-fog)]">
          <p className="font-display text-lg font-bold text-[var(--color-forest)]">Cuenta creada</p>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            Si estás entre los {SORTEO_PREMIUM_50.winners} primeros, te activamos Premium a mano en
            unos días. Mientras, ya puedes trazar una ruta.
          </p>
          <Link to="/route-planner" className="mt-4 inline-flex">
            <Button type="button">Crear una ruta</Button>
          </Link>
        </div>
      ) : null}

      {status === 'closed' ? (
        <p className="mt-6 rounded-2xl bg-white/85 px-4 py-4 text-sm text-[var(--color-stone)] ring-1 ring-[var(--color-fog)]">
          Esta promoción ya está cerrada. Sigue usando PedalMap gratis o mira{' '}
          <Link className="font-semibold text-[var(--color-trail)]" to="/premium">
            Premium
          </Link>
          .
        </p>
      ) : null}

      {status === 'soon' ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">
          Empieza el {SORTEO_PREMIUM_50.startLabel}. Puedes crear la cuenta desde ese día.
        </p>
      ) : null}

      {open && !justJoined ? (
        <div className="mt-8 space-y-3">
          {signedIn ? (
            <p className="rounded-2xl bg-white/85 px-4 py-4 text-sm text-[var(--color-stone)] ring-1 ring-[var(--color-fog)]">
              Ya tienes cuenta. El cupo es solo para <strong>cuentas nuevas</strong> de esta
              promoción. Si acabas de registrarte, estás dentro del recuento.
            </p>
          ) : (
            <>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--color-forest)]">
                <li>Sigue a PedalMap en Instagram.</li>
                <li>Crea una cuenta aquí (Google o email). El invitado no cuenta.</li>
              </ol>
              <Link to={SORTEO_PREMIUM_50.registerPath} className="inline-flex w-full">
                <Button type="button" className="w-full">
                  Crear cuenta
                </Button>
              </Link>
            </>
          )}
        </div>
      ) : null}

      <section className="mt-10 space-y-2 text-sm text-[var(--color-stone)]">
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">Bases</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>+18. Un premio por persona (un email).</li>
          <li>
            Cuenta nueva = email que no existía en PedalMap al abrir la promo. Invitar sin
            registrarte no entra.
          </li>
          <li>
            Ganan los {SORTEO_PREMIUM_50.winners} primeros emails nuevos hasta el{' '}
            {SORTEO_PREMIUM_50.endLabel}.
          </li>
          <li>
            Premio: acceso Premium {SORTEO_PREMIUM_50.months} meses, no canjeable por dinero.
            Activación a mano; aviso por email.
          </li>
          <li>Sin obligación de compra. No está patrocinado por Instagram.</li>
          <li>
            Dudas: {BRAND_EMAILS.hello}
          </li>
        </ul>
      </section>
    </main>
  )
}
