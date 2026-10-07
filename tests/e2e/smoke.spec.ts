import { expect, test } from '@playwright/test'
import { expectNoSidewaysScroll, openApp } from './helpers'

test('cube loads and the move pad turns it', async ({ page }) => {
  await openApp(page, '#/play')
  await page.getByRole('button', { name: 'R', exact: true }).click()
  await page.getByRole('button', { name: "U'", exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your moves (2)' })).toBeVisible()
  await expect(page.locator('.history')).toHaveText("R U'")
  await expectNoSidewaysScroll(page)
})

test('scramble uses the solver worker', async ({ page }) => {
  await openApp(page, '#/play')
  await page.getByRole('button', { name: 'Scramble' }).click()
  await expect(page.getByText(/^Scramble: /)).toBeVisible({ timeout: 30_000 })
})

test('playing a sequence shows its order and adds it to the history', async ({ page }) => {
  await openApp(page, '#/play')
  await page.locator('#sequence').fill('R U')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.big-number')).toHaveText('105')
  await expect(page.locator('.history')).toHaveText('R U')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.history')).toHaveText('R')
})

test('invalid notation shows an error and disables Play', async ({ page }) => {
  await openApp(page, '#/play')
  await page.locator('#sequence').fill('hello')
  await expect(page.locator('.field-error')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()
})

test('every section opens from the navigation', async ({ page }) => {
  await openApp(page)
  for (const [name, text] of [
    ['Learn', 'Learn group theory by turning'],
    ['Labs', 'Challenges with no single answer'],
    ['Daily', 'Solve of the Day #'],
    ['Decode', 'Famous algorithms, taken apart'],
    ['Home', 'Turn first, name it later'],
  ]) {
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name }).click()
    await expect(page.getByText(text)).toBeVisible()
    await expectNoSidewaysScroll(page)
  }
  await page.getByRole('link', { name: 'About Galois' }).click()
  await expect(page.getByRole('heading', { name: 'Évariste Galois, 1811–1832' })).toBeVisible()
})

test('a chosen look applies and survives a reload', async ({ page }) => {
  await openApp(page, '#/settings')
  await page.getByRole('button', { name: /Blueprint/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'blueprint')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'blueprint')
  await expectNoSidewaysScroll(page)
})

test('Settings shows the version and can force an update', async ({ page }) => {
  await openApp(page, '#/settings')
  await expect(page.getByText(/You're running Galois v\d+\.\d+\.\d+/)).toBeVisible()
  await page.getByRole('button', { name: 'Update now' }).click()
  await expect(page.getByText('Drag to rotate the view')).toBeVisible({ timeout: 20_000 })
})
