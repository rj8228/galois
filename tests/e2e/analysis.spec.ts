import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('analysis shows cycles, invariants and a tracked piece', async ({ page }) => {
  await openApp(page, '#/play')
  await page.locator('#sequence').fill("R U R' U'")
  await expect(page.locator('.big-number')).toHaveText('6')
  await expect(page.getByText('4/8 corners')).toBeVisible()
  await expect(page.getByText('UR → UB → FR ↺')).toBeVisible()
  await expect(page.getByText('always balanced')).toBeVisible()

  await page.getByRole('button', { name: 'Stickers' }).click()
  await expect(page.getByText(/stickers move, in/)).toBeVisible()

  await page.getByLabel(/Follow one piece/).selectOption({ label: 'UFR' })
  await expect(page.locator('.path li')).toHaveCount(5)
  await expect(page.locator('.path li').nth(1)).toContainText('URB')
})

test('focus mode can be switched on and off', async ({ page }) => {
  await openApp(page, '#/play')
  const focus = page.getByLabel(/Focus: dim every piece/)
  await focus.check()
  await expect(page.getByText('Focus works from a solved cube.')).toBeVisible()
  await focus.uncheck()
  await expect(page.getByText('Focus works from a solved cube.')).toBeHidden()
})
