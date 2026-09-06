/**
 * DEV-ONLY page. Only reachable on the Vite dev server (`import.meta.env.DEV`),
 * because the `/dev/demo` route is registered conditionally in App.tsx and this
 * module is never imported in a production build.
 *
 * It seeds the ReadyRoute handoff with a test route + a fake host auth plan, then
 * navigates to `/ruta` so the CTA "Preparar nutrición e hidratación" is rendered
 * with a valid draft — without touching Firebase of production.
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { stashReadyRoute } from '@/lib/readyRouteHandoff'
import { DEV_READY_ROUTE_PACKET } from '@/lib/devSeed'

export default function DevPresetPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    const plan = params.get('plan') === 'premium' ? 'premium' : 'free'
    // Fake host auth (DEV only). AuthContext reads this in DEV builds.
    sessionStorage.setItem('pm_dev_auth', plan)
    stashReadyRoute(DEV_READY_ROUTE_PACKET)
    console.log('[dev] DevPresetPage stashed packet plan=' + plan)
    // Land on ReadyRoute with the stashed draft so the real CTA is rendered.
    navigate('/ruta', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  return null
}
