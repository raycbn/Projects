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
import { stravaService } from '@/services/StravaService'
import type { Activity, ActivityTrackPoint } from '@/domain/types'
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatSpeedKmh,
} from '@/lib/stats'
import { parseGpx } from '@/lib/gpx'
import { track } from '@/lib/analytics'

export function MyActivitiesPage() {
  usePageMeta({
    title: 'Mis actividades | PedalMap',
    description:
      'Historial GPS nativo + sync de ciclocomputador con análisis Free en PedalMap.',
    path: '/actividades',
    noindex: true,
  })

  const { user, firebaseReady, loading: authLoading } = useAuth()
  const [params] = useSearchParams()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [providers, setProviders] = useState<GpsProviderStatus[]>([])
  const [gpsStatusLoading, setGpsStatusLoading] = useState(false)
  const [busyProvider, setBusyProvider] = useState<GpsProviderId | null>(null)
  const [cloudConfigured, setCloudConfigured] = useState(false)
  const [cloudConnected, setCloudConnected] = useState(false)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)

  async function reload() {
    if (!user || user.isAnonymous || !activityRepository.isConfigured()) return
    const list = await activityRepository.listForUser(user.uid)
    setItems(list)
  }

  async function refreshCloudStatus() {
    if (!stravaService.isApiReady()) {
      setCloudConfigured(false)
      setCloudConnected(false)
      return
    }
    try {
      const st = await stravaService.status()
      setCloudConfigured(st.configured)
      setCloudConnected(st.connected)
    } catch (err) {
      console.warn('[activities] cloud status', err)
    }
  }

  async function pullCloudRides(announce = true) {
    if (!user || user.isAnonymous) return
    setCloudBusy(true)
    if (announce) setMessage('Trayendo salidas a PedalMap…')
    try {
      const result = await stravaService.syncRecentToPedalMap(user.uid, (uid, input) =>
        activityRepository.importFinished(uid, input),
      )
      await reload()
      setMessage(
        result.imported > 0
          ? `${result.imported} salidas nuevas en PedalMap` +
              (result.skipped ? ` · ${result.skipped} ya estaban o no eran de bici` : '') +
              '. Ábrelas aquí abajo.'
          : result.skipped
            ? 'No había salidas nuevas de bici que importar. Cuando termines la próxima, pulsa «Traer salidas».'
            : 'No se encontraron salidas recientes. Termina una ruta en tu GPS y vuelve a sincronizar.',
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudieron traer las salidas')
    } finally {
      setCloudBusy(false)
    }
  }

  useEffect(() => {
    const gpsFlag = params.get('gps')
    const provider = params.get('provider')
    if (gpsFlag === 'connected') {
      setMessage(
        provider === 'wahoo'
          ? 'Wahoo conectado. Trayendo tus salidas a PedalMap…'
          : provider
            ? `${provider} conectado. Las nuevas salidas se cargarán solas en PedalMap.`
            : 'GPS conectado. Las nuevas salidas se cargarán solas en PedalMap.',
      )
    }
    if (gpsFlag === 'error') {
      setMessage(`No se pudo conectar el GPS (${params.get('reason') || 'error'}).`)
    }

    const stravaFlag = params.get('strava')
    if (stravaFlag === 'connected') {
      setCloudConnected(true)
      setMessage('Sincronización activa. Trayendo tus salidas a PedalMap…')
    }
    if (stravaFlag === 'error') {
      const reason = params.get('reason') || 'error'
      const messages: Record<string, string> = {
        missing_activity_scope:
          'Hay que autorizar también «Ver tus actividades» en Strava. Vuelve a activar la sincronización y marca ese permiso.',
        app_inactive_subscription:
          'Strava bloquea la API: la cuenta que creó la app PedalMap necesita Strava Premium (Standard Tier es de pago desde julio 2026).',
        forbidden_probe:
          'Strava rechazó el acceso tras autorizar. Si tu API es Standard Tier, activa Premium en la cuenta desarrolladora y reintenta.',
      }
      setMessage(messages[reason] || `No se pudo activar la sincronización (${reason}).`)
    }
  }, [params])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (authLoading) return
      if (!user || user.isAnonymous || !firebaseReady || !activityRepository.isConfigured()) {
        setLoading(false)
        return
      }
      // Keep GPS / cloud status independent of the activities query so a missing
      // Firestore index never hides the sync button.
      void (async () => {
        try {
          if (gpsSyncService.isApiReady()) {
            setGpsStatusLoading(true)
            const st = await gpsSyncService.status()
            if (!cancelled) setProviders(st)
          }
        } catch (err) {
          console.warn('[activities] gps status', err)
          // Keep Wahoo connectable even if status fails — oauth/start is the source of truth.
          if (!cancelled) {
            setProviders((prev) =>
              prev.length
                ? prev
                : [
                    {
                      id: 'wahoo',
                      label: 'Wahoo',
                      configured: true,
                      connected: false,
                      externalUserId: null,
                    },
                  ],
            )
          }
        } finally {
          if (!cancelled) setGpsStatusLoading(false)
        }
        if (!cancelled) await refreshCloudStatus()
        if (!cancelled && params.get('strava') === 'connected') {
          await pullCloudRides(false)
        }
        // After Wahoo OAuth, pull recent workouts once (webhooks cover future rides).
        if (
          !cancelled &&
          params.get('gps') === 'connected' &&
          params.get('provider') === 'wahoo' &&
          gpsSyncService.isApiReady()
        ) {
          try {
            const result = await gpsSyncService.sync('wahoo')
            if (!cancelled) {
              await reload()
              setMessage(
                result.imported > 0
                  ? `Wahoo listo · ${result.imported} salidas nuevas en PedalMap.`
                  : 'Wahoo listo. No había salidas nuevas; las próximas llegarán solas.',
              )
              const st = await gpsSyncService.status()
              if (!cancelled) setProviders(st)
            }
          } catch (err) {
            console.warn('[activities] wahoo auto-sync', err)
            if (!cancelled) {
              setMessage(
                err instanceof Error
                  ? `Wahoo conectado, pero el sync falló: ${err.message}`
                  : 'Wahoo conectado, pero el sync falló. Prueba «Traer salidas».',
              )
            }
          }
        }
      })()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot load + oauth return
  }, [user, firebaseReady, authLoading])

  async function connect(provider: GpsProviderId) {
    setBusyProvider(provider)
    setMessage(null)
    try {
      if (!gpsSyncService.isApiReady()) {
        throw new Error('Falta la API de PedalMap. Recarga la página o vuelve a entrar.')
      }
      const { url } = await gpsSyncService.startConnect(provider)
      // Full navigation (more reliable on mobile than assign after await).
      window.location.href = url
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

  async function connectCloudBridge() {
    setCloudBusy(true)
    setMessage(
      'Abriendo autorización… en unos segundos vuelves a PedalMap y las salidas se importan aquí.',
    )
    try {
      const { url } = await stravaService.startConnect()
      // Brief OAuth hop only — callback always returns to /actividades?strava=connected.
      window.location.assign(url)
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'No se pudo activar la sincronización con la nube del GPS.',
      )
      setCloudBusy(false)
    }
  }

  async function disconnectCloudBridge() {
    setCloudBusy(true)
    try {
      await stravaService.disconnect()
      setCloudConnected(false)
      setMessage('Sincronización desactivada. Tus actividades en PedalMap se quedan.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo desactivar')
    } finally {
      setCloudBusy(false)
    }
  }

  async function importGpxFile(file: File) {
    if (!user || user.isAnonymous) {
      setMessage('Inicia sesión para importar actividades.')
      return
    }
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.fit')) {
      setMessage(
        'FIT: exporta a GPX desde Garmin Connect / Wahoo y súbelo aquí. PedalMap importa GPX nativo.',
      )
      return
    }
    setImportBusy(true)
    setMessage(null)
    try {
      const text = await file.text()
      const imported = parseGpx(text)
      const trackPoints: ActivityTrackPoint[] = imported.points.map((p) => ({
        position: { lat: p.lat, lng: p.lng },
        elevationMeters: p.elevationMeters,
        recordedAt: p.time || new Date().toISOString(),
      }))
      const startedAt = trackPoints[0]?.recordedAt || new Date().toISOString()
      const finishedAt =
        trackPoints[trackPoints.length - 1]?.recordedAt || new Date().toISOString()
      const { activity, created } = await activityRepository.importFinished(user.uid, {
        title: imported.name || file.name.replace(/\.[^.]+$/, ''),
        status: 'finished',
        bikeType: 'road',
        source: 'gpx',
        externalId: `gpx:${file.name}:${Math.round(imported.distanceMeters)}`,
        startedAt,
        finishedAt,
        track: trackPoints,
        stats: {
          distanceMeters: Math.round(imported.distanceMeters),
          durationSeconds: Math.max(
            0,
            Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000),
          ),
          elevationGainMeters: 0,
        },
      })
      await reload()
      setMessage(
        created
          ? `Importada «${activity.title}» · ábrela abajo`
          : `«${activity.title}» ya estaba importada`,
      )
      track('gpx_imported', { distance_m: activity.stats.distanceMeters })
    } catch (err) {
      console.error('[activities] import', err)
      setMessage(err instanceof Error ? err.message : 'No se pudo importar el GPX')
    } finally {
      setImportBusy(false)
    }
  }

  const list: GpsProviderStatus[] =
    providers.length > 0
      ? providers
      : [
          {
            id: 'wahoo',
            label: 'Wahoo',
            // Optimistic: secrets are live; status confirms when it arrives.
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
            Graba en PedalMap o trae salidas de tu ciclocomputador. El análisis Free se queda aquí.
          </p>
        </div>
        <Link to="/actividad">
          <Button>Nueva actividad</Button>
        </Link>
      </div>

      <section
        id="importar"
        className="mt-6 scroll-mt-24 rounded-2xl bg-white/90 p-4 ring-1 ring-[var(--color-fog)]"
      >
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
          Importar GPX / FIT
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          Sube un track terminado. GPX se importa directo; FIT conviene convertirlo a GPX en Garmin
          Connect o Wahoo.
        </p>
        {user && !user.isAnonymous ? (
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2">
            <span className="rounded-xl bg-[var(--color-signal)] px-3 py-2 text-sm font-semibold text-[var(--color-ink)]">
              {importBusy ? 'Importando…' : 'Elegir archivo'}
            </span>
            <input
              type="file"
              accept=".gpx,.fit,application/gpx+xml"
              className="sr-only"
              disabled={importBusy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void importGpxFile(file)
              }}
            />
          </label>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-stone)]">
            <Link to="/login" className="font-semibold text-[var(--color-trail)]">
              Inicia sesión
            </Link>{' '}
            para importar.
          </p>
        )}
      </section>

      <section
        id="wahoo"
        className="mt-6 scroll-mt-24 rounded-2xl bg-[var(--color-mist)]/50 p-4 ring-1 ring-[var(--color-fog)]"
      >
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
          Conectar tu GPS
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          Wahoo tiene API oficial. El resto de marcas puede llegar vía sincronización a PedalMap
          (abajo).
        </p>
        {authLoading ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">Comprobando sesión…</p>
      ) : !user || user.isAnonymous ? (
          <p className="mt-3 text-sm text-[var(--color-stone)]">
            <Link to="/login" className="font-semibold text-[var(--color-trail)]">
              Inicia sesión
            </Link>{' '}
            con una cuenta real para vincular el GPS.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-[var(--color-forest)] px-4 py-4 text-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-bold">Wahoo</p>
                  <p className="mt-1 text-sm text-white/80">
                    {gpsStatusLoading
                      ? 'Comprobando conexión…'
                      : wahoo.connected
                        ? 'Conectado · las nuevas salidas se cargan solas'
                        : 'API oficial · conecta y olvídate de exportar a mano'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {wahoo.connected ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="!bg-[var(--color-signal)] !text-[var(--color-ink)]"
                        disabled={busyProvider === 'wahoo'}
                        onClick={() => void syncNow('wahoo')}
                      >
                        Sincronizar ahora
                      </Button>
                      <Button
                        type="button"
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
                      type="button"
                      size="sm"
                      className="!bg-[var(--color-signal)] !text-[var(--color-ink)]"
                      disabled={busyProvider === 'wahoo' || gpsStatusLoading}
                      onClick={() => void connect('wahoo')}
                    >
                      {busyProvider === 'wahoo' ? 'Abriendo Wahoo…' : 'Conectar Wahoo'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {message ? (
          <p className="mt-3 rounded-xl bg-white/90 px-3 py-2 text-sm text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]">
            {message}
          </p>
        ) : null}
      </section>

      <section
        id="gps-cloud"
        className="mt-4 scroll-mt-24 rounded-2xl bg-white/90 p-4 ring-1 ring-[var(--color-fog)]"
      >
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
          iGPSPORT, Garmin y otros GPS
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          Si tu ciclocomputador ya sube la salida a la nube, PedalMap puede{' '}
          <strong className="font-semibold text-[var(--color-forest)]">traerla aquí</strong> y
          mostrarte el análisis Free (tiempo en movimiento, VAM, potencia estimada, splits…). Tú
          sigues en PedalMap: planificar, guardar y revisar — sin quedarte en otra app.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--color-stone)]">
          <li>iGPSPORT, Garmin, Magene, Bryton y la mayoría que ya sincronizan a la nube</li>
          <li>Tras autorizar, vuelves siempre a esta pantalla</li>
          <li>Las salidas aparecen abajo, en Mis actividades</li>
        </ul>

        {!user || user.isAnonymous ? (
          <p className="mt-3 text-sm text-[var(--color-stone)]">
            <Link to="/login" className="font-semibold text-[var(--color-trail)]">
              Inicia sesión
            </Link>{' '}
            para activar la sincronización.
          </p>
        ) : !cloudConfigured ? (
          <p className="mt-4 rounded-xl bg-[var(--color-mist)] px-3 py-2 text-sm text-[var(--color-stone)]">
            La sincronización en nube aún no está activa en el servidor. Cuando el dueño de PedalMap
            termine de configurar las claves, aquí aparecerá el botón.
          </p>
        ) : !cloudConnected ? (
          <div className="mt-4 space-y-2">
            <Button disabled={cloudBusy} onClick={() => void connectCloudBridge()}>
              {cloudBusy ? 'Abriendo…' : 'Activar sincronización → PedalMap'}
            </Button>
            <p className="text-xs text-[var(--color-stone)]">
              Autorizas un momento la nube compatible de tu GPS y{' '}
              <strong className="font-semibold text-[var(--color-forest)]">vuelves siempre a PedalMap</strong>
              . No te quedas en otra app: el destino de las salidas eres tú, aquí.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--color-forest)]">
              Sincronización activa · destino: PedalMap
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={cloudBusy} onClick={() => void pullCloudRides(true)}>
                {cloudBusy ? 'Importando…' : 'Traer salidas a PedalMap'}
              </Button>
              <Button variant="ghost" disabled={cloudBusy} onClick={() => void disconnectCloudBridge()}>
                Desactivar sync
              </Button>
            </div>
            <p className="text-xs text-[var(--color-stone)]">
              Flujo habitual: termina la salida en tu GPS → deja que suba a la nube → pulsa «Traer
              salidas» (o vuelve aquí) y revisa el análisis en PedalMap. Si ves un error de permisos,
              desactiva y vuelve a activar la sync aceptando ver actividades.
            </p>
          </div>
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
          o activa la sincronización arriba.
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
                      {a.source === 'strava' ? ' · importada' : a.source && a.source !== 'gps' ? ` · ${a.source}` : ''}
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
