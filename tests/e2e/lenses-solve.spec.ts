import { expect, type Page, test } from '@playwright/test'
import { expectNoSidewaysScroll, openApp } from './helpers'

/** Plays a sequence on the Play stage, then opens a lens from the lens bar. */
async function playThenOpen(page: Page, moves: string, lens: string) {
  await openApp(page, '#/play')
  await page.locator('#sequence').fill(moves)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.history')).toHaveText(moves)
  await page.getByRole('group', { name: 'Lenses' }).getByRole('button', { name: lens, exact: true }).click()
}

const SUNE = "R U R' U R U2 R'"

test('Progress counts the pieces home after a known sequence', async ({ page }) => {
  await playThenOpen(page, SUNE, 'Progress')
  await expect(page.getByTestId('progress-home')).toHaveText('13 / 20')
  await expect(page.getByTestId('progress-top')).toHaveText('1/8')
  await expect(page.getByTestId('progress-middle')).toHaveText('4/4')
  await expect(page.getByTestId('progress-bottom')).toHaveText('8/8')
  await expect(page.getByTestId('progress-advice')).toContainText('Two layers done')
  await expectNoSidewaysScroll(page)
  await page.getByRole('button', { name: 'Open the Top lens' }).click()
  await expect(page.getByTestId('top-sum')).toBeVisible()
})

test('Top shows the twists, their sum and the named case', async ({ page }) => {
  await playThenOpen(page, SUNE, 'Top')
  await expect(page.getByTestId('top-twists')).toContainText('UBL')
  await expect(page.getByTestId('top-sum')).toHaveText('= 3')
  await expect(page.getByTestId('top-case')).toContainText('Antisune')
  await expect(page.getByRole('img', { name: /only the top colour shown/ })).toBeVisible()
  await expectNoSidewaysScroll(page)
})

test('Home draws the loops and finds a proven solution', async ({ page }) => {
  await playThenOpen(page, SUNE, 'Home')
  await expect(page.getByTestId('home-corners')).toContainText('two swaps')
  await expect(page.getByTestId('home-edges')).toContainText('UR → UL → UB')
  await expect(page.getByText('Shortest, proven')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('home-length')).toHaveText('7 moves')
  await expectNoSidewaysScroll(page)
  await page.getByRole('button', { name: 'Play it on the cube' }).click()
  await page.getByRole('group', { name: 'Lenses' }).getByRole('button', { name: 'Progress', exact: true }).click()
  await expect(page.getByTestId('progress-home')).toHaveText('20 / 20', { timeout: 15_000 })
})

/** Opens a lesson at a given step, as if the reader had already reached it. */
async function openStep(page: Page, lesson: string, title: string, reached: number) {
  await page.addInitScript(
    ([id, n]) => localStorage.setItem('galois.progress.v1', JSON.stringify({ [id]: { reached: n, complete: false } })),
    [lesson, reached] as const,
  )
  await openApp(page, `#/learn/${lesson}`)
  await page
    .getByRole('list', { name: 'Steps' })
    .getByRole('button', { name: new RegExp(title) })
    .click()
}

test('Graph renders in lesson 9 and explores the subgroup', async ({ page }) => {
  await openStep(page, 'subgroups', '4 Explore', 4)
  await expect(page.getByTestId('graph-positions')).toHaveText('12')
  await expect(page.getByTestId('graph-furthest')).toHaveText('6')
  await expect(page.getByTestId('graph-order')).toHaveText('6')
  await expect(page.getByTestId('graph-path')).toHaveText('R2 U2 R2')
  await page.getByRole('button', { name: 'Solved' }).click()
  await expect(page.getByTestId('graph-path')).toHaveText('solved')
  await page.getByRole('button', { name: 'Add a move' }).click()
  await page.getByRole('group', { name: 'Pick a move to add' }).getByRole('button', { name: 'F2', exact: true }).click()
  await expect(page.getByTestId('graph-positions')).not.toHaveText('12')
  await expectNoSidewaysScroll(page)
})

test('Far renders in lesson 12 with exact and estimated rings', async ({ page }) => {
  await openStep(page, 'gods-number', '3 Name', 2)
  await expect(page.getByText('574,908')).toBeVisible()
  await expect(page.getByText('the edge · proved 2010')).toBeVisible()
  await page.getByRole('button', { name: 'Show all 20 rings' }).click()
  await expect(page.getByText('91,365,146,187,124,313')).toBeVisible()
  await expect(page.getByRole('link', { name: 'cube20.org' })).toHaveAttribute('href', 'https://cube20.org/')
  await expect(page.getByRole('link', { name: 'Watch a solver search inward' })).toHaveAttribute('href', '#/solver')
  await expectNoSidewaysScroll(page)
})
