import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { expect, test } from '@playwright/test'

// The other tests block service workers so each one sees a fresh build. That also means none of
// them ever performs an upgrade, which is how a stale worker once shipped unnoticed (see
// learnings/2026-10-07-stale-service-worker.md). This test lets the worker run: it installs build A,
// swaps the server over to build B, and checks that the page reaches B after one reload.

const PORT = 4180
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
}

/** A static server for /galois/ whose root can be switched between builds. */
function serve(getRoot: () => string): Promise<Server> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    if (!path.startsWith('/galois/')) {
      res.writeHead(404).end()
      return
    }
    const rel = normalize(path.slice('/galois/'.length) || 'index.html')
    try {
      const body = readFileSync(join(getRoot(), rel.endsWith('/') ? `${rel}index.html` : rel))
      res.writeHead(200, {
        'content-type': TYPES[extname(rel)] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
      })
      res.end(body)
    } catch {
      res.writeHead(404).end()
    }
  })
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)))
}

/** Build B: build A with a marker in index.html and the matching precache revision in sw.js. */
function makeBuildB(dir: string) {
  cpSync('dist', dir, { recursive: true })
  const html = join(dir, 'index.html')
  writeFileSync(html, readFileSync(html, 'utf8').replace('<head>', '<head><meta name="galois-build" content="B">'))
  const sw = join(dir, 'sw.js')
  const updated = readFileSync(sw, 'utf8').replace(/(url:"index\.html",revision:")[^"]+"/, '$1build-b"')
  if (!updated.includes('revision:"build-b"')) throw new Error('index.html not found in the sw.js precache list')
  writeFileSync(sw, updated)
}

test.describe('with the service worker running', () => {
  test.use({ serviceWorkers: 'allow' })

  test('a new version replaces the cached one after one reload', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'laptop', 'One device is enough: the worker logic is the same on all three')

    const buildB = mkdtempSync(join(tmpdir(), 'galois-build-b-'))
    makeBuildB(buildB)
    let root = 'dist'
    const server = await serve(() => root)
    const marker = page.locator('meta[name="galois-build"]')

    try {
      // Build A installs its worker and takes control of the page.
      await page.goto(`http://localhost:${PORT}/galois/`)
      await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 })
      await expect(marker).toHaveCount(0)

      // Deploy build B. One reload is served from A's cache, finds B, and B reloads the page onto itself.
      root = buildB
      await page.reload()
      await expect(marker).toHaveCount(1, { timeout: 30_000 })
    } finally {
      server.close()
      rmSync(buildB, { recursive: true, force: true })
    }
  })
})

test('the app says when it has updated itself', async ({ page }) => {
  // Pretend this device last ran an older version.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('galois.version', 'v0.0.1')
      sessionStorage.setItem('seeded', '1')
    }
  })
  await page.goto('./')
  await expect(page.getByRole('status').filter({ hasText: /^Updated to v\d/ })).toBeVisible()
  await expect(page.getByRole('link', { name: "What's new" })).toHaveAttribute('href', /releases\/tag\/v\d/)

  // The next visit on the same version says nothing.
  await page.reload()
  await expect(page.getByText('Drag to rotate the view')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('status').filter({ hasText: /^Updated to/ })).toHaveCount(0)
})
