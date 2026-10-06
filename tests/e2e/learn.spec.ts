import { expect, type Page, test } from '@playwright/test'
import { openApp } from './helpers'

const pad = (page: Page, move: string) =>
  page.getByRole('group', { name: 'Face moves' }).getByRole('button', { name: move, exact: true }).click()
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true }).click()

test('lesson 1 can be completed from start to finish', async ({ page }) => {
  await openApp(page, '#/learn')
  await expect(page.locator('.lesson-list li')).toHaveCount(4)
  await page.getByRole('link', { name: /Every move can be undone/ }).click()

  // Do: R then R'
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await pad(page, 'R')
  await pad(page, "R'")
  await expect(page.getByText('Solved again.')).toBeVisible()
  await next(page)

  // Notice: a wrong answer explains, the right one unlocks Next
  await page.getByRole('button', { name: 'It turned a different face' }).click()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'It cancelled R exactly' }).click()
  await next(page)

  // Name
  await expect(page.getByRole('heading', { name: 'Identity and inverse' })).toBeVisible()
  await page.getByText('Go deeper: the formal version').click()
  await next(page)

  // Explore: play R U, then undo it with U' R'
  await expect(page.locator('#sequence')).toHaveValue('R U')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await pad(page, "U'")
  await pad(page, "R'")
  await expect(page.getByText('Undone. The last move went first.')).toBeVisible()
  await next(page)

  // Prove: the inverse of R U F'
  await page.locator('#sequence').fill("F U' R'")
  await expect(page.getByText('Correct: R U F′ followed by your sequence does nothing.')).toBeVisible()
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.getByText('Lesson 1 complete')).toBeVisible()

  await page.getByRole('link', { name: /Next: Repeat until solved/ }).click()
  await expect(page.getByRole('heading', { name: 'Four quarter turns' })).toBeVisible()
  await page.goto('./#/learn')
  await expect(page.locator('.lesson-list li').first()).toContainText('Done')
})

test('prove steps accept correct answers in lessons 2 to 4', async ({ page }, info) => {
  test.skip(info.project.name !== 'laptop', 'Checks the answer logic once')
  for (const [id, answer, success] of [
    ['order', 'R2 U2', 'Order 6.'],
    ['commute', "U D U' D'", 'Yes: U and its partner never share a piece'],
    ['cycles', 'R U', 'A single 5-cycle of corners.'],
  ]) {
    await openApp(page, `#/learn/${id}`)
    // Jump to the last step: Skip where a step is unfinished, Next where it needs nothing.
    for (let i = 0; i < 4; i++) {
      const skip = page.getByRole('button', { name: 'Skip' })
      if (await skip.isVisible()) await skip.click()
      else await page.getByRole('button', { name: 'Next', exact: true }).click()
    }
    await page.locator('#sequence').fill(answer)
    await expect(page.getByText(success)).toBeVisible()
  }
})

test('help buttons explain each part', async ({ page }, info) => {
  await openApp(page, '#/play')
  const movesHelp = page.getByRole('button', { name: 'How to use: Moves' })
  await movesHelp.click()
  await expect(page.getByRole('note')).toContainText('quarter turn clockwise')
  // Laptops close it with Escape; touch screens tap the ? again.
  if (info.project.name === 'laptop') await page.keyboard.press('Escape')
  else await movesHelp.click()
  await expect(page.getByRole('note')).toBeHidden()
  await page.getByRole('button', { name: 'How to use: the cube' }).click()
  await expect(page.getByRole('note')).toContainText('Drag to rotate your view')

  await page.goto('./#/settings')
  await page.getByLabel(/Show the \? buttons/).uncheck()
  await expect(page.getByRole('button', { name: /How to use/ })).toHaveCount(0)
})
