// Coordinator of the shared engine (main thread). One WebAssembly.Memory, shared by every worker,
// holds one copy of the tables and the control block. Provers take subtrees of a split round from a
// shared counter; one stop flag in shared memory halts every worker the moment an answer is proven.
//
// race: one extra 'ceiling' worker runs T6's two-phase solver. Before each round the page publishes
// the round's bound (the proven floor) and checks the shared ceiling; the ceiling worker raises the
// stop flag itself when a solution it finds is no longer than the current bound. Either way the
// answer is a ceiling solution whose length equals the proven floor (T6's certificate).
import { Worker1 } from './pool.js'
import { CTL, ctlReset, sharedMemory } from './shared-engine.js'

const workerUrl = () => new URL('./shared-worker.js', import.meta.url)

export class SharedPool {
  /** n provers (+1 ceiling worker if race). module: compiled core-shared.wasm. */
  static async create(n, module, { tables, floor, race = false }) {
    const p = new SharedPool()
    const t0 = performance.now()
    p.memory = sharedMemory()
    p.race = race
    const loader = new Worker1(workerUrl())
    await loader.call('init', { module, memory: p.memory, role: 'loader', stackTop: 0 })
    const others = n - 1 + (race ? 1 : 0)
    p.loadInfo = await loader.call('load', { tables, floor, ceiling: race, others })
    p.ctl = new Int32Array(p.memory.buffer, p.loadInfo.ctl, CTL.size)
    const rest = Array.from({ length: others }, () => new Worker1(workerUrl()))
    await Promise.all(rest.map((w, i) => w.call('init', { module, memory: p.memory, role: race && i === others - 1 ? 'ceiling' : 'prover', stackTop: p.loadInfo.stacks[i] })))
    p.provers = [loader, ...rest.slice(0, n - 1)]
    p.ceiling = race ? rest[others - 1] : null
    p.setupMs = performance.now() - t0
    return p
  }

  memoryBytes() {
    return this.memory.buffer.byteLength
  }

  terminate() {
    for (const w of [...this.provers, ...(this.ceiling ? [this.ceiling] : [])]) w.terminate()
  }

  /**
   * One solve. sd: split depth (rounds past sd + 1 are split over the provers). cap: the ceiling's
   * time cap in seconds. Returns how it ended: 'prover' (a prover found it in its final round),
   * 'ceiling' (certificate: ceiling length == proven bound), or dnf.
   */
  async solve(scramble, { sd = 2, maxnodes = 3e10, cap = 3600 } = {}) {
    const ctl = this.ctl
    ctlReset(ctl)
    const t0 = performance.now()
    const roots = await Promise.all(this.provers.map((w) => w.call('root', { scramble })))
    const h0 = roots[0].h0
    let ceilDone = null
    let ceilEndMs = null
    if (this.ceiling)
      ceilDone = this.ceiling.call('ceil', { scramble, cap }).then((r) => {
        ceilEndMs = performance.now() - t0
        return r
      })
    const perBound = {}
    const roundMs = {}
    let nodes = 0
    let end = null
    let foundMs = null
    let tasksRun = 0
    let bound = h0
    for (; bound <= 26; bound++) {
      // Publish the proven floor, then read the ceiling (seq_cst, as the ceiling worker does the reverse).
      Atomics.store(ctl, CTL.bound, bound)
      if (Atomics.load(ctl, CTL.ceiling) <= bound) {
        end = 'ceiling'
        foundMs = performance.now() - t0
        break
      }
      const tb = performance.now()
      const budget = Math.max(0, maxnodes - nodes)
      let sub = 0
      let aborted = false
      if (this.provers.length === 1 || bound <= sd + 1) {
        const r = await this.provers[0].call('bound', { bound, maxnodes: budget })
        sub = r.nodes
        aborted = r.aborted
      } else {
        const c = await this.provers[0].call('collect', { bound, sd })
        sub = c.nodes
        const rs = await Promise.all(
          this.provers.map((w) =>
            w.call('run', { bound, sd, maxnodes: budget / this.provers.length }).then((r) => {
              if (r.found && foundMs === null) foundMs = performance.now() - t0
              return r
            }),
          ),
        )
        for (const r of rs) {
          sub += r.nodes
          tasksRun += r.tasks
          aborted ||= r.aborted
        }
      }
      perBound[bound] = sub
      roundMs[bound] = performance.now() - tb
      nodes += sub
      if (Atomics.load(ctl, CTL.winner)) {
        end = 'prover'
        if (foundMs === null) foundMs = performance.now() - t0
        break
      }
      if (Atomics.load(ctl, CTL.certified)) {
        end = 'ceiling'
        foundMs = performance.now() - t0
        break
      }
      if (aborted) break
    }
    const proverMs = performance.now() - t0
    Atomics.store(ctl, CTL.stop, 1) // ends the ceiling worker (it polls every 20,000 nodes)
    const ceil = ceilDone ? await ceilDone : null
    const drainMs = performance.now() - t0
    const out = { h0, nodes, perBound, round_ms: roundMs, tasks_run: tasksRun, found_ms: foundMs, prover_ms: proverMs, drain_ms: drainMs, ceiling_end_ms: ceilEndMs, ceiling: ceil }
    if (end === 'prover') {
      const path = [...ctl.subarray(CTL.win_path, CTL.win_path + Atomics.load(ctl, CTL.win_len))]
      return { ...out, end, length: path.length, path, bound_end: bound, dnf: false }
    }
    if (end === 'ceiling') {
      const n = Atomics.load(ctl, CTL.ceil_len)
      const path = [...ctl.subarray(CTL.ceil_path, CTL.ceil_path + n)]
      if (n !== bound) throw new Error(`ceiling certificate with length ${n} != proven bound ${bound}`)
      return { ...out, end, length: n, path, bound_end: bound, dnf: false }
    }
    return { ...out, end: 'dnf', length: -1, path: [], bound_end: bound, dnf: true }
  }
}
