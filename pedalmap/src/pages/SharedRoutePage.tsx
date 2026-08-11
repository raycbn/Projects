import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RouteSummary } from '@/components/route/RouteSummary'
import { ElevationChart } from '@/components/route/ElevationChart'
import { Button } from '@/components/ui/Button'
import type { BikeType, SavedRoute } from '@/domain/types'
import { formatDistance, formatElevation } from '@/lib/stats'
import { routeRepository } from '@/services/RouteRepository'
import { isFirebaseConfigured } from '@/lib/firebase'
import { usePageMeta } from '@/hooks/usePageMeta'

const MapView = lazy(() =>
  import('@/components/map/MapView').then((m) => ({ default: m.MapView })),
)

function bikeLabel(bike: BikeType): string {
  switch (bike) {
    case 'road':
      return 'Carretera'
    case 'mtb':
      return 'MTB'
    case 'gravel':
      return 'Gravel'
    case 'urban':
      return 'Urbana'
    case 'ebike':
      return 'E-bike'
    default:
      return bike
  }
}

export function SharedRoutePage() {
  const { shareSlug = '' } = useParams()
  const [route, setRoute] = useState<SavedRoute | null>(null)
  const [error, setError] = useState<string | null>(null)

  usePageMeta({
    title: route ? `${route.title} | PedalMap` : 'Ruta compartida | PedalMap',
    description: route
      ? `${route.title}: ${formatDistance(route.stats.distanceMeters)}, ${formatElevation(route.stats.elevationGainMeters)} · PedalMap`
      : 'Visualiza una ruta ciclista compartida en PedalMap.',
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
        <Link to="/route-planner" className="mt-6 inline-block">
          <Button>Abrir planificador</Button>
        </Link>
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
        Ruta compartida · {bikeLabel(route.bikeType)}
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
        {route.title}
      </h1>
      {route.description && (
        <p className="mt-2 text-[var(--color-stone)]">{route.description}</p>
      )}
      <p className="mt-2 text-sm text-[var(--color-stone)]">
        {formatDistance(route.stats.distanceMeters)} ·{' '}
        {formatElevation(route.stats.elevationGainMeters)} · {bikeLabel(route.bikeType)}
      </p>
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
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/route-planner">
          <Button>Planificar otra ruta</Button>
        </Link>
        <Link to="/">
          <Button variant="secondary">Conocer PedalMap</Button>
        </Link>
      </div>
      <p className="mt-6 text-sm text-[var(--color-stone)]">
        Vista pública con mapa, desnivel y superficies. Para editar o recalcular, abre el planificador
        con tu cuenta.
      </p>
    </main>
  )
}
