import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { useGeolocation } from '@/hooks/useGeolocation'
import { usePageMeta } from '@/hooks/usePageMeta'
import {
  activityRepository,
  computeActivityStats,
} from '@/services/ActivityRepository'
import type { Activity, ActivityTrackPoint, BikeType, RouteGeometry, Waypoint } from '@/domain/types'
import { formatDistance, formatDuration, formatElevation, formatSpeedKmh } from '@/lib/stats'
import { track } from '@/lib/analytics'
import { takeGpsRoute, type GpsRoutePacket } from '@/lib/gpsRouteHandoff'
import {
  clearActivityCheckpoint,
  loadLatestActivityCheckpoint,
  saveActivityCheckpoint,
} from '@/lib/activityCheckpoint'
import { requestScreenWakeLock, type WakeLockHandle } from '@/lib/wakeLock'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

export function ActivityPage() {
  usePageMeta({
    title: 'Actividad GPS | PedalMap',
    description: 'Graba tu salida en bici con GPS y guarda la actividad en PedalMap.',
    path: '/actividad',
  })

  const { user, firebaseReady } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [localTrack, setLocalTrack] = useState<ActivityTrackPoint[]>([])
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'finished'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [plannedRoute, setPlannedRoute] = useState<GpsRoutePacket | null>(null)
  const [bikeType] = useState<BikeType>((params.get('bike') as BikeType) || 'road')
  const title = params.get('title') || plannedRoute?.title || 'Salida PedalMap'
  const routeId = params.get('routeId') || undefined
  const lastFlushAt = useRef(0)
  const lastFlushLen = useRef(0)
  const wakeLockRef = useRef<WakeLockHandle | null>(null)
  const trackRef = useRef<ActivityTrackPoint[]>([])
  const activityRef = useRef<Activity | null>(null)

  useEffect(() => {
    setPlannedRoute(takeGpsRoute())
  }, [])

  useEffect(() => {
    trackRef.current = localTrack
  }, [localTrack])
  useEffect(() => {
    activityRef.current = activity
  }, [activity])

  // Restore unfinished ride from local checkpoint (survives tab close).
  useEffect(() => {
    if (!user || user.isAnonymous || status !== 'idle') return
    const ckpt = loadLatestActivityCheckpoint()
    if (!ckpt || ckpt.userId !== user.uid) return
    if (ckpt.status !== 'recording' && ckpt.status !== 'paused') return
    setActivity({
      id: ckpt.activityId,
      userId: ckpt.userId,
      routeId: ckpt.routeId,
      title: ckpt.title,
      status: ckpt.status,
      bikeType: ckpt.bikeType,
      startedAt: ckpt.startedAt,
      track: ckpt.track,
      stats: computeActivityStats(ckpt.track, ckpt.startedAt),
      createdAt: ckpt.startedAt,
      updatedAt: ckpt.updatedAt,
    })
    setLocalTrack(ckpt.track)
    setStatus(ckpt.status)
    setMessage(`Se restauró una salida en curso (${ckpt.track.length} puntos GPS).`)
  }, [user, status])

  const recording = status === 'recording'
  const { sample, error: geoError, supported } = useGeolocation(recording)

  // Screen wake lock while recording
  useEffect(() => {
    let cancelled = false
    async function syncLock() {
      if (recording) {
        if (!wakeLockRef.current) {
          const handle = await requestScreenWakeLock()
          if (!cancelled) wakeLockRef.current = handle
        }
      } else if (wakeLockRef.current) {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    }
    void syncLock()
    const onVis = () => {
      if (document.visibilityState === 'visible' && recording) {
        void requestScreenWakeLock().then((h) => {
          wakeLockRef.current = h
        })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      void wakeLockRef.current?.release()
      wakeLockRef.current = null
    }
  }, [recording])

  // Flush track when leaving the page / backgrounding.
  useEffect(() => {
    const flush = () => {
      const act = activityRef.current
      const trackPts = trackRef.current
      if (!act || !user || user.isAnonymous) return
      if (status !== 'recording' && status !== 'paused') return
      const stats = computeActivityStats(trackPts, act.startedAt)
      void activityRepository
        .updateTrack(act.id, trackPts, stats, status === 'paused' ? 'paused' : 'recording')
        .catch((err) => console.warn('[activity] pagehide flush', err))
      saveActivityCheckpoint({
        activityId: act.id,
        userId: user.uid,
        title: act.title,
        bikeType: act.bikeType,
        routeId: act.routeId,
        startedAt: act.startedAt,
        status: status === 'paused' ? 'paused' : 'recording',
        track: trackPts,
        updatedAt: new Date().toISOString(),
      })
    }
    window.addEventListener('pagehide', flush)
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [user, status])

  useEffect(() => {
    if (!sample || !recording || !activity || !user) return
    setLocalTrack((prev) => {
      const last = prev.at(-1)
      if (
        last &&
        Math.abs(last.position.lat - sample.position.lat) < 0.00001 &&
        Math.abs(last.position.lng - sample.position.lng) < 0.00001
      ) {
        return prev
      }
      const next = [
        ...prev,
        {
          position: sample.position,
          elevationMeters: sample.elevationMeters,
          accuracyMeters: sample.accuracyMeters,
          speedMetersPerSecond: sample.speedMetersPerSecond,
          recordedAt: sample.recordedAt,
        },
      ]
      saveActivityCheckpoint({
        activityId: activity.id,
        userId: user.uid,
        title: activity.title,
        bikeType: activity.bikeType,
        routeId: activity.routeId,
        startedAt: activity.startedAt,
        status: 'recording',
        track: next,
        updatedAt: new Date().toISOString(),
      })
      const now = Date.now()
      if (next.length - lastFlushLen.current >= 25 || now - lastFlushAt.current > 45_000) {
        lastFlushAt.current = now
        lastFlushLen.current = next.length
        const stats = computeActivityStats(next, activity.startedAt)
        void activityRepository
          .updateTrack(activity.id, next, stats, 'recording')
          .catch((err) => console.warn('[activity] checkpoint flush', err))
      }
      return next
    })
  }, [sample, recording, activity, user])

  const liveStats = useMemo(() => {
    if (!activity) {
      return computeActivityStats(localTrack, new Date().toISOString())
    }
    return computeActivityStats(localTrack, activity.startedAt)
  }, [localTrack, activity])

  const liveGeometry: RouteGeometry | null = useMemo(() => {
    if (localTrack.length >= 2) {
      return {
        type: 'LineString',
        coordinates: localTrack.map((p) => [p.position.lng, p.position.lat]),
      }
    }
    if (plannedRoute?.geometry?.coordinates?.length) {
      return plannedRoute.geometry
    }
    return null
  }, [localTrack, plannedRoute])

  const mapWaypoints: Waypoint[] = useMemo(() => {
    const coords = liveGeometry?.coordinates
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
        name: localTrack.length >= 2 ? 'Ahora' : 'Fin plan',
        kind: 'end',
        order: 1,
        position: { lng: end[0], lat: end[1] },
      },
    ]
  }, [liveGeometry, localTrack.length])

  async function start() {
    if (!user || user.isAnonymous) {
      setMessage('Inicia sesión para grabar y guardar actividades.')
      return
    }
    if (!firebaseReady || !activityRepository.isConfigured()) {
      setMessage('Firebase no está configurado.')
      return
    }
    if (!supported) {
      setMessage('Este dispositivo no soporta geolocalización.')
      return
    }
    try {
      const created = await activityRepository.create({
        userId: user.uid,
        title,
        bikeType,
        routeId,
      })
      setActivity(created)
      setLocalTrack([])
      setStatus('recording')
      lastFlushAt.current = Date.now()
      lastFlushLen.current = 0
      saveActivityCheckpoint({
        activityId: created.id,
        userId: user.uid,
        title: created.title,
        bikeType: created.bikeType,
        routeId: created.routeId,
        startedAt: created.startedAt,
        status: 'recording',
        track: [],
        updatedAt: new Date().toISOString(),
      })
      track('activity_started', { bikeType })
      setMessage(null)
    } catch (error) {
      console.error('[activity] start', error)
      setMessage('No se pudo iniciar la actividad.')
    }
  }

  function pause() {
    setStatus('paused')
    if (activity && user) {
      saveActivityCheckpoint({
        activityId: activity.id,
        userId: user.uid,
        title: activity.title,
        bikeType: activity.bikeType,
        routeId: activity.routeId,
        startedAt: activity.startedAt,
        status: 'paused',
        track: localTrack,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  function resume() {
    setStatus('recording')
  }

  async function finish() {
    if (!activity) return
    const finishedAt = new Date().toISOString()
    const stats = computeActivityStats(localTrack, activity.startedAt, finishedAt)
    try {
      await activityRepository.updateTrack(activity.id, localTrack, stats, 'finished', finishedAt)
      clearActivityCheckpoint(activity.id)
      setStatus('finished')
      track('activity_finished', { distance_m: stats.distanceMeters })
      // Like Strava: finish → already in PedalMap, open the analysis straight away.
      navigate(`/actividades/${activity.id}`, { replace: true })
    } catch (error) {
      console.error('[activity] finish', error)
      setMessage('No se pudo guardar la actividad. El track sigue en este dispositivo.')
    }
  }

  return (
    <div className="planner-shell flex flex-col overflow-hidden">
      <section className="relative min-h-[42vh] flex-1 bg-[var(--color-fog)]">
        <Suspense
          fallback={
            <p className="flex h-full items-center justify-center p-4 text-sm text-[var(--color-stone)]">
              Cargando mapa…
            </p>
          }
        >
          <MapView
            className="h-full w-full"
            waypoints={mapWaypoints}
            geometry={liveGeometry}
            showUserLocation={sample?.position}
            followUser={recording && Boolean(sample)}
            fitKey={
              recording
                ? undefined
                : `${liveGeometry?.coordinates.length ?? 0}-${plannedRoute?.title ?? 'act'}`
            }
          />
        </Suspense>
        {recording && (
          <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-semibold text-[var(--color-forest)] shadow">
            Grabando · pantalla activa
          </p>
        )}
      </section>

      <aside className="shrink-0 space-y-3 border-t border-[var(--color-fog)] bg-white p-4 safe-pb">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
            Actividad GPS
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-[var(--color-forest)]">
            {title}
          </h1>
          {plannedRoute?.geometry?.coordinates?.length ? (
            <p className="mt-1 text-xs text-[var(--color-stone)]">
              Referencia: {plannedRoute.title} · {plannedRoute.geometry.coordinates.length} pts
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat label="Distancia" value={formatDistance(liveStats.distanceMeters)} />
          <Stat
            label="En movimiento"
            value={formatDuration(liveStats.movingTimeSeconds ?? liveStats.durationSeconds)}
          />
          <Stat label="Desnivel +" value={formatElevation(liveStats.elevationGainMeters)} />
          <Stat
            label="Vel. media"
            value={
              liveStats.averageSpeedMetersPerSecond !== undefined
                ? formatSpeedKmh(liveStats.averageSpeedMetersPerSecond)
                : '—'
            }
          />
          <Stat
            label="Pot. est."
            value={
              liveStats.estimatedPowerWatts !== undefined || liveStats.averagePowerWatts !== undefined
                ? `${liveStats.estimatedPowerWatts ?? liveStats.averagePowerWatts} W`
                : '—'
            }
          />
          <Stat
            label="VAM"
            value={
              liveStats.vamMetersPerHour !== undefined ? `${liveStats.vamMetersPerHour} m/h` : '—'
            }
          />
        </div>

        <p className="text-sm text-[var(--color-stone)]">
          Puntos GPS: <strong className="text-[var(--color-forest)]">{localTrack.length}</strong>
        </p>

        {(geoError || message) && (
          <p className="rounded-xl bg-[var(--color-mist)] px-3 py-2 text-sm text-[var(--color-forest)]">
            {geoError || message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {status === 'idle' && <Button onClick={() => void start()}>Iniciar GPS</Button>}
          {status === 'recording' && (
            <>
              <Button variant="secondary" onClick={pause}>
                Pausar
              </Button>
              <Button onClick={() => void finish()}>Finalizar</Button>
            </>
          )}
          {status === 'paused' && (
            <>
              <Button onClick={resume}>Reanudar</Button>
              <Button onClick={() => void finish()}>Finalizar</Button>
            </>
          )}
          <Link to="/route-planner">
            <Button variant="ghost">Planificador</Button>
          </Link>
        </div>
      </aside>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--color-mist)]/60 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg font-bold text-[var(--color-forest)]">{value}</p>
    </div>
  )
}
