import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/app/AuthContext'
import { PlannerProvider } from '@/app/PlannerContext'
import { AppShell } from '@/components/layout/AppShell'
import { LandingPage } from '@/pages/LandingPage'
import { RoutePlannerPage } from '@/pages/RoutePlannerPage'
import { MyRoutesPage } from '@/pages/MyRoutesPage'
import { LoginPage, RegisterPage, ForgotPasswordPage } from '@/pages/AuthPages'
import { AuthBridgePage } from '@/pages/AuthBridgePage'
import { PremiumPage } from '@/pages/PremiumPage'
import { SharedRoutePage } from '@/pages/SharedRoutePage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ExplorePage } from '@/pages/ExplorePage'
import { PrivacyPage, CookiesPage, TermsPage } from '@/pages/LegalPages'
import { SeoContentPage } from '@/pages/SeoContentPage'
import { ActivityPage } from '@/pages/ActivityPage'
import { MyActivitiesPage } from '@/pages/MyActivitiesPage'
import { ActivityDetailPage } from '@/pages/ActivityDetailPage'
import { NavigationPage } from '@/pages/NavigationPage'
import { seoPages } from '@/content/seoPages'

export default function App() {
  return (
    <AuthProvider>
      <PlannerProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<LandingPage />} />
              <Route path="route-planner" element={<RoutePlannerPage />} />
              <Route path="my-routes" element={<MyRoutesPage />} />
              <Route path="actividades" element={<MyActivitiesPage />} />
              <Route path="actividades/:activityId" element={<ActivityDetailPage />} />
              <Route path="actividad" element={<ActivityPage />} />
              <Route path="navegacion" element={<NavigationPage />} />
              <Route path="explorar" element={<ExplorePage />} />
              <Route path="premium" element={<PremiumPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="auth/bridge" element={<AuthBridgePage />} />
              <Route path="register" element={<RegisterPage />} />
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
          </Routes>
        </BrowserRouter>
      </PlannerProvider>
    </AuthProvider>
  )
}
