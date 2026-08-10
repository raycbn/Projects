import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { activityRepository } from '@/services/ActivityRepository'
import { stravaService, type StravaActivitySummary } from '@/services/StravaService'
import type { Activity } from '@/domain/types'
import { formatDistance, formatDuration, formatElevation } from '@/lib/stats'

export function MyActivitiesPage() {
  usePageMeta({
    title: 'Mis actividades | PedalMap',
    description: 'Historial de salidas GPS y sync Strava (iGPSPORT, Garmin, etc.).',
    path: '/actividades',
  })

  const { user, firebaseReady } = useAuth()
  const [params] = useSearchParams()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [stravaConfigured, setStravaConfigured] = useState(false)
  const [stravaConnected, setStravaConnected] = useState(false)
  const [stravaBusy, setStravaBusy] = useState(false)
  const [stravaList, setStravaList] = useState<StravaActivitySummary[] | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)

  async function reloadLocal() {
    if (!user || user.isAnonymous || !activityRepository.isConfigured()) return
    const list = await activityRepository.listForUser(user.uid)
    setItems(list)
  }

  useEffect(() => {
    const flag = params.get('strava')
    if (flag === 'connected') setMessage('Strava conectado. Ya puedes importar salidas.')
    if (flag === 'error') {
      setMessage(`No se pudo conectar Strava (${params.get('reason') || 'error'}).`)
    }
  }, [params])

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
        if (stravaService.isApiReady()) {
          const st = await stravaService.status()
          if (!cancelled) {
            setStravaConfigured(st.configured)
            setStravaConnected(st.connected)
          }
        }
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

  async function connectStrava() {
    setStravaBusy(true)
    setMessage(null)
    try {
      const { url } = await stravaService.startConnect()
      window.location.assign(url)
    } catch (err) {
      console.error('[strava]', err)
      setMessage(err instanceof Error ? err.message : 'No se pudo abrir Strava OAuth')
      setStravaBusy(false)
    }
  }

  async function disconnectStrava() {
    setStravaBusy(true)
    try {
      await stravaService.disconnect()
      setStravaConnected(false)
      setStravaList(null)
      setMessage('Strava desconectado.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo desconectar')
    } finally {
      setStravaBusy(false)
    }
  }

  async function loadStravaList() {
    setStravaBusy(true)
    setMessage(null)
    try {
      const list = await stravaService.listRecent(20)
      setStravaList(list)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo listar Strava')
    } finally {
      setStravaBusy(false)
    }
  }

  async function importOne(row: StravaActivitySummary) {
    if (!user || user.isAnonymous) return
    setImportingId(row.id)
    setMessage(null)
    try {
      const payload = await stravaService.fetchImportPayload(row.id)
      const { activity, created } = await activityRepository.importFinished(user.uid, payload)
      await reloadLocal()
      setMessage(
        created
          ? `Importada: ${activity.title} (${activity.track.length} pts · FC/cadencia/potencia si venía en Strava).`
          : `Ya estaba importada: ${activity.title}`,
      )
    } catch (err) {
      console.error('[strava import]', err)
      setMessage(err instanceof Error ? err.message : 'Import falló')
    } finally {
      setImportingId(null)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-28">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
            GPS · Strava
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
            Mis actividades
          </h1>
        </div>
        <Link to="/actividad">
          <Button>Nueva actividad</Button>
        </Link>
      </div>

      <section className="mt-6 rounded-2xl bg-[var(--color-mist)]/50 p-4 ring-1 ring-[var(--color-fog)]">
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
          Puente gratis vía Strava
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          iGPSPORT / Garmin / Wahoo → app → Strava → PedalMap (OAuth). Importamos GPS, altitud, FC,
          cadencia, potencia y velocidad cuando Strava los tiene.
        </p>
        {!user || user.isAnonymous ? (
          <p className="mt-3 text-sm text-[var(--color-stone)]">
            <Link to="/login" className="font-semibold text-[var(--color-trail)]">
              Inicia sesión
            </Link>{' '}
            (cuenta real, no anónimo) para conectar Strava.
          </p>
        ) : !stravaConfigured ? (
          <p className="mt-3 text-sm text-[var(--color-stone)]">
            Strava aún no está configurado en el Worker (
            <code className="text-xs">STRAVA_CLIENT_ID</code> /{' '}
            <code className="text-xs">STRAVA_CLIENT_SECRET</code>).
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {!stravaConnected ? (
              <Button disabled={stravaBusy} onClick={() => void connectStrava()}>
                Conectar Strava
              </Button>
            ) : (
              <>
                <Button disabled={stravaBusy} onClick={() => void loadStravaList()}>
                  Ver salidas Strava
                </Button>
                <Button variant="ghost" disabled={stravaBusy} onClick={() => void disconnectStrava()}>
                  Desconectar
                </Button>
              </>
            )}
          </div>
        )}
      </section>

      {message && (
        <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]">
          {message}
        </p>
      )}

      {stravaList && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
            Recientes en Strava
          </h2>
          <ul className="mt-3 space-y-2">
            {stravaList.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-[var(--color-fog)]"
              >
                <div>
                  <p className="font-semibold text-[var(--color-forest)]">{row.name}</p>
                  <p className="text-xs text-[var(--color-stone)]">
                    {new Date(row.startedAt).toLocaleString('es-ES')} · {row.type} ·{' '}
                    {formatDistance(row.distanceMeters)}
                    {row.averageHeartRateBpm ? ` · FC ${Math.round(row.averageHeartRateBpm)}` : ''}
                    {row.averagePowerWatts ? ` · ${Math.round(row.averagePowerWatts)} W` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={importingId === row.id}
                  onClick={() => void importOne(row)}
                >
                  {importingId === row.id ? 'Importando…' : 'Importar'}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          Aún no hay actividades. Graba con GPS o importa desde Strava.
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
                    {a.source === 'strava' ? ' · Strava' : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[var(--color-forest)]">
                  {formatDistance(a.stats.distanceMeters)}
                </p>
              </div>
              <p className="mt-2 text-sm text-[var(--color-stone)]">
                {formatDuration(a.stats.durationSeconds)} ·{' '}
                {formatElevation(a.stats.elevationGainMeters)} desnivel +
                {a.stats.averageHeartRateBpm
                  ? ` · FC ${a.stats.averageHeartRateBpm}`
                  : ''}
                {a.stats.averagePowerWatts ? ` · ${a.stats.averagePowerWatts} W` : ''}
                {a.stats.averageCadenceRpm ? ` · ${a.stats.averageCadenceRpm} rpm` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
