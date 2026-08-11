import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { RouteList } from '@/components/route/RouteList'
import { ShareDialog } from '@/components/route/ShareDialog'
import { WindAlertBanner } from '@/components/route/WindAlertBanner'
import { Button } from '@/components/ui/Button'
import type { SavedRoute } from '@/domain/types'
import { FREE_TRIALS } from '@/domain/types'
import { exportRouteToGpx } from '@/lib/gpx'
import { track } from '@/lib/analytics'
import { formatWeatherWindowCaption } from '@/lib/weatherFormat'
import {
  dismissAlert,
  markAlertEmailSent,
  pickBestWindAlert,
  wasAlertEmailSent,
  type WindAlertCandidate,
} from '@/lib/windAlerts'
import { canEnableWindAlertOnRoute, canExportGpx } from '@/services/EntitlementService'
import { alertService } from '@/services/AlertService'
import { authService } from '@/services/AuthService'
import { routeRepository } from '@/services/RouteRepository'
import { weatherService } from '@/services/WeatherService'
import { usePageMeta } from '@/hooks/usePageMeta'

export function MyRoutesPage() {
  usePageMeta({
    title: 'Mis rutas | PedalMap',
    description: 'Consulta, edita, comparte y exporta tus rutas ciclistas guardadas.',
    path: '/my-routes',
  })

  const { user, profile, firebaseReady } = useAuth()
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [share, setShare] = useState<{ url: string; title: string } | null>(null)
  const [windAlert, setWindAlert] = useState<WindAlertCandidate | null>(null)
  const [windBusyId, setWindBusyId] = useState<string | null>(null)
  const [alertHint, setAlertHint] = useState<string | null>(null)

  const alertsMasterOn = Boolean(profile?.notifications?.windAlertsEnabled)

  useEffect(() => {
    if (!user || user.isAnonymous || !firebaseReady) {
      setLoading(false)
      return
    }
    void routeRepository
      .listByUser(user.uid)
      .then(setRoutes)
      .catch((error) => console.error(error))
      .finally(() => setLoading(false))
  }, [user, firebaseReady])

  // Soft in-app check for opted-in routes with excellent windows soon.
  useEffect(() => {
    if (!alertsMasterOn || !user || user.isAnonymous) {
      setWindAlert(null)
      return
    }
    const watched = routes.filter((r) => r.windAlertEnabled && r.geometry?.coordinates?.length)
    if (!watched.length) {
      setWindAlert(null)
      return
    }

    let cancelled = false
    const ac = new AbortController()

    void (async () => {
      const candidates: WindAlertCandidate[] = []
      // Cap concurrent Open-Meteo calls — Free=1, Premium usually few watched.
      const batch = watched.slice(0, 8)
      await Promise.all(
        batch.map(async (route) => {
          try {
            const forecast = await weatherService.forecastForRoute(route.geometry, {
              forecastDays: 3,
              signal: ac.signal,
            })
            const top = forecast.windows[0]
            if (!top) return
            candidates.push({
              routeId: route.id,
              routeTitle: route.title,
              startHour: top.startHour,
              endHour: top.endHour,
              score: top.score,
              label: top.label,
              caption: formatWeatherWindowCaption(top.startHour, top.endHour),
            })
          } catch (error) {
            if ((error as Error)?.name !== 'AbortError') {
              console.warn('[my-routes] wind alert', route.id, error)
            }
          }
        }),
      )
      if (cancelled) return
      const best = pickBestWindAlert(candidates)
      setWindAlert(best)
      if (best) {
        track('wind_alert_shown', { routeId: best.routeId, score: best.score })
        if (
          profile?.notifications?.windAlertsEmail &&
          !wasAlertEmailSent(best.routeId, best.startHour)
        ) {
          try {
            await alertService.sendWindAlertEmail(best)
            markAlertEmailSent(best.routeId, best.startHour)
          } catch (error) {
            console.warn('[my-routes] alert email', error)
          }
        }
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [alertsMasterOn, routes, user, profile?.notifications?.windAlertsEmail])

  async function toggleWindAlert(route: SavedRoute) {
    if (!user || !profile) return
    setAlertHint(null)
    if (route.windAlertEnabled) {
      setWindBusyId(route.id)
      try {
        await routeRepository.setWindAlertEnabled(route.id, user.uid, false)
        setRoutes((prev) =>
          prev.map((r) => (r.id === route.id ? { ...r, windAlertEnabled: false } : r)),
        )
      } catch (error) {
        console.error(error)
        setAlertHint('No se pudo actualizar el aviso.')
      } finally {
        setWindBusyId(null)
      }
      return
    }

    const entitlement = canEnableWindAlertOnRoute(profile, routes, route.id)
    if (!entitlement.ok) {
      if (entitlement.reason === 'alerts_off') {
        setAlertHint('Activa los avisos en Perfil primero.')
      } else if (entitlement.reason === 'alert_route_limit') {
        setAlertHint(
          `Free avisa en ${FREE_TRIALS.windAlertRoutes} ruta. Quita el aviso de otra o pasa a Premium.`,
        )
      } else {
        setAlertHint('No se puede activar el aviso en esta ruta.')
      }
      return
    }

    setWindBusyId(route.id)
    try {
      await routeRepository.setWindAlertEnabled(route.id, user.uid, true)
      setRoutes((prev) =>
        prev.map((r) => (r.id === route.id ? { ...r, windAlertEnabled: true } : r)),
      )
      track('wind_alert_opt_in', { scope: 'route' })
    } catch (error) {
      console.error(error)
      setAlertHint('No se pudo activar el aviso.')
    } finally {
      setWindBusyId(null)
    }
  }

  if (!firebaseReady) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Mis rutas</h1>
        <p className="mt-3 text-[var(--color-stone)]">
          Configura Firebase en `.env` para guardar y listar rutas en la nube.
        </p>
      </main>
    )
  }

  if (!user || user.isAnonymous) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Mis rutas</h1>
        <p className="mt-3 text-[var(--color-stone)]">
          Inicia sesión para sincronizar tus rutas entre dispositivos.
        </p>
        <Link to="/login" className="mt-4 inline-block">
          <Button>Entrar</Button>
        </Link>
      </main>
    )
  }

  const alertRoute = windAlert
    ? routes.find((r) => r.id === windAlert.routeId)
    : undefined

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 pb-24">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Mis rutas</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {routes.length} guardada{routes.length === 1 ? '' : 's'}
            {alertsMasterOn ? ' · avisos de viento activos' : ''}
          </p>
        </div>
        <Link to="/route-planner">
          <Button>Nueva ruta</Button>
        </Link>
      </div>

      {windAlert && (
        <WindAlertBanner
          alert={windAlert}
          route={alertRoute}
          onDismiss={() => {
            dismissAlert(windAlert.routeId, windAlert.startHour)
            setWindAlert(null)
          }}
        />
      )}

      {!alertsMasterOn && routes.length > 0 && (
        <p className="mb-4 text-sm text-[var(--color-stone)]">
          ¿Quieres aviso cuando haya cola de viento?{' '}
          <Link to="/perfil" className="font-semibold text-[var(--color-trail)] hover:underline">
            Activar en Perfil
          </Link>
        </p>
      )}

      {alertHint && (
        <p className="mb-4 text-sm text-[var(--color-trail)]">
          {alertHint}{' '}
          {alertHint.includes('Premium') && (
            <Link to="/premium" className="font-semibold underline-offset-2 hover:underline">
              Ver Premium
            </Link>
          )}
        </p>
      )}

      {loading ? (
        <p className="animate-pulse-soft text-sm text-[var(--color-stone)]">Cargando rutas…</p>
      ) : (
        <RouteList
          routes={routes}
          showWindAlertToggle={alertsMasterOn}
          windAlertBusyId={windBusyId}
          onToggleWindAlert={(route) => void toggleWindAlert(route)}
          onShare={async (route) => {
            if (!user) return
            const slug = await routeRepository.makePublic(route.id, user.uid)
            const url = `${window.location.origin}/route/${slug}`
            setShare({ url, title: route.title })
          }}
          onDuplicate={async (route) => {
            if (!user) return
            const copy = await routeRepository.duplicate(user.uid, route)
            setRoutes((prev) => [copy, ...prev])
          }}
          onDelete={async (route) => {
            if (!user) return
            if (!confirm('¿Eliminar esta ruta?')) return
            await routeRepository.remove(route.id, user.uid)
            setRoutes((prev) => prev.filter((r) => r.id !== route.id))
          }}
          onExport={(route) => {
            if (!canExportGpx(profile)) {
              alert('Tu GPX Free de esta semana ya está usado. Premium = ilimitado.')
              return
            }
            const xml = exportRouteToGpx(route)
            const blob = new Blob([xml], { type: 'application/gpx+xml' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${route.shareSlug || route.id}.gpx`
            a.click()
            URL.revokeObjectURL(url)
            if (profile && profile.plan !== 'premium') {
              void authService.recordFreeGpxExport(profile.uid).catch(() => undefined)
              track('free_trial_used', { kind: 'gpx' })
            }
            track('gpx_exported')
          }}
        />
      )}

      {share && (
        <ShareDialog
          url={share.url}
          title={share.title}
          onClose={() => setShare(null)}
        />
      )}
    </main>
  )
}
