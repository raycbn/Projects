import { test, expect } from '@playwright/test'

test.describe('PedalMap smoke', () => {
  test('landing shows brand and CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/PedalMap|PEDALMAP/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Crear una ruta/i }).first()).toBeVisible()
  })

  test('planner page loads map panel controls', async ({ page }) => {
    await page.goto('/route-planner')
    await expect(page.getByRole('heading', { name: 'Crear ruta' })).toBeVisible()
    await expect(page.getByLabel('Inicio')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear ruta' })).toBeVisible()
  })
})
