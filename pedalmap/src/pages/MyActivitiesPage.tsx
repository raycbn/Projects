import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { activityRepository } from '@/services/ActivityRepository'
import type { Activity } from '@/domain/types'
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatSpeedKmh,
} from '@/lib/stats'

export function MyActivitiesPage() {
  usePageMeta({
    title: 'Mis actividades | PedalMap',
    description: 'Historial de salidas GPS con análisis Free (movimiento, VAM, potencia estimada).',
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
            GPS nativo
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
            Mis actividades
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-stone)]">
            Al finalizar una salida se guarda sola en PedalMap y abre el análisis — sin pasos
            extra ni apps intermedias.
          </p>
        </div>
        <Link to="/actividad">
          <Button>Nueva actividad</Button>
        </Link>
      </div>

      {!user || user.isAnonymous ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">
          <Link to="/login" className="font-semibold text-[var(--color-trail)]">
            Inicia sesión
          </Link>{' '}
          para grabar y ver actividades GPS.
        </p>
      ) : loading ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">Cargando…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">
          Aún no hay actividades.{' '}
          <Link to="/actividad" className="font-semibold text-[var(--color-trail)]">
            Empieza a grabar
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                to={`/actividades/${a.id}`}
                className="block rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)] transition hover:bg-[var(--color-mist)]/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-[var(--color-forest)]">
                      {a.title}
                    </p>
                    <p className="text-xs text-[var(--color-stone)]">
                      {new Date(a.startedAt).toLocaleString('es-ES')}
                      {a.status !== 'finished' ? ` · ${a.status}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-forest)]">
                    {formatDistance(a.stats.distanceMeters)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-[var(--color-stone)]">
                  {formatDuration(a.stats.movingTimeSeconds ?? a.stats.durationSeconds)} mov. ·{' '}
                  {formatElevation(a.stats.elevationGainMeters)}
                  {a.stats.averageSpeedMetersPerSecond !== undefined
                    ? ` · ${formatSpeedKmh(a.stats.averageSpeedMetersPerSecond)}`
                    : ''}
                  {a.stats.estimatedPowerWatts !== undefined || a.stats.averagePowerWatts !== undefined
                    ? ` · ${a.stats.estimatedPowerWatts ?? a.stats.averagePowerWatts} W`
                    : ''}
                  {a.stats.vamMetersPerHour !== undefined
                    ? ` · VAM ${a.stats.vamMetersPerHour}`
                    : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
