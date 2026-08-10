import { test, expect } from '@playwright/test'

async function pickSuggestion(
  page: import('@playwright/test').Page,
  label: string,
  query: string,
  match: RegExp,
) {
  const input = page.getByLabel(label)
  await input.click()
  await input.fill('')
  await input.fill(query)
  const box = page
    .locator('div.relative')
    .filter({ has: page.getByLabel(label) })
    .getByRole('listbox')
  await expect(box).toBeVisible({ timeout: 20_000 })
  await box.getByRole('button').filter({ hasText: match }).first().click()
  await expect(box).toBeHidden({ timeout: 5_000 })
}

test.describe('ORS real routing', () => {
  test('Madrid → Colmenar Viejo returns real route stats', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/route-planner')
    await expect(page.getByRole('heading', { name: 'Crear ruta' })).toBeVisible()
    await expect(page.getByText(/falta VITE_ORS_API_KEY/i)).toHaveCount(0)

    await pickSuggestion(page, 'Inicio', 'Madrid', /Madrid/i)
    await pickSuggestion(page, 'Destino', 'Colmenar Viejo', /Colmenar Viejo/i)

    const orsPromise = page.waitForResponse(
      (res) => res.url().includes('/v2/directions/') && res.request().method() === 'POST',
      { timeout: 60_000 },
    )

    await page.getByRole('button', { name: 'Crear ruta', exact: true }).click()
    const ors = await orsPromise

    if (ors.status() === 503 || (await ors.text()).toLowerCase().includes('maintenance')) {
      test.skip(true, 'OpenRouteService is temporarily in maintenance (503)')
    }

    expect(ors.status()).toBe(200)
    await expect(page.getByText(/\d+([.,]\d+)?\s*km/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.maplibregl-canvas')).toBeVisible()
    await page.screenshot({ path: 'test-results/madrid-colmenar-route.png', fullPage: true })
  })
})
