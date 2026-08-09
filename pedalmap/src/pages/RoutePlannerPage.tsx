import { RoutePlanner } from '@/components/route/RoutePlanner'
import { usePageMeta } from '@/hooks/usePageMeta'

export function RoutePlannerPage() {
  usePageMeta({
    title: 'Planificador de rutas en bicicleta | PedalMap',
    description:
      'Crea rutas ciclistas con mapa, desnivel, tiempo estimado y perfil de elevación. Ideal para carretera, MTB y gravel.',
    path: '/route-planner',
  })

  return <RoutePlanner />
}
