import { expect, type Page, test } from '@playwright/test'
import { expectNoSidewaysScroll } from './helpers'

async function openSolver(page: Page) {
  await page.goto('./#/solver')
  await expect(page.getByRole('button', { name: 'Solve it' })).toBeEnabled({ timeout: 30_000 })
}

test('proves and plays the shortest solution of a hardest position', async ({ page }) => {
  await openSolver(page)
  await page.getByRole('button', { name: 'Hardest (11 moves)' }).click()
  await expect(page.getByText('One of the 2,644 hardest positions:')).toBeVisible()
  await page.getByRole('button', { name: 'Solve it' }).click()
  await expect(page.getByText('proven shortest')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.result .big-number')).toHaveText('11')
  await expect(page.locator('.solution-moves li')).toHaveCount(11)
  await expect(page.locator('.round-found')).toContainText('found an 11-move solution')
  await expectNoSidewaysScroll(page)
})

test('typed moves and the move pad set the position', async ({ page }) => {
  await openSolver(page)
  const input = page.locator('#solver-moves')
  await input.fill('M')
  await expect(page.locator('.field-error')).toBeVisible()
  await input.fill("R U R' U'")
  await page.getByRole('button', { name: 'Use' }).click()
  await expect(page.getByText('Your moves:')).toBeVisible()
  await page.getByRole('group', { name: '2×2 face moves' }).getByRole('button', { name: 'F', exact: true }).click()
  await expect(page.locator('.scramble-text')).toHaveText("R U R' U' F")
  await page.getByRole('button', { name: 'Strong' }).click()
  await page.getByRole('button', { name: 'Solve it' }).click()
  await expect(page.getByText('proven shortest')).toBeVisible({ timeout: 30_000 })
  const length = Number(await page.locator('.result .big-number').innerText())
  await expect(page.locator('.solution-moves li')).toHaveCount(length)
})
