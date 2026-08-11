import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useEffect, useState } from 'react'
import { activityRepository } from '@/services/ActivityRepository'
import type { Activity } from '@/domain/types'
import { formatDistance, formatDuration, formatElevation } from '@/lib/stats'

export function MyActivitiesPage() {
  usePageMeta({
    title: 'Mis actividades | PedalMap',
    description: 'Historial de salidas GPS y conexiones con tu ciclocomputador.',
    path: '/actividades',
  })

  const { user, firebaseReady } = useAuth()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user || user.isAnonymous || !firebaseReady || !activityRepository.isConfigured()) {
        setLoading(false)
        return
      }
      try {
        const list = await activityRepository.listForUser(user.uid)
        if (!cancelled) setItems(list)
      } catch (err) {
        console.error('[activities]', err)
        if (!cancelled) setError('No se pudieron cargar las actividades.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, firebaseReady])

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-28">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
            Mis actividades
          </h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Tus salidas grabadas en PedalMap.</p>
        </div>
        <Link to="/actividad">
          <Button>Nueva salida</Button>
        </Link>
      </div>

      <section className="mt-6 rounded-3xl bg-white/80 p-4 ring-1 ring-[var(--color-fog)]">
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">Conectar GPS</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          Graba en el móvil o enlaza tu ciclocomputador para traer salidas aquí.
        </p>
        <Link to="/actividades/conectar" className="mt-3 inline-block">
          <Button variant="secondary">Abrir conexiones</Button>
        </Link>
      </section>

      {!user || user.isAnonymous ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">
          <Link to="/login" className="font-semibold text-[var(--color-trail)]">
            Inicia sesión
          </Link>{' '}
          para ver y guardar actividades GPS.
        </p>
      ) : loading ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">Cargando…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">
          Aún no hay actividades. Empieza una salida con GPS o conecta tu dispositivo.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold text-[var(--color-forest)]">
                    {a.title}
                  </p>
                  <p className="text-xs text-[var(--color-stone)]">
                    {new Date(a.startedAt).toLocaleString('es-ES')} · {a.status}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[var(--color-forest)]">
                  {formatDistance(a.stats.distanceMeters)}
                </p>
              </div>
              <p className="mt-2 text-sm text-[var(--color-stone)]">
                {formatDuration(a.stats.durationSeconds)} ·{' '}
                {formatElevation(a.stats.elevationGainMeters)} desnivel +
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
