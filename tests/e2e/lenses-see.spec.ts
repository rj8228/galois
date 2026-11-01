import { expect, test } from '@playwright/test'
import { expectNoSidewaysScroll, openApp } from './helpers'

const lens = (page: import('@playwright/test').Page) => page.locator('.lens-view')

test('on Play, each See lens shows its drawing and key numbers for R U', async ({ page }) => {
  await openApp(page, '#/play')
  const bar = page.getByRole('group', { name: 'Lenses' })

  await bar.getByRole('button', { name: 'Net', exact: true }).click()
  await expect(lens(page).getByRole('img', { name: /unfolded flat after R U/ })).toBeVisible()
  await expect(lens(page).locator('.lens-stat').nth(0)).toContainText('32stickers move')
  await expect(lens(page).locator('.lens-stat').nth(1)).toContainText('22')
  await expect(lens(page).locator('.lens-stat').nth(2)).toContainText('105')
  await expectNoSidewaysScroll(page)

  await bar.getByRole('button', { name: 'Rings', exact: true }).click()
  await expect(lens(page).getByRole('img', { name: /a 7-cycle of edges/ })).toBeVisible()
  await expect(lens(page).getByText('order = lcm(7, 15, 3) = 105')).toBeVisible()
  await expect(lens(page).getByText('UFR twists alone')).toBeVisible()
  await expectNoSidewaysScroll(page)

  await bar.getByRole('button', { name: 'Path', exact: true }).click()
  await expect(lens(page).getByText('Tracking URB')).toBeVisible()
  await expect(lens(page).locator('.path-chip')).toHaveText(['URB', 'DBR', 'DRF', 'ULF', 'UBL', 'URB ↻'])
  await expect(lens(page).locator('.lens-stat').nth(1)).toContainText('× 3')
  await expect(lens(page).locator('.lens-stat').nth(2)).toContainText('15')
  // Tapping another piece follows it instead.
  await lens(page).getByRole('button', { name: 'Follow UFR' }).click()
  await expect(lens(page).getByText('Tracking UFR')).toBeVisible()
  await expectNoSidewaysScroll(page)
})

test('the See lenses follow the sequence box, and say so plainly when it is empty', async ({ page }) => {
  await openApp(page, '#/play')
  await page.getByRole('group', { name: 'Lenses' }).getByRole('button', { name: 'Net', exact: true }).click()
  await page.locator('#sequence').fill('R')
  await expect(lens(page).locator('.lens-stat').nth(0)).toContainText('20')
  await expect(lens(page).getByText('Order 4')).toBeVisible()
  await page.locator('#sequence').fill('')
  await expect(lens(page).getByText('Type a sequence in the box below to see it here.')).toBeVisible()
})

test('in Decode, tapping a Tree box plays just that part', async ({ page }) => {
  await page.goto('./#/decode/niklas')
  const tree = page.getByRole('region', { name: 'Tree' })
  await expect(tree.getByText('[R, [U′: L′]]').first()).toBeVisible({ timeout: 20_000 })
  // The stage's cube must be ready before a part can play.
  await expect(page.getByText('Drag to rotate the view')).toBeVisible({ timeout: 20_000 })
  await expectNoSidewaysScroll(page)

  await tree.getByRole('button', { name: /^Play A · set up/ }).click()
  await tree.getByRole('button', { name: /^Play Y · Conjugate/ }).click()
  await expect(tree.getByText('PLAYING · Y = U′ L′ U')).toBeVisible()
  // Each tap plays from solved, so the moves made are just that part.
  await page.evaluate(() => {
    location.hash = '#/play'
  })
  await expect(page.locator('.history')).toHaveText("U' L' U")
})
