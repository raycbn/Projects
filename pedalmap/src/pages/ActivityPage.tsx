import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { useGeolocation } from '@/hooks/useGeolocation'
import { usePageMeta } from '@/hooks/usePageMeta'
import {
  activityRepository,
  computeActivityStats,
} from '@/services/ActivityRepository'
import type { Activity, ActivityTrackPoint, BikeType } from '@/domain/types'
import { formatDistance, formatDuration, formatElevation } from '@/lib/stats'
import { track } from '@/lib/analytics'
import { takeGpsRoute, type GpsRoutePacket } from '@/lib/gpsRouteHandoff'
import {
  clearActivityCheckpoint,
  loadLatestActivityCheckpoint,
  saveActivityCheckpoint,
} from '@/lib/activityCheckpoint'

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

  useEffect(() => {
    setPlannedRoute(takeGpsRoute())
  }, [])

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
      setMessage('Actividad guardada.')
    } catch (error) {
      console.error('[activity] finish', error)
      setMessage('No se pudo guardar la actividad. El track sigue en este dispositivo.')
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8 pb-28">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
        Fase 5 · GPS
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
        Grabar actividad
      </h1>
      <p className="mt-2 text-sm text-[var(--color-stone)]">
        Usa el GPS del dispositivo para registrar distancia y desnivel positivo de tu salida. Si
        cierras la pestaña, intentamos recuperar la salida al volver.
      </p>
      {plannedRoute?.geometry?.coordinates?.length ? (
        <p className="mt-2 rounded-xl bg-[var(--color-mist)] px-3 py-2 text-xs text-[var(--color-forest)]">
          Ruta planificada lista: <strong>{plannedRoute.title}</strong> ·{' '}
          {plannedRoute.geometry.coordinates.length} puntos de referencia en el track.
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Distancia" value={formatDistance(liveStats.distanceMeters)} />
        <Stat label="Tiempo" value={formatDuration(liveStats.durationSeconds)} />
        <Stat label="Desnivel +" value={formatElevation(liveStats.elevationGainMeters)} />
      </div>

      <p className="mt-4 text-sm text-[var(--color-stone)]">
        Puntos GPS: <strong className="text-[var(--color-forest)]">{localTrack.length}</strong>
        {sample && (
          <>
            {' '}
            · Última posición {sample.position.lat.toFixed(5)}, {sample.position.lng.toFixed(5)}
          </>
        )}
      </p>

      {(geoError || message) && (
        <p className="mt-3 rounded-xl bg-[var(--color-mist)] px-3 py-2 text-sm text-[var(--color-forest)]">
          {geoError || message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
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
          <Button variant="ghost">Volver al planificador</Button>
        </Link>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-3 ring-1 ring-[var(--color-fog)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold text-[var(--color-forest)]">{value}</p>
    </div>
  )
}
