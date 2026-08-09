import { lazy, Suspense, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { RouteSummary } from '@/components/route/RouteSummary'
import { ElevationChart } from '@/components/route/ElevationChart'
import type { SavedRoute } from '@/domain/types'
import { routeRepository } from '@/services/RouteRepository'
import { isFirebaseConfigured } from '@/lib/firebase'
import { usePageMeta } from '@/hooks/usePageMeta'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

export function SharedRoutePage() {
  const { shareSlug = '' } = useParams()
  const [route, setRoute] = useState<SavedRoute | null>(null)
  const [error, setError] = useState<string | null>(null)

  usePageMeta({
    title: route ? `${route.title} | BikeRoute` : 'Ruta compartida | BikeRoute',
    description: route
      ? `${route.title}: ruta ciclista compartida con distancia y desnivel.`
      : 'Visualiza una ruta ciclista compartida en BikeRoute.',
    path: `/route/${shareSlug}`,
  })

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setError('Firebase no está configurado. Las rutas compartidas requieren Firestore.')
      return
    }
    void routeRepository
      .getByShareSlug(shareSlug)
      .then((r) => {
        if (!r) setError('No encontramos esta ruta pública.')
        else setRoute(r)
      })
      .catch((err) => {
        console.error(err)
        setError('No se pudo cargar la ruta.')
      })
  }, [shareSlug])

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Ruta no disponible</h1>
        <p className="mt-3 text-[var(--color-stone)]">{error}</p>
      </main>
    )
  }

  if (!route) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="animate-pulse-soft text-[var(--color-stone)]">Cargando ruta…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-24">
      <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">{route.title}</h1>
      {route.description && (
        <p className="mt-2 text-[var(--color-stone)]">{route.description}</p>
      )}
      <div className="mt-6 h-[50vh] overflow-hidden rounded-3xl ring-1 ring-[var(--color-fog)]">
        <Suspense fallback={<div className="flex h-full items-center justify-center">Cargando mapa…</div>}>
          <MapView
            waypoints={route.waypoints}
            geometry={route.geometry}
            interactive={false}
            fitKey={route.id}
          />
        </Suspense>
      </div>
      <div className="mt-6 space-y-4">
        <RouteSummary stats={route.stats} />
        <ElevationChart profile={route.elevationProfile} />
      </div>
      <p className="mt-6 text-sm text-[var(--color-stone)]">
        Vista pública de solo lectura. Para editar o recalcular, abre el planificador con tu cuenta.
      </p>
    </main>
  )
}
