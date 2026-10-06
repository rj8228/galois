import { expect, test } from '@playwright/test'

test('cube loads and the move pad turns it', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Galois' })).toBeVisible()
  await expect(page.getByText('Drag to rotate the view')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'R', exact: true }).click()
  await page.getByRole('button', { name: "U'", exact: true }).click()
  await expect(page.getByText("Your moves (2): R U'")).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('scramble uses the solver worker', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('Drag to rotate the view')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Scramble' }).click()
  await expect(page.getByText(/^Scramble: /)).toBeVisible({ timeout: 30_000 })
})
