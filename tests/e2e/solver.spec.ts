import { expect, type Page, test } from '@playwright/test'
import { expectNoSidewaysScroll } from './helpers'

async function openSolver(page: Page) {
  await page.goto('./#/solver')
  await expect(page.getByRole('button', { name: 'Solve it' })).toBeEnabled({ timeout: 30_000 })
}

test('proves the shortest solution of a hardest position', async ({ page }) => {
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

test('plays a solution in slow motion to the end', async ({ page }) => {
  await openSolver(page)
  await page.locator('#solver-moves').fill("R U2 F'")
  await page.getByRole('button', { name: 'Use' }).click()
  await page.getByRole('button', { name: 'Solve it' }).click()
  await expect(page.locator('.result .big-number')).toHaveText('3', { timeout: 30_000 })
  await expect(page.locator('.stage-hint')).toHaveText('Solved in 3', { timeout: 30_000 })
  await expect(page.locator('.solution-moves .done')).toHaveCount(3)
})

test('typed moves, scrambles and the move pad set the position', async ({ page }) => {
  await openSolver(page)
  await page.getByRole('button', { name: '10 moves' }).click()
  await expect(page.getByText('10 random moves:')).toBeVisible()
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

test('the whole-cube view explains the framework without solving anything', async ({ page }) => {
  await openSolver(page)
  await page.getByRole('button', { name: 'The whole cube', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All 3,674,160 positions' })).toBeVisible()
  await expect(page.locator('svg.field')).toBeVisible()
  await expect(page.getByText('0 mismatches')).toBeVisible()
  await expect(page.getByRole('group', { name: '2×2 face moves' })).toHaveCount(0)
  await expectNoSidewaysScroll(page)
  await page.getByRole('button', { name: 'Try one yourself' }).click()
  await expect(page.getByRole('heading', { name: 'Watch an optimal solve' })).toBeVisible()
})
