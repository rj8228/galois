// window.bench: the API scripts/run-browser.mjs drives through Playwright.
import { floorTables } from './engine.js'
import { Pool, buildMissing } from './pool.js'
import * as store from './store.js'

const logEl = document.getElementById('log')
const log = (s) => {
  logEl.textContent += `${s}\n`
}

let wasm = null
let pool = null

async function wasmBytes() {
  if (!wasm) wasm = await (await fetch(new URL('./core.wasm', import.meta.url))).arrayBuffer()
  return wasm
}

window.bench = {
  /** Builds a floor's missing tables (in a builder worker) into IndexedDB; returns per-table timings. */
  async build(floor) {
    const have = await store.keys()
    const t0 = performance.now()
    const r = await buildMissing(floorTables(floor), await wasmBytes(), have)
    log(`build ${floor}: ${JSON.stringify(r.map((x) => [x.table, Math.round(x.build_ms)]))}`)
    return { tables: r, total_ms: performance.now() - t0 }
  },
  keys: () => store.keys(),
  clear: () => store.clear(),
  /** Starts n prover workers and loads the floor's tables into each (one copy per worker). */
  async setup(floor, n) {
    if (pool) pool.terminate()
    const t0 = performance.now()
    pool = await Pool.create(n, await wasmBytes())
    const t1 = performance.now()
    const loads = await pool.load(floorTables(floor), floor)
    log(`setup ${floor} x${n}: ${Math.round(performance.now() - t0)} ms`)
    return { init_ms: t1 - t0, total_ms: performance.now() - t0, loads, hardwareConcurrency: navigator.hardwareConcurrency }
  },
  async solve(scramble, opts) {
    return pool.solve(scramble, opts)
  },
  memory: () => pool.memory(),
  teardown() {
    if (pool) pool.terminate()
    pool = null
  },
  crossOriginIsolated: () => self.crossOriginIsolated,
}
log('ready')
