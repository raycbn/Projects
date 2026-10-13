import { lazy, useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { parseGpx, importedGpxToDraft } from '@/lib/gpx'
import { usePlanner } from '@/app/PlannerContext'

/**
 * Fuel is embedded lazily so it never enters PedalMap's initial bundle.
 * `@fuel` resolves (via Vite alias) to PedalMapFuel/src — Fuel is consumed as
 * source, not copied. `react` and `react-router-dom` are hoisted from the host,
 * so there is no duplicate dependency. The `/fuel/*` route mounts
 * `<FuelEmbed />`, which passes the host `AuthProvider` session through
 * `useHostFuelAuth()` instead of booting a second Firebase Auth instance.
 * Fuel still owns the embedded chunk's `FuelAuthProvider`-free rendering and its
 * own `fuel-embed.css`, kept isolated from the host.
 */
import { AuthProvider } from '@/app/AuthContext'
import { PlannerProvider } from '@/app/PlannerContext'
import { FuelEmbed } from '@/components/FuelEmbed'
import { AppShell } from '@/components/layout/AppShell'
import { AnalyticsListener } from '@/components/AnalyticsListener'
import { LandingPage } from '@/pages/LandingPage'
import { RoutePlannerPage } from '@/pages/RoutePlannerPage'
import { ReadyRoutePage } from '@/pages/ReadyRoutePage'
import { MyRoutesPage } from '@/pages/MyRoutesPage'
import { LoginPage, RegisterPage, ForgotPasswordPage } from '@/pages/AuthPages'
import { SorteoPage } from '@/pages/SorteoPage'
import { AuthBridgePage } from '@/pages/AuthBridgePage'
import { PremiumPage } from '@/pages/PremiumPage'
import { SharedRoutePage } from '@/pages/SharedRoutePage'
import { ProfilePage } from '@/pages/ProfilePage'
import { PublicCyclistPage } from '@/pages/PublicCyclistPage'
import { ExplorePage } from '@/pages/ExplorePage'
import { PrivacyPage, CookiesPage, TermsPage } from '@/pages/LegalPages'
import { SeoContentPage } from '@/pages/SeoContentPage'
import { ActivityPage } from '@/pages/ActivityPage'
import { MyActivitiesPage } from '@/pages/MyActivitiesPage'
import { ActivityDetailPage } from '@/pages/ActivityDetailPage'
import { ConnectGpsPage } from '@/pages/ConnectGpsPage'
import { NavigationPage } from '@/pages/NavigationPage'
import { BlogIndexPage } from '@/pages/BlogIndexPage'
import { BlogPostPage } from '@/pages/BlogPostPage'
import { GpxImportPage } from '@/pages/GpxImportPage'
import { seoPages } from '@/content/seoPages'

// DEV-ONLY: the dev fixture is only ever wired up under `import.meta.env.DEV`
// (see the conditional route below). Guarding the lazy factory itself with DEV
// lets Vite dead-code-eliminate the dynamic `import()` in production, so the
// DevPresetPage chunk / devSeed content never ships in the production build.
const LazyDevPreset = import.meta.env.DEV
  ? lazy(() => import('@/pages/DevPresetPage'))
  : null

/**
 * Listens for `capacitor-deep-link` events dispatched from MainActivity's
 * `onNewIntent` (Android only) and turns them into React Router navigations
 * pushed onto the SPA history so Android Back returns to the previous page.
 * Web never emits this event, so this is a no-op in the browser.
 *
 * NEW: Also uses Capacitor App API (getLaunchUrl, appUrlOpen) for official
 * deep link handling including custom scheme (pedalmap://shortcut/...)
 * and verified App Links (https://pedalmap.es/route/...).
 */
function DeepLinkHandler() {
  const navigate = useNavigate()
  const handledUrls = useRef(new Set<string>())
  const listenerRef = useRef<{ remove: () => void } | null>(null)

  useEffect(() => {
    let mounted = true

    const handleLaunchUrl = (url: string) => {
      if (!mounted) return
      if (!url) return

      // Deduplicate
      if (handledUrls.current.has(url)) {
        console.log('[deep-link] duplicate ignored=', url)
        return
      }

      let source: 'shortcut' | 'applink' | 'unknown' = 'unknown'
      let target: string | null = null

      try {
        const u = new URL(url)

        // Detect custom scheme shortcuts: pedalmap://shortcut/<id>
        if (u.protocol === 'pedalmap:' && u.hostname === 'shortcut') {
          source = 'shortcut'
          const path = u.pathname
          if (path === '/create_route') target = '/route-planner'
          else if (path === '/my_routes') target = '/my-routes'
          else if (path === '/import_gpx') target = '/gpx-import'
          else if (path === '/daily_route') target = '/ruta'
        }
        // Detect verified App Links: https://pedalmap.es/route/<id> or /ruta/<id>
        else if (u.protocol === 'https:' && (u.hostname === 'pedalmap.es' || u.hostname === 'www.pedalmap.es')) {
          if (u.pathname.startsWith('/route/') || u.pathname.startsWith('/ruta/')) {
            source = 'applink'
            const routeId = u.pathname.startsWith('/route/')
              ? u.pathname.slice('/route/'.length)
              : u.pathname.slice('/ruta/'.length)
            if (routeId) target = '/route/' + routeId
          }
        }
      } catch {
        // Invalid URL, ignore
      }

      if (!target) {
        console.log('[deep-link] invalid or unsupported url=', url)
        return
      }

      handledUrls.current.add(url)
      console.log('[deep-link] handle url=', url)
      console.log('[deep-link] source=', source)
      console.log('[deep-link] navigate target=', target)
      navigate(target)
    }

    // 1. Register listener FIRST for warm start events
    const initListener = async () => {
      const listener = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
        console.log('[deep-link] appUrlOpen=', url)
        handleLaunchUrl(url)
      })
      listenerRef.current = listener

      // 2. Get launch URL for cold start
      const launch = await CapacitorApp.getLaunchUrl()
      console.log('[deep-link] getLaunchUrl=', launch?.url ?? null)
      if (launch?.url && mounted) {
        handleLaunchUrl(launch.url)
      }
    }

    initListener()

    return () => {
      mounted = false
      if (listenerRef.current) {
        listenerRef.current.remove()
      }
    }
  }, [navigate])

  return null
}

/**
 * Listens for `pedalmap-gpx-import` events dispatched from MainActivity
 * when a GPX file is opened via "Open With" or "Share" from another app.
 * Imports the GPX content into the planner and navigates to the route planner.
 */
function GpxImportHandler() {
  const navigate = useNavigate()
  const { setDraftFromImport } = usePlanner()
  const handledUris = useRef(new Set<string>())

  useEffect(() => {
    const onGpxImport = (e: Event) => {
      const detail = (e as CustomEvent<{ uri?: string; type?: string; content?: string }>).detail
      if (!detail?.content) return
      const uri = detail.uri ?? ''
      if (handledUris.current.has(uri)) {
        console.log('[gpx-import] duplicate ignored uri=' + uri)
        return
      }
      handledUris.current.add(uri)
      console.log('[gpx-import] received uri=' + uri)
      try {
        const imported = parseGpx(detail.content)
        const draft = importedGpxToDraft(imported)
        setDraftFromImport(draft)
        console.log('[gpx-import] navigate to /route-planner')
        navigate('/route-planner')
      } catch (error) {
        console.error('[gpx-import] parse error', error)
        alert('No se pudo importar el GPX. Comprueba que el archivo sea válido.')
      }
    }
    window.addEventListener('pedalmap-gpx-import', onGpxImport)
    return () => window.removeEventListener('pedalmap-gpx-import', onGpxImport)
  }, [navigate, setDraftFromImport])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <PlannerProvider>
        <BrowserRouter>
          <DeepLinkHandler />
          <GpxImportHandler />
          <AnalyticsListener />
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<LandingPage />} />
                            {/* DEV-ONLY: test harness route, never built into production. */}
              {LazyDevPreset ? (
                <Route
                  path="dev/demo"
                  element={
                    <LazyDevPreset />
                  }
                />
              ) : null}
              <Route path="route-planner" element={<RoutePlannerPage />} />
              <Route path="ruta" element={<ReadyRoutePage />} />
              <Route path="my-routes" element={<MyRoutesPage />} />
              <Route path="gpx-import" element={<GpxImportPage />} />
              <Route path="actividades" element={<MyActivitiesPage />} />
              <Route path="actividades/:activityId" element={<ActivityDetailPage />} />
              <Route path="actividades/conectar" element={<ConnectGpsPage />} />
              <Route path="actividad" element={<ActivityPage />} />
              <Route path="navegacion" element={<NavigationPage />} />
              <Route path="explorar" element={<ExplorePage />} />
              <Route path="blog" element={<BlogIndexPage />} />
              <Route path="blog/:slug" element={<BlogPostPage />} />
              <Route path="premium" element={<PremiumPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="ciclista/:uid" element={<PublicCyclistPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="auth/bridge" element={<AuthBridgePage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="sorteo" element={<SorteoPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="route/:shareSlug" element={<SharedRoutePage />} />
              <Route path="privacidad" element={<PrivacyPage />} />
              <Route path="cookies" element={<CookiesPage />} />
              <Route path="terminos" element={<TermsPage />} />
              {seoPages.map((content) => (
                <Route
                  key={content.path}
                  path={content.path.slice(1)}
                  element={<SeoContentPage content={content} />}
                />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
            <Route
              path="fuel/*"
              element={<FuelEmbed />}
            />
          </Routes>
        </BrowserRouter>
      </PlannerProvider>
    </AuthProvider>
  )
}