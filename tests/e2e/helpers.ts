import { expect, type Page } from '@playwright/test'

export async function openApp(page: Page, path = '') {
  await page.goto(`./${path}`)
  await expect(page.getByText('Drag to rotate the view')).toBeVisible({ timeout: 20_000 })
}

export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}
