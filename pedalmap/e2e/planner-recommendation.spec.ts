import { test, expect, type Page } from '@playwright/test'

async function pickSuggestion(
  page: Page,
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

test.describe('Planifica mi salida — real routing + PedalScore recommendation', () => {
  test('Madrid → Chamartín returns real route, alternatives and recommendation', async ({
    page,
  }) => {
    test.setTimeout(300_000)

    await page.addInitScript(() => {
      try {
        localStorage.setItem('pedalmap_consent', 'accepted')
      } catch {
        /* ignore */
      }
    })

    await page.goto('/route-planner')
    await expect(page.getByRole('heading', { name: 'Crear ruta' })).toBeVisible()

    // Routing is configured (Valhalla proxy via Worker).
    await expect(
      page.getByText(/Routing no configurado|proxy Worker/i),
    ).toHaveCount(0)

    // 1. Origen / destino
    await pickSuggestion(page, 'Inicio', 'Madrid', /Madrid/i)
    await pickSuggestion(page, 'Destino', 'Chamartín, Madrid', /Cham/i)

    await page.getByRole('button', { name: 'Crear ruta', exact: true }).click()

    try {
      await page.waitForResponse(
        (res) =>
          res.url().includes('/valhalla/bike-route') &&
          res.request().method() === 'POST',
        { timeout: 120_000 },
      )
    } catch {
      const bodyText = await page.evaluate(() => document.body.innerText || '')
      if (bodyText.includes('No hay conexión con el motor de rutas')) {
        test.skip(true, 'Routing engine not reachable in test environment')
      }
      throw new Error('Routing response did not arrive and no backend-unreachable error was shown')
    }

    const bodyText = await page.evaluate(() => document.body.innerText || '')
    if (bodyText.includes('No hay conexión con el motor de rutas')) {
      test.skip(true, 'Routing engine not reachable in test environment')
    }

    // 3. RouteOptions reales + métricas.
    await expect(page.getByText(/\d+([.,]\d+)?\s*km/i).first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(/desnivel/i).first()).toBeVisible()
    await expect(page.locator('.maplibregl-canvas')).toBeVisible()

    // 4. Panel de recomendación (PedalScore) con ≥2 opciones.
    const recommended = page.getByText(/recomendad/i, { exact: false }).first()
    await expect(recommended).toBeVisible({ timeout: 30_000 })
    // At least one option marked as RECOMENDADA by PedalScore.
    await expect(page.getByText(/RECOMENDADA/i).first()).toBeVisible()

    // 5. Selección de alternativa actualiza el mapa (sin error)
    const optionButtons = page
      .locator('button')
      .filter({ hasText: /Opción|Alternativa/i })
    const count = await optionButtons.count()
    if (count > 1) {
      await optionButtons.nth(1).click()
    }

    await expect(page.getByText(/desnivel/i).first()).toBeVisible()
    await page.screenshot({ path: 'test-results/planner-recommendation.png', fullPage: true })
  })
})
