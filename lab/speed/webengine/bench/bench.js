// window.bench: the API scripts/run-browser.mjs drives. Two engines behind one solve():
//   shared  core-shared.wasm on one shared memory (needs crossOriginIsolated), optional ceiling worker
//   copies  T5's engine (core-t5.wasm, one private copy of the tables per worker), the fallback
import { ensureIsolation } from './coi.js'
import { MOVENAMES, floorTables } from './engine.js'
import { Pool, buildMissing } from './pool.js'
import { SharedPool } from './shared-pool.js'
import * as store from './store.js'

const logEl = document.getElementById('log')
const log = (s) => {
  logEl.textContent += `${s}\n`
}

const isolation = await ensureIsolation()
log(`crossOriginIsolated ${self.crossOriginIsolated} (${JSON.stringify(isolation)})`)

let t5wasm = null
let sharedModule = null
let pool = null
let mode = null

const t5bytes = async () => (t5wasm ??= await (await fetch(new URL('./core-t5.wasm', import.meta.url))).arrayBuffer())
const shared = async () => (sharedModule ??= await WebAssembly.compileStreaming(fetch(new URL('./core-shared.wasm', import.meta.url))))

window.bench = {
  isolation: () => ({ ...isolation, crossOriginIsolated: self.crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined', controlled: !!navigator.serviceWorker?.controller }),
  /** Builds a floor's missing tables with T5's builder worker into IndexedDB. */
  async build(floor) {
    const have = await store.keys()
    const t0 = performance.now()
    const r = await buildMissing(floorTables(floor), await t5bytes(), have)
    log(`build ${floor}: ${JSON.stringify(r.map((x) => [x.table, Math.round(x.build_ms)]))}`)
    return { tables: r, total_ms: performance.now() - t0 }
  },
  keys: () => store.keys(),
  /** mode 'shared' | 'race' | 'copies' | 'auto' (shared if isolated, else copies); n provers. */
  async setup(floor, n, m = 'auto') {
    if (pool) pool.terminate()
    if (m === 'auto') m = self.crossOriginIsolated ? 'shared' : 'copies'
    if (m !== 'copies' && !self.crossOriginIsolated) throw new Error('shared memory needs crossOriginIsolated')
    mode = m
    const t0 = performance.now()
    if (m === 'copies') {
      pool = await Pool.create(n, await t5bytes())
      const loads = await pool.load(floorTables(floor), floor)
      return { mode, total_ms: performance.now() - t0, loads, hardwareConcurrency: navigator.hardwareConcurrency }
    }
    const module = await shared()
    pool = await SharedPool.create(n, module, { tables: floorTables(floor), floor, race: m === 'race' })
    log(`setup ${m} ${floor} x${n}: ${Math.round(performance.now() - t0)} ms`)
    return { mode, total_ms: performance.now() - t0, load: pool.loadInfo, hardwareConcurrency: navigator.hardwareConcurrency }
  },
  async solve(scramble, opts) {
    if (mode === 'copies') return { mode, ...(await pool.solve(scramble, opts)) }
    const r = await pool.solve(scramble, opts)
    const { verified } = await pool.provers[0].call('check', { path: r.path })
    return { mode, ...r, solution: r.path.map((m) => MOVENAMES[m]).join(' '), verified }
  },
  memory: async () => (mode === 'copies' ? pool.memory() : [pool.memoryBytes()]),
  teardown() {
    if (pool) pool.terminate()
    pool = null
  },
}
log('ready')
