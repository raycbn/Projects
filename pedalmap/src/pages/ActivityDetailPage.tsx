import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { activityRepository } from '@/services/ActivityRepository'
import { routeRepository } from '@/services/RouteRepository'
import type { Activity, RouteDraft, RouteGeometry, Waypoint } from '@/domain/types'
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatSpeedKmh,
} from '@/lib/stats'
import {
  closeWhatsAppPlaceholder,
  openWhatsAppPlaceholder,
  shareActivityCard,
} from '@/lib/shareCard'
import { track } from '@/lib/analytics'
import { canSaveRoute } from '@/services/EntitlementService'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

/**
 * Post-ride analysis — Free tier shows more than Strava Free basics
 * (moving time, elev loss, grade, VAM, estimated power/kcal, km splits).
 */
export function ActivityDetailPage() {
  const { activityId = '' } = useParams()
  const { user, profile, firebaseReady } = useAuth()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [shareBusy, setShareBusy] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  usePageMeta({
    title: activity ? `${activity.title} | PedalMap` : 'Actividad | PedalMap',
    description: 'Análisis de tu salida: tiempo en movimiento, potencia estimada, VAM y splits.',
    path: activityId ? `/actividades/${activityId}` : '/actividades',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!firebaseReady || !activityRepository.isConfigured() || !activityId) {
        setLoading(false)
        return
      }
      try {
        const row = await activityRepository.getById(activityId)
        if (cancelled) return
        if (!row) {
          setError('No encontramos esa actividad.')
          return
        }
        if (user && !user.isAnonymous && row.userId !== user.uid) {
          setError('Esta actividad pertenece a otra cuenta.')
          return
        }
        setActivity(row)
      } catch (err) {
        console.error('[activity detail]', err)
        if (!cancelled) setError('No se pudo cargar la actividad.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [activityId, firebaseReady, user])

  const geometry: RouteGeometry | null = useMemo(() => {
    if (!activity || activity.track.length < 2) return null
    return {
      type: 'LineString',
      coordinates: activity.track.map((p) => [p.position.lng, p.position.lat]),
    }
  }, [activity])

  const waypoints: Waypoint[] = useMemo(() => {
    const coords = geometry?.coordinates
    if (!coords || coords.length < 2) return []
    const start = coords[0]
    const end = coords[coords.length - 1]
    return [
      {
        id: 'start',
        name: 'Inicio',
        kind: 'start',
        order: 0,
        position: { lng: start[0], lat: start[1] },
      },
      {
        id: 'end',
        name: 'Fin',
        kind: 'end',
        order: 1,
        position: { lng: end[0], lat: end[1] },
      },
    ]
  }, [geometry])

  async function handleWhatsAppShare() {
    if (!activity) return
    const waWindow = openWhatsAppPlaceholder()
    setShareBusy(true)
    setHint(null)
    try {
      const url = `${window.location.origin}/actividades/${activity.id}`
      const result = await shareActivityCard(
        {
          title: activity.title,
          distanceMeters: activity.stats.distanceMeters,
          elevationGainMeters: activity.stats.elevationGainMeters,
          durationSeconds: activity.stats.movingTimeSeconds ?? activity.stats.durationSeconds,
          bikeType: activity.bikeType,
        },
        url,
        { waWindow },
      )
      setHint(
        result === 'whatsapp'
          ? 'WhatsApp abierto · tarjeta descargada'
          : result === 'copied'
            ? 'Mensaje copiado'
            : 'Tarjeta lista',
      )
      track('activity_shared', { via: 'whatsapp' })
    } catch (err) {
      closeWhatsAppPlaceholder(waWindow)
      console.error('[activity share]', err)
      setHint('No se pudo compartir.')
    } finally {
      setShareBusy(false)
    }
  }

  async function handlePublishExplore() {
    if (!activity || !geometry || !user || user.isAnonymous) {
      setHint('Inicia sesión para publicar en Explorar.')
      return
    }
    const entitlement = canSaveRoute(profile)
    if (!entitlement.ok) {
      setHint('Has alcanzado el límite de rutas guardadas en Free.')
      return
    }
    setPublishBusy(true)
    setHint(null)
    try {
      const draft: RouteDraft = {
        title: activity.title || 'Salida publicada',
        type: 'a_to_b',
        bikeType: activity.bikeType,
        preferences: [],
        waypoints,
        geometry,
        elevationProfile: activity.track.map((p) => ({
          distanceMeters: 0,
          elevationMeters: p.elevationMeters ?? 0,
          position: p.position,
        })),
        stats: {
          distanceMeters: activity.stats.distanceMeters,
          elevationGainMeters: activity.stats.elevationGainMeters,
          elevationLossMeters: activity.stats.elevationLossMeters ?? 0,
          estimatedDurationSeconds: activity.stats.durationSeconds,
          difficulty: 'moderate',
        },
      }
      const published = await routeRepository.publishForShare(user.uid, draft)
      setHint(`Publicada en Explorar · /route/${published.shareSlug}`)
      track('route_shared', { via: 'activity_publish', public: true })
    } catch (err) {
      console.error('[activity publish]', err)
      setHint('No se pudo publicar. Revisa el límite Free de rutas guardadas.')
    } finally {
      setPublishBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-[var(--color-stone)]">Cargando análisis…</p>
      </main>
    )
  }

  if (error || !activity) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-red-700">{error || 'Actividad no disponible.'}</p>
        <Link to="/actividades" className="mt-4 inline-block">
          <Button variant="ghost">Volver</Button>
        </Link>
      </main>
    )
  }

  const s = activity.stats
  const power = s.estimatedPowerWatts ?? s.averagePowerWatts

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-28">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
            Salida guardada
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
            {activity.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {new Date(activity.startedAt).toLocaleString('es-ES')} · análisis Free incluido
          </p>
        </div>
        <Link to="/actividades">
          <Button variant="ghost">Historial</Button>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={shareBusy}
          onClick={() => void handleWhatsAppShare()}
        >
          {shareBusy ? 'Preparando…' : 'WhatsApp'}
        </Button>
        {user && !user.isAnonymous && geometry ? (
          <Button
            variant="ghost"
            disabled={publishBusy}
            onClick={() => void handlePublishExplore()}
          >
            {publishBusy ? 'Publicando…' : 'Publicar en Explorar'}
          </Button>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-sm text-[var(--color-stone)]">{hint}</p> : null}

      <section className="mt-6 h-56 overflow-hidden rounded-2xl bg-[var(--color-fog)] ring-1 ring-[var(--color-fog)]">
        <Suspense
          fallback={
            <p className="flex h-full items-center justify-center text-sm text-[var(--color-stone)]">
              Mapa…
            </p>
          }
        >
          <MapView
            className="h-full w-full"
            waypoints={waypoints}
            geometry={geometry}
            fitKey={activity.id}
          />
        </Suspense>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
          Más que lo básico
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          En Free: tiempo en movimiento, desnivel −, pendiente, VAM, potencia estimada, kcal y
          splits por km — sin pagar análisis premium de terceros.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="Distancia" value={formatDistance(s.distanceMeters)} />
          <Metric
            label="En movimiento"
            value={formatDuration(s.movingTimeSeconds ?? s.durationSeconds)}
          />
          <Metric label="Tiempo total" value={formatDuration(s.durationSeconds)} />
          <Metric label="Desnivel +" value={formatElevation(s.elevationGainMeters)} />
          <Metric
            label="Desnivel −"
            value={
              s.elevationLossMeters !== undefined
                ? formatElevation(-Math.abs(s.elevationLossMeters))
                : '—'
            }
          />
          <Metric
            label="Vel. media"
            value={
              s.averageSpeedMetersPerSecond !== undefined
                ? formatSpeedKmh(s.averageSpeedMetersPerSecond)
                : '—'
            }
          />
          <Metric
            label="Vel. máx"
            value={
              s.maxSpeedMetersPerSecond !== undefined
                ? formatSpeedKmh(s.maxSpeedMetersPerSecond)
                : '—'
            }
          />
          <Metric label="Potencia" value={power !== undefined ? `${power} W` : '—'} />
          <Metric
            label="VAM"
            value={s.vamMetersPerHour !== undefined ? `${s.vamMetersPerHour} m/h` : '—'}
          />
          <Metric
            label="Pend. media"
            value={s.averageGradePercent !== undefined ? `${s.averageGradePercent} %` : '—'}
          />
          <Metric
            label="Pend. máx"
            value={s.maxGradePercent !== undefined ? `${s.maxGradePercent} %` : '—'}
          />
          <Metric
            label="Energía"
            value={
              s.estimatedCaloriesKcal !== undefined ? `${s.estimatedCaloriesKcal} kcal` : '—'
            }
          />
          {s.averageHeartRateBpm !== undefined && (
            <Metric label="FC media" value={`${s.averageHeartRateBpm} ppm`} />
          )}
          {s.averageCadenceRpm !== undefined && (
            <Metric label="Cadencia" value={`${s.averageCadenceRpm} rpm`} />
          )}
          {s.coastingPercent !== undefined && (
            <Metric label="Rodando suave" value={`${s.coastingPercent} %`} />
          )}
        </div>
      </section>

      {s.splits && s.splits.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
            Splits por km
          </h2>
          <ul className="mt-3 divide-y divide-[var(--color-fog)]">
            {s.splits.map((split) => (
              <li
                key={split.index}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="font-semibold text-[var(--color-forest)]">Km {split.index}</span>
                <span className="text-[var(--color-stone)]">
                  {formatDuration(split.durationSeconds)} ·{' '}
                  {formatSpeedKmh(split.averageSpeedMetersPerSecond)}
                  {split.elevationGainMeters > 0
                    ? ` · ${formatElevation(split.elevationGainMeters)}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8">
        <Link to="/actividad">
          <Button>Nueva salida GPS</Button>
        </Link>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--color-mist)]/60 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg font-bold text-[var(--color-forest)]">{value}</p>
    </div>
  )
}
