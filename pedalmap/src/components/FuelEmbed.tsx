import { lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { useHostFuelAuth } from '@/lib/fuel'
import type { RouteContextLike } from '@fuel/fuel-app'

const FuelApp = lazy(() => import('@fuel/fuel-app').then((m) => ({ default: m.FuelApp })))

export function FuelEmbed() {
  const auth = useHostFuelAuth()
  const { state } = useLocation()
  const routeContext = (state ?? null) as RouteContextLike | null
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando PedalMap Fuel…</div>}>
      <FuelApp auth={auth} base="/fuel" routeContext={routeContext ?? undefined} />
    </Suspense>
  )
}
