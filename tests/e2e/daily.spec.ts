import { expect, type Page, test } from '@playwright/test'
import { openApp } from './helpers'

const inverse = (scramble: string) =>
  scramble
    .split(' ')
    .reverse()
    .map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : `${m}'`))

async function todaysScramble(page: Page) {
  await openApp(page, '#/daily')
  const text = page.locator('.scramble-text')
  await expect(text).toBeVisible({ timeout: 30_000 })
  return (await text.textContent()) ?? ''
}

test('a Speed attempt is timed, saved, and starts the streak', async ({ page }) => {
  const scramble = await todaysScramble(page)
  await page.getByRole('button', { name: 'Start attempt 1 of 3' }).click()
  await expect(page.getByText('Inspect. The clock starts with your first turn.')).toBeVisible()
  // While the clock runs, Reset and Play are blocked.
  await expect(page.getByRole('button', { name: 'Reset' })).toBeDisabled()
  const pad = page.getByRole('group', { name: 'Face moves' })
  for (const m of inverse(scramble)) await pad.getByRole('button', { name: m, exact: true }).click()
  await expect(page.getByText('Solved! Saved to today')).toBeVisible()
  await expect(page.locator('.attempts li').first()).not.toContainText('–')
  await expect(page.getByRole('button', { name: 'Start attempt 2 of 3' })).toBeEnabled()
  await expect(page.getByText(/^1\s*day now/)).toBeVisible()
  await expect(page.getByText('Badge earned:')).toBeVisible()
})

test('giving up records a DNF', async ({ page }) => {
  await todaysScramble(page)
  await page.getByRole('button', { name: 'Start attempt 1 of 3' }).click()
  await page.getByRole('button', { name: 'Give up' }).click()
  await expect(page.locator('.solve-time')).toHaveText('DNF')
  await expect(page.locator('.attempts li').first()).toContainText('DNF')
})

test('an Optimal solution is checked, submitted once, and compared with the solver', async ({ page }) => {
  const scramble = await todaysScramble(page)
  await page.getByRole('button', { name: 'Optimal', exact: true }).click()
  await page.locator('#solution').fill('R U')
  await expect(page.getByText("2 moves so far, but the cube isn't solved yet.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit' })).toBeDisabled()
  const solution = inverse(scramble)
  await page.locator('#solution').fill(solution.join(' '))
  await expect(page.getByText(`Solves the cube in ${solution.length} moves.`)).toBeVisible()
  await page.getByRole('button', { name: 'Submit' }).click()
  await page.getByRole('button', { name: 'Yes, submit' }).click()
  await expect(page.getByText('moves submitted')).toBeVisible()
  await expect(page.getByText('You matched the machine.')).toBeVisible()
  await expect(page.locator('.share')).toContainText(`Optimal ${solution.length} moves`)
})
