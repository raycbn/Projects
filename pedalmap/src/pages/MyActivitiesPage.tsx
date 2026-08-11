import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { activityRepository } from '@/services/ActivityRepository'
import type { Activity } from '@/domain/types'
import { formatDistance, formatDuration, formatElevation } from '@/lib/stats'

function statusLabel(status: Activity['status']): string {
  switch (status) {
    case 'finished':
      return 'Terminada'
    case 'recording':
      return 'En curso'
    case 'paused':
      return 'Pausada'
    default:
      return status
  }
}

export function MyActivitiesPage() {
  usePageMeta({
    title: 'Mis rodadas | PedalMap',
    description: 'Historial suave de salidas GPS con PedalMap.',
    path: '/actividades',
    noindex: true,
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
        if (!cancelled) setError('No se pudieron cargar las rodadas.')
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
    <main className="mx-auto max-w-2xl px-4 py-10 pb-28">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
        Historial
      </p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
            Mis rodadas
          </h1>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--color-stone)]">
            Salidas grabadas con GPS. Sin ruido: solo lo esencial.
          </p>
        </div>
        <Link to="/actividad">
          <Button size="sm">Nueva</Button>
        </Link>
      </div>

      {!user || user.isAnonymous ? (
        <p className="mt-8 text-sm text-[var(--color-stone)]">
          <Link to="/login" className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline">
            Entra
          </Link>{' '}
          para guardar rodadas entre dispositivos.
        </p>
      ) : loading ? (
        <p className="mt-8 animate-pulse-soft text-sm text-[var(--color-stone)]">Cargando…</p>
      ) : error ? (
        <p className="mt-8 text-sm text-[var(--color-danger)]">{error}</p>
      ) : items.length === 0 ? (
        <div className="mt-10 space-y-3">
          <p className="text-sm text-[var(--color-stone)]">
            Aún no hay rodadas. Crea una ruta y pulsa salir, o inicia GPS directo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/route-planner">
              <Button variant="secondary" size="sm">
                Crear ruta
              </Button>
            </Link>
            <Link to="/actividad">
              <Button variant="ghost" size="sm">
                Grabar GPS
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-[var(--color-fog)]/80">
          {items.map((a) => (
            <li key={a.id} className="py-4 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold text-[var(--color-forest)]">
                    {a.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-stone)]">
                    {new Date(a.startedAt).toLocaleDateString('es-ES', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    · {statusLabel(a.status)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-[var(--color-forest)]">
                  {formatDistance(a.stats.distanceMeters)}
                </p>
              </div>
              <p className="mt-2 text-xs text-[var(--color-stone)]">
                {formatDuration(a.stats.durationSeconds)}
                {a.stats.elevationGainMeters > 0
                  ? ` · ${formatElevation(a.stats.elevationGainMeters)} +`
                  : ''}
              </p>
              {a.routeId ? (
                <Link
                  to={`/ruta?routeId=${a.routeId}`}
                  className="mt-2 inline-block text-xs font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
                >
                  Reabrir ruta
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
