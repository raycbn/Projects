import { lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

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
import { seoPages } from '@/content/seoPages'

// DEV-ONLY: lazy import so the fixture page is never pulled into a production build.
const LazyDevPreset = lazy(() => import('@/pages/DevPresetPage'))

/**
 * Listens for `capacitor-deep-link` events dispatched from MainActivity's
 * `onNewIntent` (Android only) and turns them into React Router navigations
 * pushed onto the SPA history so Android Back returns to the previous page.
 * Web never emits this event, so this is a no-op in the browser.
 */
function DeepLinkHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    const onDeepLink = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (detail) navigate(detail)
    }
    window.addEventListener('capacitor-deep-link', onDeepLink)
    return () => window.removeEventListener('capacitor-deep-link', onDeepLink)
  }, [navigate])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <PlannerProvider>
        <BrowserRouter>
          <DeepLinkHandler />
          <AnalyticsListener />
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<LandingPage />} />
              {/* DEV-ONLY: test harness route, never built into production. */}
              {import.meta.env.DEV ? (
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
