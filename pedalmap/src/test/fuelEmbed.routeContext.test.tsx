import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { AuthProvider } from '@/app/AuthContext'
import { FuelEmbed } from '@/components/FuelEmbed'
import { DEV_ROUTE_CONTEXT } from '@/lib/devSeed'

// DEV-ONLY wiring test: FuelEmbed must pass the host's ready-route state (sent
// by the real CTA's `navigate('/fuel', { state })`) straight through to the
// embedded FuelApp as routeContext — no #pm_ct, no query params.
vi.mock('@fuel/fuel-app', () => ({
  FuelApp: ({
    routeContext,
    auth,
    base,
  }: {
    routeContext?: unknown
    auth?: unknown
    base?: string
  }) => (
    <div
      data-testid="fuel-app"
      data-context={JSON.stringify(routeContext)}
      data-base={base}
      data-provider={(auth as { provider?: string } | undefined)?.provider}
      data-plan={(auth as { plan?: unknown } | undefined)?.plan ?? 'null'}
    />
  ),
}))

describe('FuelEmbed RouteContext wiring (DEV test harness)', () => {
  beforeEach(() => {
    // Activates the DEV-ONLY fake host auth (premium) inside AuthProvider.
    sessionStorage.setItem('pm_dev_auth', 'premium')
  })

  it('passes ready-route state through to FuelApp as routeContext', async () => {
    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/fuel', state: DEV_ROUTE_CONTEXT }]}
        >
          <Routes>
            <Route path="fuel/*" element={<FuelEmbed />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    const el = await screen.findByTestId('fuel-app')
    expect(el.getAttribute('data-base')).toBe('/fuel')
    expect(JSON.parse(el.getAttribute('data-context') ?? 'null')).toEqual(
      DEV_ROUTE_CONTEXT,
    )
    expect(JSON.parse(JSON.stringify(DEV_ROUTE_CONTEXT))).toEqual({
      distanceKm: 5.2,
      durationMinutes: 18,
      elevationGainM: 120,
      temperatureC: 22,
    })
  })
})
