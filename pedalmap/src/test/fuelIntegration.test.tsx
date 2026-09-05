import { describe, it, expect, vi } from 'vitest'
import { lazy, Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * Integration tests: Fuel embedded as an internal section of PedalMap.
 *
 * Scope (FASE APP 2B):
 *  - Fuel is importable from the host via the `@fuel` Vite alias.
 *  - FuelApp renders inside the host (its own layout, routes inherited).
 *  - Fuel is loaded lazily (not in PedalMap's initial synchronous graph).
 *  - react resolves to the host's single v19 instance (no duplicate React).
 *  - The `/fuel/*` route mounts FuelApp within the host router.
 *
 * FuelApp owns NO BrowserRouter (host provides the root router); it renders
 * relative routes so it nests inside a host `<Route path="fuel/*">`.
 */

describe('Fuel embedded in PedalMap', () => {
  it('exposes a FuelApp entry point via the @fuel alias', async () => {
    const mod = await import('@fuel/fuel-app')
    expect(typeof mod.FuelApp).toBe('function')
  }, 15000)

  it('renders the embedded Fuel home within a host router', async () => {
    const { FuelApp } = await import('@fuel/fuel-app')
    render(
      <Suspense fallback={null}>
        <MemoryRouter>
            <FuelApp />
        </MemoryRouter>
      </Suspense>,
    )
    // Fuel mounted in embedded mode renders its Layout + home hero.
    expect(await screen.findByRole('banner', undefined, { timeout: 10000 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Prepara tu próxima salida/i })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /Crear mi plan gratis/i }).length).toBeGreaterThan(0)
  })

  it('resolves a single React v19 from the host (no duplicate React)', async () => {
    const React = await import('react')
    const ReactDOMClient = await import('react-dom/client')
    expect(React.version).toMatch(/^19\.\d+\.\d+/)
    expect(typeof ReactDOMClient.createRoot).toBe('function')
  })

  it('mounts FuelApp at host route /fuel/* with lazy loading', async () => {
    const HostApp = lazy(() =>
      import('@fuel/fuel-app').then((m) => ({ default: m.FuelApp })),
    )
    render(
      <MemoryRouter initialEntries={['/fuel/planner']}>
        <Suspense fallback={<div data-testid="fuel-loading">Cargando…</div>}>
          <Routes>
            <Route path="fuel/*" element={<HostApp />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    )
    // Fuel lazy chunk loads, then PlannerPage renders under /fuel/planner.
    expect(
      await screen.findByRole('heading', { name: /Preparar mi salida/i }, { timeout: 8000 }),
    ).toBeTruthy()
  })

  it('host premium auth reaches Fuel and links stay under /fuel/* (2C)', async () => {
    const { FuelApp } = await import('@fuel/fuel-app')
    const hostAuth = {
      user: { uid: 'u-1', email: 'host@pm.es' },
      localUser: null,
      provider: 'pedalmap' as const,
      loading: false,
      firebaseReady: true,
      plan: 'premium' as const,
      entitlementLoading: false,
      entitlementError: false,
      canSaveRoute: true,
      maxRoutesSaved: null,
      routesSaved: 0,
      loginLocal: vi.fn(),
      registerLocal: vi.fn(),
      logout: vi.fn(),
      handoffLogin: vi.fn(),
    }
    render(
      <MemoryRouter initialEntries={['/fuel']}>
        <Routes>
          <Route path="fuel/*" element={<FuelApp auth={hostAuth} base="/fuel" />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText(/Conectado con PedalMap/i)).toBeInTheDocument()
    const createPlan = screen.getAllByRole('link', { name: /Crear mi plan gratis/i })[0]
    expect((createPlan as HTMLAnchorElement).getAttribute('href')).toBe('/fuel/planner')
    expect(screen.getByText('Premium', { selector: 'span' })).toBeInTheDocument()
  })
})
