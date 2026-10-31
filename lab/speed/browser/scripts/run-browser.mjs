// Drives bench/index.html in headless Chromium (Playwright) and writes data/browser/*.json.
//
//   node scripts/run-browser.mjs build                         cold build of both floor sets into IndexedDB,
//                                                              then a cached load in a fresh page
//   node scripts/run-browser.mjs solve <floor> <set> <workers> [count] [sd] [maxnodes]
//
// <set> is a file in lab/3x3/scrambles (moves-12, moves-14, ...) or in data/ (moves-16-first10, ...).
// The Chromium profile (and so the IndexedDB table cache) lives in data/chrome-profile.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { serve } from './serve.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const here = join(dirname(fileURLToPath(import.meta.url)), '..')
const profile = join(here, 'data', 'chrome-profile')
const outDir = join(here, 'data', 'browser')
mkdirSync(outDir, { recursive: true })

const FLOORS = ['C8s@2+E6x8@2', 'C8s+P1x3i']
const slug = (f) => f.replace(/[@+]/g, '_')

function scrambles(set) {
  const a = join(here, '..', '..', '3x3', 'scrambles', `${set}.txt`)
  const b = join(here, 'data', `${set}.txt`)
  return readFileSync(existsSync(a) ? a : b, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
}

/** Proportional set size of every Chromium process, summed (Linux), in bytes. */
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

async function open(fresh) {
  if (fresh) rmSync(profile, { recursive: true, force: true })
  const server = await serve(8125) // fixed port: IndexedDB is per origin, and the origin includes the port
  const ctx = await chromium.launchPersistentContext(profile, { headless: true })
  const page = await ctx.newPage()
  page.on('console', (m) => process.stderr.write(`[page] ${m.text()}\n`))
  page.on('pageerror', (e) => process.stderr.write(`[pageerror] ${e}\n`))
  const url = `http://127.0.0.1:${server.address().port}/speed/browser/bench/index.html`
  await page.goto(url)
  await page.waitForFunction(() => window.bench)
  return { server, ctx, page, url }
}

const browserVersion = async (ctx) => ctx.browser()?.version() ?? null

const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'build') {
  const { server, ctx, page, url } = await open(true)
  const builds = {}
  for (const f of FLOORS) builds[f] = await page.evaluate((f) => window.bench.build(f), f)
  // Cached path: a fresh page in the same profile reads the tables back from IndexedDB.
  await page.close()
  const loads = {}
  for (const f of FLOORS) {
    const p2 = await ctx.newPage()
    await p2.goto(url)
    await p2.waitForFunction(() => window.bench)
    loads[f] = await p2.evaluate((f) => window.bench.setup(f, 1), f)
    await p2.evaluate(() => window.bench.teardown())
    await p2.close()
  }
  const out = { kind: 'build', when: new Date().toISOString(), chromium: await browserVersion(ctx), builds, cached_loads: loads }
  writeFileSync(join(outDir, 'build.json'), `${JSON.stringify(out, null, 1)}\n`)
  console.log(JSON.stringify({ builds: Object.fromEntries(Object.entries(builds).map(([f, b]) => [f, b.tables.map((t) => [t.table, Math.round(t.build_ms), Math.round(t.store_ms)])])), loads: Object.fromEntries(Object.entries(loads).map(([f, l]) => [f, Math.round(l.total_ms)])) }))
  await ctx.close()
  server.close()
} else if (cmd === 'solve') {
  const [floor, set, workersS, countS, sdS, maxnodesS] = args
  const workers = +workersS
  const sd = sdS ? +sdS : 2
  const maxnodes = maxnodesS ? +maxnodesS : 3e9
  const list = scrambles(set).slice(0, countS && countS !== 'all' ? +countS : undefined)
  const { server, ctx, page } = await open(false)
  const before = chromiumPss()
  const setup = await page.evaluate(([f, n]) => window.bench.setup(f, n), [floor, workers])
  const loaded = chromiumPss()
  const solves = []
  let peak = loaded.total
  for (const [i, s] of list.entries()) {
    const r = await page.evaluate(([s, o]) => window.bench.solve(s, o), [s, { sd, maxnodes }])
    const pss = chromiumPss().total
    if (pss > peak) peak = pss
    solves.push({ index: i, scramble: s, ...r })
    process.stderr.write(`  #${i} len ${r.length} nodes ${r.nodes} ${Math.round(r.found_ms ?? r.drain_ms)} ms${r.dnf ? ' DNF' : ''}\n`)
  }
  const wasmMemory = await page.evaluate(() => window.bench.memory())
  const out = {
    kind: 'solve',
    when: new Date().toISOString(),
    chromium: await browserVersion(ctx),
    floor,
    set,
    workers,
    sd: workers > 1 ? sd : null,
    maxnodes,
    setup,
    wasm_memory_per_worker: wasmMemory,
    chromium_pss: { before_setup: before.total, after_setup: loaded.total, peak, procs_after_setup: loaded.procs },
    solves,
  }
  writeFileSync(join(outDir, `${slug(floor)}__${set}__${workers}w${workers > 1 ? `_sd${sd}` : ''}.json`), `${JSON.stringify(out, null, 1)}\n`)
  const ok = solves.filter((s) => !s.dnf)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
  console.log(`${floor} ${set} ${workers}w: ${ok.length}/${solves.length} solved, mean ${mean(ok.map((s) => s.found_ms)).toFixed(1)} ms, mean nodes ${Math.round(mean(ok.map((s) => s.nodes)))}, wasm mem ${wasmMemory.map((m) => (m / 1e6).toFixed(0)).join('+')} MB, PSS ${(loaded.total / 1e6).toFixed(0)} MB (peak ${(peak / 1e6).toFixed(0)})`)
  await page.evaluate(() => window.bench.teardown())
  await ctx.close()
  server.close()
} else {
  console.error('usage: run-browser.mjs build | solve <floor> <set> <workers> [count] [sd] [maxnodes]')
  process.exit(2)
}
