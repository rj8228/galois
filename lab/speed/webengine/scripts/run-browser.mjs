// Drives bench/index.html in headless Chromium (Playwright); writes data/browser/*.json.
// The server sends NO special headers (like GitHub Pages): isolation comes from bench/coi-sw.js.
//
//   node scripts/run-browser.mjs build                      tables into IndexedDB (fresh profile)
//   node scripts/run-browser.mjs isolation                  first visit / reload / ?nocoi, then a shared solve
//   node scripts/run-browser.mjs solve <mode> <floor> <set> <provers> [count] [sd] [maxnodes] [cap]
//        mode: shared | race (provers + 1 ceiling worker) | copies (T5's private copies)
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from './serve.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const here = join(dirname(fileURLToPath(import.meta.url)), '..')
const profile = join(here, 'data', 'chrome-profile')
const outDir = join(here, 'data', 'browser')
mkdirSync(outDir, { recursive: true })
const slug = (f) => f.replace(/[@+]/g, '_')

function scrambles(set) {
  const a = join(here, '..', '..', '3x3', 'scrambles', `${set}.txt`)
  const b = join(here, 'scrambles', `${set}.txt`)
  return readFileSync(existsSync(a) ? a : b, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
}

/** Proportional set size of every Chromium process, summed (Linux), in bytes (as T5). */
function chromiumPss() {
  let total = 0
  const procs = []
  for (const pid of readdirSync('/proc').filter((p) => /^\d+$/.test(p))) {
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8')
      if (!/chrom/i.test(cmd.split('\0')[0])) continue
      const m = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8').match(/^Pss:\s+(\d+) kB/m)
      if (!m) continue
      const type = (cmd.match(/--type=([a-z-]+)/) || [, 'browser'])[1]
      procs.push({ pid: +pid, type, pss: +m[1] * 1024 })
      total += +m[1] * 1024
    } catch {}
  }
  return { total, procs }
}

async function open({ fresh = false, query = '' } = {}) {
  if (fresh) rmSync(profile, { recursive: true, force: true })
  const server = await serve(8126) // fixed port: IndexedDB and the service worker are per origin
  const ctx = await chromium.launchPersistentContext(profile, { headless: true })
  const page = await ctx.newPage()
  page.on('console', (m) => process.stderr.write(`[page] ${m.text()}\n`))
  page.on('pageerror', (e) => process.stderr.write(`[pageerror] ${e}\n`))
  const url = `http://127.0.0.1:${server.address().port}/speed/webengine/bench/index.html${query}`
  await page.goto(url)
  await page.waitForFunction(() => window.bench, null, { timeout: 60000 })
  return { server, ctx, page, url }
}

const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'build') {
  const { server, ctx, page } = await open({ fresh: true })
  const builds = {}
  for (const f of ['C8s+P1x3i', 'C8s@2+E6x8@2']) builds[f] = await page.evaluate((f) => window.bench.build(f), f)
  writeFileSync(join(outDir, 'build.json'), `${JSON.stringify({ kind: 'build', when: new Date().toISOString(), chromium: ctx.browser()?.version() ?? null, builds }, null, 1)}\n`)
  console.log(JSON.stringify(Object.fromEntries(Object.entries(builds).map(([f, b]) => [f, Math.round(b.total_ms)]))))
  await ctx.close()
  server.close()
} else if (cmd === 'isolation') {
  // A fresh profile per case, so the first visit really is the first.
  const out = { kind: 'isolation', when: new Date().toISOString(), server_headers: 'none (no COOP/COEP)', cases: {} }
  for (const [name, query] of [['first-visit', ''], ['no-service-worker', '?nocoi']]) {
    rmSync(join(here, 'data', 'iso-profile'), { recursive: true, force: true })
    const server = await serve(8127)
    const ctx = await chromium.launchPersistentContext(join(here, 'data', 'iso-profile'), { headless: true })
    const page = await ctx.newPage()
    const navs = []
    page.on('framenavigated', (f) => f === page.mainFrame() && navs.push(f.url()))
    page.on('console', (m) => process.stderr.write(`[page] ${m.text()}\n`))
    const t0 = Date.now()
    await page.goto(`http://127.0.0.1:8127/speed/webengine/bench/index.html${query}`)
    await page.waitForFunction(() => window.bench, null, { timeout: 60000 })
    const iso = await page.evaluate(() => window.bench.isolation())
    const ready_ms = Date.now() - t0
    // Tables for a quick check: the phone set (12 s to build).
    await page.evaluate(() => window.bench.build('C8s@2+E6x8@2'))
    const setup = await page.evaluate(() => window.bench.setup('C8s@2+E6x8@2', 2, 'auto'))
    const s = scrambles('moves-12')[0]
    const solve = await page.evaluate((s) => window.bench.solve(s), s)
    // A second visit in the same profile: the service worker already controls it, no reload.
    const p2 = await ctx.newPage()
    const navs2 = []
    p2.on('framenavigated', (f) => f === p2.mainFrame() && navs2.push(f.url()))
    await p2.goto(`http://127.0.0.1:8127/speed/webengine/bench/index.html${query}`)
    await p2.waitForFunction(() => window.bench, null, { timeout: 60000 })
    const iso2 = await p2.evaluate(() => window.bench.isolation())
    out.cases[name] = { query, navigations: navs.length, ready_ms, isolation: iso, mode: setup.mode, solve: { scramble: s, length: solve.length, solution: solve.solution, verified: solve.verified }, second_visit: { navigations: navs2.length, isolation: iso2 } }
    console.log(name, JSON.stringify(out.cases[name]))
    await ctx.close()
    server.close()
  }
  writeFileSync(join(outDir, 'isolation.json'), `${JSON.stringify(out, null, 1)}\n`)
} else if (cmd === 'solve') {
  const [mode, floor, set, provS, countS, sdS, maxnodesS, capS] = args
  const n = +provS
  const sd = sdS ? +sdS : 2
  const maxnodes = maxnodesS ? +maxnodesS : 3e10
  const cap = capS ? +capS : 3600
  const list = scrambles(set).slice(0, countS && countS !== 'all' ? +countS : undefined)
  const { server, ctx, page } = await open()
  const iso = await page.evaluate(() => window.bench.isolation())
  const before = chromiumPss()
  const setup = await page.evaluate(([f, n, m]) => window.bench.setup(f, n, m), [floor, n, mode === 'race' ? 'race' : mode])
  const loaded = chromiumPss()
  let peak = loaded.total
  const solves = []
  for (const [i, s] of list.entries()) {
    const r = await page.evaluate(([s, o]) => window.bench.solve(s, o), [s, { sd, maxnodes, cap }])
    const pss = chromiumPss().total
    if (pss > peak) peak = pss
    solves.push({ index: i, scramble: s, ...r })
    process.stderr.write(`  #${i} len ${r.length} ${r.end ?? ''} nodes ${r.nodes} answer ${Math.round(r.found_ms ?? -1)} ms drain ${Math.round(r.drain_ms)} ms${r.dnf ? ' DNF' : ''}${r.verified ? '' : ' UNVERIFIED'}\n`)
  }
  const wasmMemory = await page.evaluate(() => window.bench.memory())
  const out = { kind: 'solve', engine: mode, when: new Date().toISOString(), chromium: ctx.browser()?.version() ?? null, isolation: iso, floor, set, provers: n, workers: n + (mode === 'race' ? 1 : 0), sd: n > 1 ? sd : null, maxnodes, cap: mode === 'race' ? cap : null, setup, wasm_memory: wasmMemory, chromium_pss: { before_setup: before.total, after_setup: loaded.total, peak, procs_after_setup: loaded.procs }, solves }
  const tag = mode === 'race' ? `race-${n}p1c` : mode === 'shared' ? `shared-${n}w` : `copies-${n}w`
  writeFileSync(join(outDir, `${tag}__${slug(floor)}__${set}${n > 1 ? `_sd${sd}` : ''}.json`), `${JSON.stringify(out, null, 1)}\n`)
  const ok = solves.filter((s) => !s.dnf)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
  console.log(`${tag} ${floor} ${set}: ${ok.length}/${solves.length} solved, mean answer ${mean(ok.map((s) => s.found_ms)).toFixed(1)} ms, mean drain ${mean(ok.map((s) => s.drain_ms)).toFixed(1)} ms, nodes ${Math.round(mean(ok.map((s) => s.nodes)))}, wasm mem ${wasmMemory.map((m) => (m / 1e6).toFixed(0)).join('+')} MB, PSS ${(loaded.total / 1e6).toFixed(0)} MB (peak ${(peak / 1e6).toFixed(0)})`)
  await page.evaluate(() => window.bench.teardown())
  await ctx.close()
  server.close()
} else {
  console.error('usage: run-browser.mjs build | isolation | solve <mode> <floor> <set> <provers> [count] [sd] [maxnodes] [cap]')
  process.exit(2)
}
