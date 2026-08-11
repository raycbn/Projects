import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { activityRepository } from '@/services/ActivityRepository'
import {
  gpsSyncService,
  type GpsProviderId,
  type GpsProviderStatus,
} from '@/services/GpsSyncService'
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
    description:
      'Historial GPS nativo + sync oficial (iGPSPORT, Wahoo, Garmin) con análisis Free.',
    path: '/actividades',
  })

  const { user, firebaseReady } = useAuth()
  const [params] = useSearchParams()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [providers, setProviders] = useState<GpsProviderStatus[]>([])
  const [busyProvider, setBusyProvider] = useState<GpsProviderId | null>(null)

  async function reload() {
    if (!user || user.isAnonymous || !activityRepository.isConfigured()) return
    const list = await activityRepository.listForUser(user.uid)
    setItems(list)
  }

  useEffect(() => {
    const flag = params.get('gps')
    const provider = params.get('provider')
    if (flag === 'connected') {
      setMessage(
        provider
          ? `${provider} conectado. Las nuevas salidas se cargarán solas en PedalMap.`
          : 'GPS conectado. Las nuevas salidas se cargarán solas en PedalMap.',
      )
    }
    if (flag === 'error') {
      setMessage(`No se pudo conectar el GPS (${params.get('reason') || 'error'}).`)
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
        if (gpsSyncService.isApiReady()) {
          const st = await gpsSyncService.status()
          if (!cancelled) setProviders(st)
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

  async function connect(provider: GpsProviderId) {
    setBusyProvider(provider)
    setMessage(null)
    try {
      const { url } = await gpsSyncService.startConnect(provider)
      window.location.assign(url)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo abrir la conexión GPS')
      setBusyProvider(null)
    }
  }

  async function disconnect(provider: GpsProviderId) {
    setBusyProvider(provider)
    try {
      await gpsSyncService.disconnect(provider)
      setProviders((prev) =>
        prev.map((p) => (p.id === provider ? { ...p, connected: false, externalUserId: null } : p)),
      )
      setMessage(`${provider} desconectado.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo desconectar')
    } finally {
      setBusyProvider(null)
    }
  }

  async function syncNow(provider: GpsProviderId) {
    setBusyProvider(provider)
    setMessage(null)
    try {
      const result = await gpsSyncService.sync(provider)
      await reload()
      setMessage(`Sync ${provider}: ${result.imported} nuevas · ${result.skipped} ya estaban.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sync falló')
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-28">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
            GPS
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
            Mis actividades
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-stone)]">
            Graba en PedalMap o conecta tu ciclocomputador: al terminar la salida se carga sola, con
            más análisis Free que el básico de terceros.
          </p>
        </div>
        <Link to="/actividad">
          <Button>Nueva actividad</Button>
        </Link>
      </div>

      <section
        id="wahoo"
        className="mt-6 scroll-mt-24 rounded-2xl bg-[var(--color-mist)]/50 p-4 ring-1 ring-[var(--color-fog)]"
      >
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
          Conectar tu GPS
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          Wahoo ya está listo: al terminar una salida en el ELEMNT / app Wahoo, PedalMap la recibe
          sola. iGPSPORT y Garmin llegarán cuando aprueben la API.
        </p>
        {!user || user.isAnonymous ? (
          <p className="mt-3 text-sm text-[var(--color-stone)]">
            <Link to="/login" className="font-semibold text-[var(--color-trail)]">
              Inicia sesión
            </Link>{' '}
            con una cuenta real para vincular Wahoo.
          </p>
        ) : (
          (() => {
            const list: GpsProviderStatus[] =
              providers.length > 0
                ? providers
                : [
                    {
                      id: 'wahoo',
                      label: 'Wahoo',
                      configured: true,
                      connected: false,
                      externalUserId: null,
                    },
                    {
                      id: 'igpsport',
                      label: 'iGPSPORT',
                      configured: false,
                      connected: false,
                      externalUserId: null,
                    },
                    {
                      id: 'garmin',
                      label: 'Garmin',
                      configured: false,
                      connected: false,
                      externalUserId: null,
                    },
                  ]
            const wahoo =
              list.find((p) => p.id === 'wahoo') ??
              ({
                id: 'wahoo' as const,
                label: 'Wahoo',
                configured: true,
                connected: false,
                externalUserId: null,
              } satisfies GpsProviderStatus)
            const others = list.filter((p) => p.id !== 'wahoo')

            return (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-[var(--color-forest)] px-4 py-4 text-white">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl font-bold">Wahoo</p>
                      <p className="mt-1 text-sm text-white/80">
                        {wahoo.connected
                          ? 'Conectado · las nuevas salidas se cargan solas'
                          : 'API oficial activa · conecta tu cuenta Wahoo'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {wahoo.connected ? (
                        <>
                          <Button
                            size="sm"
                            className="!bg-[var(--color-signal)] !text-[var(--color-ink)]"
                            disabled={busyProvider === 'wahoo'}
                            onClick={() => void syncNow('wahoo')}
                          >
                            Sincronizar ahora
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="!border-white/40 !text-white"
                            disabled={busyProvider === 'wahoo'}
                            onClick={() => void disconnect('wahoo')}
                          >
                            Quitar
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="!bg-[var(--color-signal)] !text-[var(--color-ink)]"
                          disabled={busyProvider === 'wahoo'}
                          onClick={() => void connect('wahoo')}
                        >
                          {busyProvider === 'wahoo' ? 'Abriendo…' : 'Conectar Wahoo'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <ul className="space-y-2">
                  {others.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/90 px-3 py-2 ring-1 ring-[var(--color-fog)]"
                    >
                      <div>
                        <p className="font-semibold text-[var(--color-forest)]">{p.label}</p>
                        <p className="text-xs text-[var(--color-stone)]">
                          {!p.configured
                            ? 'Próximamente (pendiente de API)'
                            : p.connected
                              ? 'Conectado · auto-upload activo'
                              : 'Listo para conectar'}
                        </p>
                      </div>
                      {p.configured && !p.connected && (
                        <Button
                          size="sm"
                          disabled={busyProvider === p.id}
                          onClick={() => void connect(p.id)}
                        >
                          Conectar
                        </Button>
                      )}
                      {p.configured && p.connected && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={busyProvider === p.id}
                            onClick={() => void syncNow(p.id)}
                          >
                            Sincronizar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyProvider === p.id}
                            onClick={() => void disconnect(p.id)}
                          >
                            Quitar
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()
        )}
      </section>

      {message && (
        <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]">
          {message}
        </p>
      )}

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
          </Link>{' '}
          o conecta tu GPS arriba.
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
                      {a.source && a.source !== 'gps' ? ` · ${a.source}` : ''}
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
                  {a.stats.estimatedPowerWatts !== undefined ||
                  a.stats.averagePowerWatts !== undefined
                    ? ` · ${a.stats.estimatedPowerWatts ?? a.stats.averagePowerWatts} W`
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
