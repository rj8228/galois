import { expect, type Page, test } from '@playwright/test'
import { expectNoSidewaysScroll, openApp } from './helpers'

async function openPaper(page: Page) {
  await page.goto('./#/paper')
  await expect(page.getByRole('heading', { name: /Proving the shortest solve/ })).toBeVisible({ timeout: 20_000 })
}

test('the paper reads as one column with its figures and tables, and no cube', async ({ page }) => {
  await openPaper(page)
  await expect(page.getByRole('heading', { name: 'Abstract' })).toBeVisible()
  await expect(page.locator('.stage')).toBeHidden()
  await expect(page.locator('.paper-figure')).toHaveCount(7)
  await expect(page.locator('.paper-table')).toHaveCount(5)
  await expect(page.locator('.theorem')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'References' })).toBeAttached()
  await expectNoSidewaysScroll(page)
})

test('contents jump to a section', async ({ page }) => {
  await openPaper(page)
  await page
    .getByRole('navigation', { name: 'Contents' })
    .getByRole('button', { name: /A worked example/ })
    .click()
  const heading = page.getByRole('heading', { name: /A worked example/ })
  await expect(heading).toBeFocused()
  await expect(heading).toBeInViewport()
})

test('a chart column shows its count on hover and on keyboard focus', async ({ page }) => {
  await openPaper(page)
  const column = page.getByLabel('9 moves: 1,887,748 positions, 51.4%')
  await column.scrollIntoViewIfNeeded()
  await column.hover()
  await expect(page.locator('.chart-tip')).toContainText('1,887,748 positions')
  await page.getByLabel('11 moves: 2,644 positions, 0.07%').focus()
  await expect(page.locator('.chart-tip')).toContainText('2,644 positions')
  await page.getByLabel(/^Jul 1981: at most 52 moves/).focus()
  await expect(page.locator('.chart-tip')).toContainText('52 moves at most')
  await page.getByLabel(/^Jan 1995: at least 20 moves/).focus()
  await expect(page.locator('.chart-tip')).toContainText('superflip')
})

test('the worked example opens in the Solver and reproduces the rounds', async ({ page }) => {
  await openPaper(page)
  await page.getByRole('button', { name: 'Watch this solve in the Solver' }).click()
  await expect(page.getByRole('heading', { name: 'Watch an optimal solve' })).toBeVisible()
  await expect(page.getByText("The Paper's worked example:")).toBeVisible()
  await expect(page.locator('.scramble-text')).toHaveText("F R' F' U2 F U' F2 R F2 R' U2")
  await expect(page.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Solve it' }).click({ timeout: 30_000 })
  await expect(page.getByText('proven shortest')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.round-log li').first()).toContainText('At least 6')
  await expect(page.locator('.round-log li')).toHaveCount(6)
})

test('cube shortcuts are off while reading', async ({ page }) => {
  await openApp(page, '#/play')
  const nav = page.getByRole('navigation', { name: 'Sections' })
  await nav.getByRole('link', { name: 'Paper' }).click()
  await expect(page.getByRole('heading', { name: /Proving the shortest solve/ })).toBeVisible({ timeout: 20_000 })
  await page.keyboard.press('r')
  await page.keyboard.press('u')
  await nav.getByRole('link', { name: 'Play' }).click()
  await expect(page.getByRole('heading', { name: 'Your moves (0)' })).toBeVisible()
})
