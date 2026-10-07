import { expect, test } from '@playwright/test'
import { expectNoSidewaysScroll, openApp } from './helpers'

test('a lab reveals hints one at a time and checks the answer live', async ({ page }) => {
  await openApp(page, '#/labs')
  await expect(page.locator('.lesson-list li')).toHaveCount(6)
  await page.getByRole('link', { name: /Flip two edges/ }).click()
  // Labs sit under Learn in the navigation.
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Learn' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await page.getByRole('button', { name: 'Show a hint' }).click()
  await expect(page.getByText(/^Hint 1\./)).toBeVisible()
  await expect(page.getByText(/^Hint 2\./)).toHaveCount(0)
  await page.getByRole('button', { name: 'Another hint' }).click()
  await page.getByRole('button', { name: 'Show the answer' }).click()
  await expect(page.getByText(/^Answer\./)).toBeVisible()

  await page.locator('#sequence').fill("M' U M' U M' U2 M U M U M U2")
  await expect(page.getByText('Two edges flipped, and the flips add up to zero')).toBeVisible()
  await expectNoSidewaysScroll(page)

  await page.goto('./#/labs')
  await expect(page.locator('.lesson-list li').filter({ hasText: 'Flip two edges' })).toContainText('Solved')
})

test('Decode takes Niklas apart and links to its lessons', async ({ page }) => {
  await openApp(page, '#/decode')
  await page.getByRole('link', { name: /Niklas/ }).click()
  await expect(page.locator('#sequence')).toHaveValue("R U' L' U R' U' L U")
  await expect(page.getByRole('list', { name: 'Parts' }).getByRole('button')).toHaveCount(4)
  await expect(page.locator('.shape')).toHaveText("[R, [U': L']]")
  await expectNoSidewaysScroll(page)
  await page.getByRole('link', { name: /lesson 6, Conjugates/ }).click()
  await expect(page.getByRole('heading', { name: /Lesson 6/ })).toBeVisible()

  // Tapping a part plays the algorithm from solved up to the end of that part.
  await page.goto('./#/decode/niklas')
  await page.getByRole('button', { name: /Play up to the end of Y = \[U': L'\]/ }).click()
  await page.evaluate(() => {
    location.hash = '#/play'
  })
  await expect(page.locator('.history')).toHaveText("R U' L' U")
})

test('the analysis panel names a sequence’s shape', async ({ page }) => {
  await openApp(page, '#/play')
  await page.locator('#sequence').fill("F R U R' U' F'")
  await expect(page.locator('.shape')).toHaveText('[F: [R, U]]')
  await page.locator('#sequence').fill('R U')
  await expect(page.getByText('No commutator or conjugate shape')).toBeVisible()
})
