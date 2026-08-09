import { Link, NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'

const navClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-[var(--color-forest)] text-white'
      : 'text-[var(--color-forest)] hover:bg-[var(--color-fog)]',
  )

export function AppShell() {
  const { user, profile, logout, firebaseReady } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--color-fog)]/80 bg-[color-mix(in_oklab,var(--color-mist)_88%,white)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-[var(--color-forest)]">
            Bike<span className="text-[var(--color-trail)]">Route</span>
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
                <Button variant="ghost" onClick={() => void logout()} className="!py-2">
                  Salir
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="secondary" className="!py-2">
                  {firebaseReady ? 'Entrar' : 'Entrar'}
                </Button>
              </Link>
            )}
            <Link to="/route-planner" className="md:hidden">
              <Button className="!py-2">Crear</Button>
            </Link>
          </div>
        </div>
      </header>
      <Outlet />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t border-[var(--color-fog)] bg-white/95 px-2 py-2 md:hidden"
        aria-label="Móvil"
      >
        {[
          ['/', 'Inicio'],
          ['/route-planner', 'Crear'],
          ['/my-routes', 'Rutas'],
          ['/perfil', 'Perfil'],
        ].map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'rounded-lg px-2 py-2 text-center text-xs font-semibold',
                isActive ? 'bg-[var(--color-signal)] text-[var(--color-ink)]' : 'text-[var(--color-stone)]',
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
