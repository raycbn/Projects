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
import { formatDistance, formatDuration, formatElevation, haversineMeters } from '@/lib/stats'
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

/** Ignore phone GPS jitter: require real movement (or first fix). */
const GPS_MAX_ACCURACY_M = 80
const GPS_MIN_MOVE_M = 4

function shouldAcceptGpsSample(
  prev: ActivityTrackPoint[],
  sample: { position: { lat: number; lng: number }; accuracyMeters?: number },
): boolean {
  if (prev.length === 0) return true
  if (sample.accuracyMeters != null && sample.accuracyMeters > GPS_MAX_ACCURACY_M) {
    return false
  }
  const last = prev[prev.length - 1]
  const moved = haversineMeters(last.position, sample.position)
  const minMove = Math.max(
    GPS_MIN_MOVE_M,
    sample.accuracyMeters != null ? sample.accuracyMeters * 0.35 : GPS_MIN_MOVE_M,
  )
  return moved >= minMove
}

export function ActivityPage() {
  usePageMeta({
    title: 'Actividad GPS | PedalMap',
    description: 'Graba tu salida en bici con GPS y guarda la actividad en PedalMap.',
    path: '/actividad',
    noindex: true,
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
  const pausedTotalMs = useRef(0)
  const pauseStartedAtMs = useRef<number | null>(null)
  const [clockMs, setClockMs] = useState(() => Date.now())

  useEffect(() => {
    setPlannedRoute(takeGpsRoute())
  }, [])

  // Live clock while recording so Tiempo updates every second (not only on GPS ticks).
  useEffect(() => {
    if (status !== 'recording') return
    const id = window.setInterval(() => setClockMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [status])

  useEffect(() => {
    trackRef.current = localTrack
  }, [localTrack])
  useEffect(() => {
    activityRef.current = activity
  }, [activity])

  const liveDurationSeconds = useMemo(() => {
    if (!activity) return 0
    if (status === 'finished') {
      return activity.stats?.durationSeconds ?? 0
    }
    const startMs = Date.parse(activity.startedAt)
    let paused = pausedTotalMs.current
    if (status === 'paused' && pauseStartedAtMs.current != null) {
      paused += Date.now() - pauseStartedAtMs.current
    }
    const endMs =
      status === 'paused' && pauseStartedAtMs.current != null
        ? pauseStartedAtMs.current
        : clockMs
    return Math.max(0, Math.round((endMs - startMs - paused) / 1000))
  }, [activity, status, clockMs])

  const liveStats = useMemo(() => {
    if (!activity) {
      return {
        distanceMeters: 0,
        durationSeconds: 0,
        elevationGainMeters: 0,
      }
    }
    return computeActivityStats(localTrack, activity.startedAt, undefined, {
      durationSeconds: liveDurationSeconds,
      elevationThresholdMeters: 3,
    })
  }, [localTrack, activity, liveDurationSeconds])

  // Restore unfinished ride from local checkpoint (survives tab close).
  useEffect(() => {
    if (!user || user.isAnonymous || status !== 'idle') return
    const ckpt = loadLatestActivityCheckpoint()
    if (!ckpt || ckpt.userId !== user.uid) return
    if (ckpt.status !== 'recording' && ckpt.status !== 'paused') return
    pausedTotalMs.current = ckpt.pausedMs ?? 0
    pauseStartedAtMs.current = ckpt.status === 'paused' ? Date.now() : null
    setClockMs(Date.now())
    setActivity({
      id: ckpt.activityId,
      userId: ckpt.userId,
      routeId: ckpt.routeId,
      title: ckpt.title,
      status: ckpt.status,
      bikeType: ckpt.bikeType,
      startedAt: ckpt.startedAt,
      track: ckpt.track,
      stats: computeActivityStats(ckpt.track, ckpt.startedAt, undefined, {
        durationSeconds: Math.max(
          0,
          Math.round(
            (Date.now() - Date.parse(ckpt.startedAt) - (ckpt.pausedMs ?? 0)) / 1000,
          ),
        ),
        elevationThresholdMeters: 3,
      }),
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
      let paused = pausedTotalMs.current
      if (status === 'paused' && pauseStartedAtMs.current != null) {
        paused += Date.now() - pauseStartedAtMs.current
      }
      const durationSeconds = Math.max(
        0,
        Math.round((Date.now() - Date.parse(act.startedAt) - paused) / 1000),
      )
      const stats = computeActivityStats(trackPts, act.startedAt, undefined, {
        durationSeconds,
        elevationThresholdMeters: 3,
      })
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
        pausedMs: paused,
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
      if (!shouldAcceptGpsSample(prev, sample)) {
        return prev
      }
      const next = [
        ...prev,
        {
          position: sample.position,
          elevationMeters: sample.elevationMeters,
          accuracyMeters: sample.accuracyMeters,
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
        pausedMs: pausedTotalMs.current,
        updatedAt: new Date().toISOString(),
      })
      const now = Date.now()
      if (next.length - lastFlushLen.current >= 25 || now - lastFlushAt.current > 45_000) {
        lastFlushAt.current = now
        lastFlushLen.current = next.length
        const durationSeconds = Math.max(
          0,
          Math.round((now - Date.parse(activity.startedAt) - pausedTotalMs.current) / 1000),
        )
        const stats = computeActivityStats(next, activity.startedAt, undefined, {
          durationSeconds,
          elevationThresholdMeters: 3,
        })
        void activityRepository
          .updateTrack(activity.id, next, stats, 'recording')
          .catch((err) => console.warn('[activity] checkpoint flush', err))
      }
      return next
    })
  }, [sample, recording, activity, user])

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
      // Ask for location up front so Android/iOS show the permission prompt
      // before we create the Firestore activity.
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
        )
      })
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? Number(err.code) : 0
      if (code === 1) {
        setMessage('Activa el permiso de ubicación para PedalMap en el navegador.')
      } else if (code === 2) {
        setMessage('No hay señal GPS. Sal al exterior o activa la ubicación del teléfono.')
      } else if (code === 3) {
        setMessage('Tiempo agotado buscando GPS. Inténtalo otra vez al aire libre.')
      } else {
        setMessage('No se pudo obtener la ubicación. Revisa el permiso de ubicación.')
      }
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
      pausedTotalMs.current = 0
      pauseStartedAtMs.current = null
      setClockMs(Date.now())
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
        pausedMs: 0,
        updatedAt: new Date().toISOString(),
      })
      track('activity_started', { bikeType })
      setMessage(null)
    } catch (error) {
      console.error('[activity] start', error)
      const raw = error instanceof Error ? error.message : String(error)
      if (/permission|insufficient|PERMISSION_DENIED/i.test(raw)) {
        setMessage('Sin permiso para guardar la actividad en la nube. Vuelve a iniciar sesión.')
      } else if (/undefined|Unsupported field value/i.test(raw)) {
        setMessage('Error al crear la actividad (datos inválidos). Prueba de nuevo.')
      } else {
        setMessage('No se pudo iniciar la actividad. Comprueba la conexión e inténtalo otra vez.')
      }
    }
  }

  function pause() {
    const now = Date.now()
    pauseStartedAtMs.current = now
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
        pausedMs: pausedTotalMs.current,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  function resume() {
    if (pauseStartedAtMs.current != null) {
      pausedTotalMs.current += Date.now() - pauseStartedAtMs.current
      pauseStartedAtMs.current = null
    }
    setClockMs(Date.now())
    setStatus('recording')
  }

  async function finish() {
    if (!activity) return
    const finishedAt = new Date().toISOString()
    let paused = pausedTotalMs.current
    if (status === 'paused' && pauseStartedAtMs.current != null) {
      paused += Date.now() - pauseStartedAtMs.current
    }
    const durationSeconds = Math.max(
      0,
      Math.round((Date.parse(finishedAt) - Date.parse(activity.startedAt) - paused) / 1000),
    )
    const stats = computeActivityStats(localTrack, activity.startedAt, finishedAt, {
      durationSeconds,
      elevationThresholdMeters: 3,
    })
    try {
      await activityRepository.updateTrack(activity.id, localTrack, stats, 'finished', finishedAt)
      clearActivityCheckpoint(activity.id)
      setActivity({ ...activity, finishedAt, stats, status: 'finished' })
      setStatus('finished')
      track('activity_finished', { distance_m: stats.distanceMeters })
      setMessage('Actividad guardada.')
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

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Distancia" value={formatDistance(liveStats.distanceMeters)} />
          <Stat
            label="Tiempo"
            value={
              status === 'recording' || status === 'paused'
                ? formatDuration(liveStats.durationSeconds, 'live')
                : formatDuration(liveStats.durationSeconds)
            }
          />
          <Stat label="Desnivel +" value={formatElevation(liveStats.elevationGainMeters)} />
        </div>

        <p className="text-sm text-[var(--color-stone)]">
          Puntos GPS: <strong className="text-[var(--color-forest)]">{localTrack.length}</strong>
          {status === 'recording' && localTrack.length < 2 ? (
            <span className="mt-1 block text-xs">
              Con 1 punto la distancia y el desnivel son 0. Muévete unos metros para que sumen.
            </span>
          ) : null}
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
          {status === 'finished' && (
            <Button onClick={() => navigate('/actividades')}>Ver mis actividades</Button>
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
