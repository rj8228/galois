// Coordinator for a pool of workers (main thread). With one prover a whole solve runs inside the
// worker. With several, each bound past the first rounds is split like lab/3x3's CUBE3_SPLIT=sd:
// every prover collects the same list of depth-sd subtrees, and the coordinator hands out their
// indices one at a time to whichever prover is free.
//
// Workers hold private copies of the tables (no SharedArrayBuffer: GitHub Pages cannot send the
// COOP/COEP headers). A found solution cannot interrupt subtrees already running elsewhere, so the
// answer time (found_ms) is taken when the first solution arrives; drain_ms is when every worker is
// idle again (the next solve waits for that).

export class Worker1 {
  constructor(url) {
    this.w = new Worker(url, { type: 'module' })
    this.seq = 0
    this.pending = new Map()
    this.w.onmessage = ({ data }) => {
      const p = this.pending.get(data.id)
      this.pending.delete(data.id)
      if (data.ok) p.resolve(data)
      else p.reject(new Error(data.error))
    }
    this.w.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || 'worker error'))
      this.pending.clear()
    }
  }
  call(op, args = {}, transfer = []) {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.w.postMessage({ id, op, ...args }, transfer)
    })
  }
  terminate() {
    this.w.terminate()
  }
}

export class Pool {
  /** role: 'prover' (or 'ceiling' later). */
  static async create(n, wasm, role = 'prover') {
    const p = new Pool()
    p.workers = Array.from({ length: n }, () => new Worker1(new URL('./worker.js', import.meta.url)))
    await Promise.all(p.workers.map((w) => w.call('init', { wasm, role })))
    return p
  }

  async load(tables, floor) {
    return Promise.all(this.workers.map((w) => w.call('load', { tables, floor })))
  }

  async memory() {
    return (await Promise.all(this.workers.map((w) => w.call('memory')))).map((r) => r.memory)
  }

  terminate() {
    for (const w of this.workers) w.terminate()
  }

  async solve(scramble, { sd = 2, maxnodes = 3e9 } = {}) {
    if (this.workers.length === 1) {
      const t0 = performance.now()
      const r = await this.workers[0].call('solve', { scramble, maxnodes })
      return { ...r, found_ms: performance.now() - t0, drain_ms: performance.now() - t0, worker_ms: r.ms }
    }
    const t0 = performance.now()
    const roots = await Promise.all(this.workers.map((w) => w.call('root', { scramble })))
    const h0 = roots[0].h0
    const perBound = {}
    let nodes = 0
    let result = null
    let foundMs = null
    let tasksRun = 0
    for (let bound = h0; bound <= 26 && !result; bound++) {
      if (bound <= sd + 1) {
        const r = await this.workers[0].call('bound', { bound, maxnodes: Math.max(0, maxnodes - nodes) })
        perBound[bound] = r.nodes
        nodes += r.nodes
        if (r.found) {
          result = { length: bound, solution: r.path, verified: r.verified }
          foundMs = performance.now() - t0
        }
        if (r.aborted) break
        continue
      }
      const cs = await Promise.all(this.workers.map((w) => w.call('collect', { bound, sd })))
      const nt = cs[0].tasks
      if (cs.some((c) => c.tasks !== nt)) throw new Error('workers disagree on the task list')
      let sub = cs[0].nodes
      let next = 0
      let aborted = false
      await Promise.all(
        this.workers.map(async (w) => {
          while (!result && !aborted && next < nt) {
            const t = next++
            const r = await w.call('task', { t, bound, sd, maxnodes: Math.max(0, maxnodes - nodes - sub) })
            tasksRun++
            sub += r.nodes
            if (r.aborted) aborted = true
            if (r.found && !result) {
              result = { length: bound, solution: r.path, verified: r.verified }
              foundMs = performance.now() - t0
            }
          }
        }),
      )
      perBound[bound] = sub
      nodes += sub
      if (aborted || nodes > maxnodes) break
    }
    const drainMs = performance.now() - t0
    if (!result) return { length: -1, solution: '', verified: false, dnf: true, h0, nodes, perBound, found_ms: null, drain_ms: drainMs, tasks_run: tasksRun }
    return { ...result, dnf: false, h0, nodes, perBound, found_ms: foundMs, drain_ms: drainMs, tasks_run: tasksRun }
  }
}

/** Builds every missing table of a floor in a throwaway builder worker, storing it in IndexedDB. */
export async function buildMissing(tables, wasm, have) {
  const out = []
  for (const [name, bits] of tables) {
    if (have.includes(`${name}.${bits}`)) continue
    const w = new Worker1(new URL('./worker.js', import.meta.url))
    await w.call('init', { wasm, role: 'builder' })
    const r = await w.call('build', { name, bits })
    w.terminate()
    out.push({ table: `${name}.${bits}`, ...r })
  }
  return out
}
