import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('keyboard shortcuts turn faces and undo', async ({ page }, info) => {
  test.skip(info.project.name !== 'laptop', 'Keyboard shortcuts are for laptops')
  await openApp(page, '#/play')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('r')
  await page.keyboard.press('Shift+U')
  await page.keyboard.press('Alt+F')
  await expect(page.locator('.history')).toHaveText("R U' F2")
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.history')).toHaveText("R U'")
})

test('the notation keypad types moves on touch screens', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'The keypad shows on touch screens')
  await openApp(page, '#/play')
  await page.locator('#sequence').tap()
  const keypad = page.getByRole('group', { name: 'Notation keypad' })
  await expect(keypad).toBeVisible()
  await keypad.getByRole('button', { name: 'Clear' }).tap()
  await keypad.getByRole('button', { name: 'R', exact: true }).tap()
  await keypad.getByRole('button', { name: 'U', exact: true }).tap()
  await keypad.getByRole('button', { name: "'", exact: true }).tap()
  await expect(page.locator('#sequence')).toHaveValue("R U'")
  await keypad.getByRole('button', { name: 'Done' }).tap()
  await expect(keypad).toBeHidden()
})
