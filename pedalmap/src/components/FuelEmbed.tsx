import { lazy, Suspense, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useHostFuelAuth } from '@/lib/fuel'
import type { RouteContextLike } from '@fuel/fuel-app'

const FuelApp = lazy(() => import('@fuel/fuel-app').then((m) => ({ default: m.FuelApp })))

/**
 * Fuel is embedded at the route level (/fuel/*), outside of AppShell.
 *
 * Fuel ships its own Tailwind v4 CSS (fuel-embed.css) with its color palette
 * (--color-fuel-50, --color-ink-900, etc.). When embedded, Fuel does NOT
 * import its `index.css` (which defines body { bg-fuel-50 text-ink-900 }),
 * so we need to ensure the host's :root styles don't bleed in.
 *
 * The host's `:root { color: var(--color-ink); bg: var(--color-mist) }` would
 * otherwise become the inherited canvas for Fuel's text/elements.
 *
 * We do NOT force color/background on every element — instead we provide
 * the correct Fuel palette values via CSS variables on the wrapper, letting
 * Fuel's own @apply directives pick them up naturally.
 */
export function FuelEmbed() {
  const auth = useHostFuelAuth()
  const { state, pathname } = useLocation()
  const routeContext = (state ?? null) as RouteContextLike | null
  const cachedContextRef = useRef<RouteContextLike | null>(null)
  if (routeContext) {
    cachedContextRef.current = routeContext
  }
  const activeContext = cachedContextRef.current ?? routeContext
  console.log('[fuel] embed mounted pathname=' + pathname)
  console.log('[fuel] useLocation.state exists=' + (state ? 'true' : 'false'))
  console.log('[fuel] routeContext exists=' + (activeContext ? 'true' : 'false') + ' keys=' + (activeContext ? Object.keys(activeContext).filter(k => activeContext[k as keyof typeof activeContext] !== undefined).join(',') : 'none'))
  if (activeContext) {
    console.log('[fuel] routeContext distance=' + activeContext.distanceKm + ' duration=' + activeContext.durationMinutes + ' elevation=' + activeContext.elevationGainM + ' sport=' + activeContext.sport)
  }
  console.log('[fuel] auth plan=' + auth.plan)
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando PedalMap Fuel…</div>}>
      <div
        id="fuel-embed-root"
        className="fuel-embed-isolation"
      >
        <FuelApp auth={auth} base="/fuel" routeContext={activeContext ?? undefined} />
      </div>
    </Suspense>
  )
}
