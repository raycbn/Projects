import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { RouteList } from '@/components/route/RouteList'
import { ShareDialog } from '@/components/route/ShareDialog'
import { Button } from '@/components/ui/Button'
import type { SavedRoute } from '@/domain/types'
import { exportRouteToGpx } from '@/lib/gpx'
import { track } from '@/lib/analytics'
import { routeRepository } from '@/services/RouteRepository'
import { canExportGpx } from '@/services/EntitlementService'
import { authService } from '@/services/AuthService'
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 pb-24">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Mis rutas</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {routes.length} guardada{routes.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link to="/route-planner">
          <Button>Nueva ruta</Button>
        </Link>
      </div>

      {loading ? (
        <p className="animate-pulse-soft text-sm text-[var(--color-stone)]">Cargando rutas…</p>
      ) : (
        <RouteList
          routes={routes}
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
        <ShareDialog url={share.url} title={share.title} onClose={() => setShare(null)} />
      )}
    </main>
  )
}
