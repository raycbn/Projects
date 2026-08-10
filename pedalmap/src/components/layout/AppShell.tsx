import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { CookieBanner } from '@/components/legal/CookieBanner'

const navClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-[var(--color-forest)] text-white'
      : 'text-[var(--color-forest)] hover:bg-[var(--color-fog)]',
  )

export function AppShell() {
  const { user, profile, logout, firebaseReady } = useAuth()
  const { pathname } = useLocation()
  const isPlanner = pathname.startsWith('/route-planner')
  const wash = !isPlanner

  return (
    <div className={clsx('min-h-dvh', wash && 'page-wash')}>
      <header className="sticky top-0 z-40 h-[var(--header-h)] border-b border-[var(--color-fog)]/80 bg-[color-mix(in_oklab,var(--color-mist)_88%,white)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-3 md:gap-4 md:px-6">
          <Link
            to="/"
            className="font-display text-lg font-extrabold tracking-tight text-[var(--color-forest)] md:text-xl"
          >
            Pedal<span className="text-[var(--color-trail)]">Map</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            <NavLink to="/route-planner" className={navClass}>
              Crear ruta
            </NavLink>
            <NavLink to="/explorar" className={navClass}>
              Explorar
            </NavLink>
            <NavLink to="/my-routes" className={navClass}>
              Mis rutas
            </NavLink>
            <NavLink to="/actividades" className={navClass}>
              Actividades
            </NavLink>
            <NavLink to="/premium" className={navClass}>
              Premium
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/perfil"
                  className="hidden text-sm font-medium text-[var(--color-forest)] sm:inline"
                >
                  {profile?.displayName || (user.isAnonymous ? 'Invitado' : 'Perfil')}
                </Link>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  Salir
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  {firebaseReady ? 'Entrar' : 'Entrar'}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <Outlet />

      {!isPlanner && (
        <footer className="border-t border-[var(--color-fog)] bg-[color-mix(in_oklab,var(--color-mist)_70%,white)] px-4 py-8 pb-24 md:pb-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-[var(--color-stone)] md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-lg font-bold text-[var(--color-forest)]">
                Pedal<span className="text-[var(--color-trail)]">Map</span>
              </p>
              <p className="mt-0.5 text-xs">Planifica con el suelo y el viento a tu favor.</p>
            </div>
            <nav className="flex flex-wrap gap-4" aria-label="Legal">
              <Link className="hover:text-[var(--color-forest)]" to="/privacidad">
                Privacidad
              </Link>
              <Link className="hover:text-[var(--color-forest)]" to="/cookies">
                Cookies
              </Link>
              <Link className="hover:text-[var(--color-forest)]" to="/terminos">
                Términos
              </Link>
              <Link className="hover:text-[var(--color-forest)]" to="/premium">
                Premium
              </Link>
            </nav>
          </div>
        </footer>
      )}

      <CookieBanner />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid h-[var(--tabbar-h)] grid-cols-4 border-t border-[var(--color-fog)] bg-white/95 px-1 safe-pb md:hidden"
        aria-label="Móvil"
      >
        {[
          ['/', 'Inicio'],
          ['/route-planner', 'Crear'],
          ['/actividades', 'GPS'],
          ['/perfil', 'Perfil'],
        ].map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center justify-center rounded-lg text-center text-xs font-semibold',
                isActive
                  ? 'bg-[var(--color-signal)] text-[var(--color-ink)]'
                  : 'text-[var(--color-stone)]',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
