import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'

/**
 * Single-purpose screen: how to get rides into PedalMap.
 * Keeps OAuth/vendor noise off the activities list.
 */
export function ConnectGpsPage() {
  usePageMeta({
    title: 'Conectar GPS | PedalMap',
    description: 'Graba en el móvil o trae salidas desde tu ciclocomputador a PedalMap.',
    path: '/actividades/conectar',
  })

  const { user } = useAuth()

  return (
    <main className="mx-auto max-w-lg px-4 py-10 pb-28">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
        Actividades
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
        Conectar GPS
      </h1>
      <p className="mt-2 text-[var(--color-stone)]">
        Elige una forma de registrar salidas. Sin paneles de marketing: solo conexiones.
      </p>

      {!user || user.isAnonymous ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">
          <Link to="/login" className="font-semibold text-[var(--color-trail)]">
            Inicia sesión
          </Link>{' '}
          para sincronizar salidas en la nube.
        </p>
      ) : null}

      <ul className="mt-8 space-y-4">
        <li className="rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
          <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
            GPS del móvil
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            Graba la salida en PedalMap con la pantalla activa. Ideal sin ciclocomputador.
          </p>
          <Link to="/actividad" className="mt-4 inline-block">
            <Button>Iniciar grabación</Button>
          </Link>
        </li>

        <li className="rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
          <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
            Exportar ruta a tu GPS
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            Desde una ruta lista puedes enviar GPX a Garmin, Wahoo, OsmAnd u Organic Maps
            (Premium).
          </p>
          <Link to="/ruta" className="mt-4 inline-block">
            <Button variant="secondary">Ir a ruta lista</Button>
          </Link>
        </li>

        <li className="rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
          <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
            Wahoo y otros GPS
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            La sincronización automática (Wahoo / puente GPS) se activa cuando tengas las
            credenciales de la marca configuradas en el Worker. Mientras tanto, usa grabación
            nativa o GPX.
          </p>
          <p className="mt-3 text-xs text-[var(--color-stone)]">
            Strava como puente técnico solo si la API de tu app está activa; no hace falta vivir
            en Strava.
          </p>
        </li>
      </ul>

      <Link
        to="/actividades"
        className="mt-8 inline-block text-sm font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
      >
        ← Volver a actividades
      </Link>
    </main>
  )
}
