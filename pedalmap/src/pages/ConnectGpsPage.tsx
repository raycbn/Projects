import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import {
  gpsSyncService,
  type GpsProviderId,
  type GpsProviderStatus,
} from '@/services/GpsSyncService'
import { stravaService } from '@/services/StravaService'

/**
 * Single-purpose screen: how to get rides into PedalMap.
 * Wires official Wahoo OAuth when Worker secrets exist.
 */
export function ConnectGpsPage() {
  usePageMeta({
    title: 'Conectar GPS | PedalMap',
    description: 'Graba en el móvil o trae salidas desde tu ciclocomputador a PedalMap.',
    path: '/actividades/conectar',
    noindex: true,
  })

  const { user } = useAuth()
  const [providers, setProviders] = useState<GpsProviderStatus[]>([])
  const [busy, setBusy] = useState<GpsProviderId | 'cloud' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [cloudConnected, setCloudConnected] = useState(false)
  const [cloudConfigured, setCloudConfigured] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user || user.isAnonymous) return
      try {
        if (gpsSyncService.isApiReady()) {
          const st = await gpsSyncService.status()
          if (!cancelled) setProviders(st)
        }
        if (stravaService.isApiReady()) {
          const st = await stravaService.status()
          if (!cancelled) {
            setCloudConfigured(st.configured)
            setCloudConnected(st.connected)
          }
        }
      } catch (err) {
        console.warn('[connect-gps]', err)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  const wahoo =
    providers.find((p) => p.id === 'wahoo') ??
    ({
      id: 'wahoo' as const,
      label: 'Wahoo',
      configured: true,
      connected: false,
      externalUserId: null,
    } satisfies GpsProviderStatus)

  async function connect(provider: GpsProviderId) {
    setBusy(provider)
    setMessage(null)
    try {
      if (!gpsSyncService.isApiReady()) {
        throw new Error('Falta la API de PedalMap. Recarga la página.')
      }
      const { url } = await gpsSyncService.startConnect(provider)
      window.location.href = url
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo abrir la conexión')
      setBusy(null)
    }
  }

  async function disconnect(provider: GpsProviderId) {
    setBusy(provider)
    try {
      await gpsSyncService.disconnect(provider)
      setProviders((prev) =>
        prev.map((p) => (p.id === provider ? { ...p, connected: false, externalUserId: null } : p)),
      )
      setMessage(`${provider} desconectado.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo desconectar')
    } finally {
      setBusy(null)
    }
  }

  async function sync(provider: GpsProviderId) {
    setBusy(provider)
    try {
      const result = await gpsSyncService.sync(provider)
      setMessage(`Sync: ${result.imported} nuevas · ${result.skipped} ya estaban.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sync falló')
    } finally {
      setBusy(null)
    }
  }

  async function connectCloud() {
    setBusy('cloud')
    try {
      const { url } = await stravaService.startConnect()
      window.location.assign(url)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo activar el puente')
      setBusy(null)
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 pb-28">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
        Actividades
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
        Conectar GPS
      </h1>
      <p className="mt-2 text-[var(--color-stone)]">
        Graba en el móvil, conecta Wahoo o importa un GPX. El análisis Free se queda en PedalMap.
      </p>

      {!user || user.isAnonymous ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">
          <Link to="/login" className="font-semibold text-[var(--color-trail)]">
            Inicia sesión
          </Link>{' '}
          para sincronizar salidas en la nube.
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-xl bg-[var(--color-mist)] px-3 py-2 text-sm text-[var(--color-forest)]">
          {message}
        </p>
      ) : null}

      <ul className="mt-8 space-y-4">
        <li className="rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
          <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
            GPS del móvil
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            Graba la salida en PedalMap con la pantalla activa. Ideal sin ciclocomputador.
          </p>
          <Link to="/actividad" className="mt-4 inline-block">
            <Button>Iniciar grabación</Button>
          </Link>
        </li>

        <li className="rounded-3xl bg-[var(--color-forest)] p-5 text-white">
          <h2 className="font-display text-xl font-bold">Wahoo</h2>
          <p className="mt-1 text-sm text-white/80">
            {wahoo.connected
              ? 'Conectado · las nuevas salidas se cargan solas'
              : 'API oficial. Autoriza una vez y sincroniza salidas a PedalMap.'}
          </p>
          {user && !user.isAnonymous ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {wahoo.connected ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy === 'wahoo'}
                    onClick={() => void sync('wahoo')}
                  >
                    {busy === 'wahoo' ? 'Sincronizando…' : 'Traer salidas'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy === 'wahoo'}
                    onClick={() => void disconnect('wahoo')}
                  >
                    Desconectar
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  disabled={busy === 'wahoo'}
                  onClick={() => void connect('wahoo')}
                >
                  {busy === 'wahoo' ? 'Abriendo Wahoo…' : 'Conectar Wahoo'}
                </Button>
              )}
            </div>
          ) : null}
        </li>

        <li className="rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
          <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
            Importar GPX / FIT
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            Sube un archivo desde Mis actividades. GPX nativo; FIT conviene exportarlo a GPX desde
            Garmin Connect o Wahoo.
          </p>
          <Link to="/actividades#importar" className="mt-4 inline-block">
            <Button variant="secondary">Ir a importar</Button>
          </Link>
        </li>

        <li className="rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
          <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
            Otras marcas (Garmin / iGPSPORT)
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {cloudConfigured
              ? cloudConnected
                ? 'Puente activo: trae salidas a PedalMap.'
                : 'Puedes activar el puente técnico para traer salidas cuando la API de la marca no esté lista.'
              : 'Cuando las credenciales de marca estén en el Worker, aparecerán aquí. Mientras tanto, GPX o grabación nativa.'}
          </p>
          {user && !user.isAnonymous && cloudConfigured ? (
            <div className="mt-4">
              {cloudConnected ? (
                <p className="text-sm font-semibold text-[var(--color-trail)]">Puente conectado</p>
              ) : (
                <Button disabled={busy === 'cloud'} onClick={() => void connectCloud()}>
                  {busy === 'cloud' ? 'Abriendo…' : 'Activar sincronización'}
                </Button>
              )}
            </div>
          ) : null}
          <Link to="/ruta" className="mt-4 inline-block text-sm font-semibold text-[var(--color-trail)]">
            Exportar ruta a tu GPS →
          </Link>
        </li>
      </ul>

      <Link
        to="/actividades"
        className="mt-8 inline-block text-sm font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
      >
        ← Volver a actividades
      </Link>
    </main>
  )
}
