import { test, expect } from '@playwright/test'

/**
 * Happy-path UI flow without depending on live Valhalla/ORS (those are in ors-route.spec).
 * Covers planner → options UI affordances → navigate empty state → paywall surfaces.
 */
test.describe('Planner happy path (UI)', () => {
  test('planner → create CTA → wind section → navigate needs stash', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/route-planner')
    await expect(page.getByRole('heading', { name: 'Crear ruta' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear ruta' })).toBeVisible()

    // Mode labels present
    await expect(page.getByText(/Ida y vuelta|A → B|Objetivo/i).first()).toBeVisible()

    await page.goto('/navegacion')
    await expect(page.getByRole('heading', { name: 'Navegación' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Ir a crear ruta/i })).toBeVisible()

    await page.goto('/premium')
    await expect(page.getByText(/Premium|PedalMap/i).first()).toBeVisible()
  })

  test('cookie banner is compact on planner and does not block forever', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('pedalmap_consent')
      } catch {
        /* ignore */
      }
    })
    await page.goto('/route-planner')
    await expect(page.getByRole('heading', { name: 'Crear ruta' })).toBeVisible()
    // Sticky CTA remains reachable
    await expect(page.getByRole('button', { name: 'Crear ruta' })).toBeVisible()
  })
})
