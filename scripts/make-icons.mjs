// Renders public/icons/*.png from public/favicon.svg. Run: node scripts/make-icons.mjs
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()

async function render(size, file, padding = 0) {
  await page.setViewportSize({ width: size, height: size })
  const inner = size - padding * 2
  await page.setContent(
    `<body style="margin:0;background:#1e2a25;display:grid;place-items:center;width:${size}px;height:${size}px">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
     </body>`,
  )
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname })
}

await render(192, 'icon-192.png')
await render(512, 'icon-512.png')
await render(512, 'icon-maskable-512.png', 64) // maskable icons need a safe zone
await render(180, 'apple-touch-icon.png')
await browser.close()
