import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RoutePlanner } from '@/components/route/RoutePlanner'
import { usePageMeta } from '@/hooks/usePageMeta'
import { usePlanner } from '@/app/PlannerContext'
import { useAuth } from '@/app/AuthContext'
import { routeRepository } from '@/services/RouteRepository'
import { stashReadyRoute } from '@/lib/readyRouteHandoff'

export function RoutePlannerPage() {
  usePageMeta({
    title: 'Planificador de rutas en bicicleta | PedalMap',
    description:
      'Crea rutas ciclistas con mapa, desnivel, tiempo estimado y perfil de elevación. Ideal para carretera, MTB y gravel.',
    path: '/route-planner',
  })

  const [params] = useSearchParams()
  const { firebaseReady } = useAuth()
  const { setDraftFromImport, startEditing, clearRoute } = usePlanner()

  // Support Mis rutas → Editar (?routeId=&edit=1)
  useEffect(() => {
    const routeId = params.get('routeId')
    if (!routeId || !firebaseReady || !routeRepository.isConfigured()) return
    let cancelled = false
    void routeRepository.getById(routeId).then((route) => {
      if (cancelled || !route) return
      setDraftFromImport(route)
      stashReadyRoute({
        draft: route,
        savedRouteId: route.id,
        shareSlug: route.shareSlug ?? null,
        source: 'saved',
      })
      if (params.get('edit') === '1') {
        // Defer so draft is committed before entering edit mode.
        window.setTimeout(() => startEditing(), 0)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, firebaseReady])

  // Support /ruta → Crear otra (?reset=1)
  useEffect(() => {
    if (params.get('reset') !== '1') return
    clearRoute()
    // Drop the query so a refresh does not wipe a new draft mid-edit.
    const next = new URLSearchParams(params)
    next.delete('reset')
    const qs = next.toString()
    window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return <RoutePlanner />
}
