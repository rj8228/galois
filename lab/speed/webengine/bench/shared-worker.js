// Worker protocol of the shared engine. Every message is {id, op, ...}; every reply {id, ok, ...}.
//
// Roles (set by 'init'):
//   'loader'  the first instance: runs init(), copies the tables from IndexedDB into shared memory
//             once, sets the floor and the ceiling's phase-2 tables, and allocates the other
//             workers' stacks. It then works as prover 0.
//   'prover'  IDA* on the shared tables: a whole bound, or subtrees of a split round taken from the
//             shared counter until none are left or the shared stop flag is up
//   'ceiling' T6's two-phase solver in trace mode, publishing every solution to the shared ceiling
import { STACK, SharedEngine } from './shared-engine.js'
import * as store from './store.js'

let e = null
let role = null
let ctx = 0 // prover record (Ctx*)
let ceil = 0 // ceiling record (Ceil*)

const ops = {
  async init({ module, memory, role: r, stackTop }) {
    role = r
    e = await SharedEngine.create(module, memory, { stackTop, first: role === 'loader' })
    if (role === 'ceiling') ceil = e.x.ceil_new()
    else ctx = e.x.ctx_new()
    return { role, memory: memory.buffer.byteLength }
  },

  // Loader only: one copy of every table in shared memory. Then stacks for `others` workers.
  async load({ tables, floor, ceiling, others }) {
    const t0 = performance.now()
    let readMs = 0
    for (const [name, bits] of tables) {
      const t1 = performance.now()
      let rec = await store.get(`${name}.${bits}`)
      readMs += performance.now() - t1
      if (!rec) throw new Error(`table ${name}.${bits} not in the store`)
      e.load(name, bits, rec.bytes)
      rec = null // drop the JS copy at once (T5 kept 100 MB of these alive per worker)
    }
    const t2 = performance.now()
    const lookups = e.setFloor(floor)
    const indexMs = performance.now() - t2
    const t3 = performance.now()
    if (ceiling) e.x.ceil_init()
    const ceilInitMs = performance.now() - t3
    const base = e.x.scratch(STACK * others + 16)
    const stacks = Array.from({ length: others }, (_, i) => ((base + 15) & ~15) + (i + 1) * STACK)
    return {
      lookups,
      load_ms: performance.now() - t0,
      idb_read_ms: readMs,
      index_ms: indexMs,
      ceil_init_ms: ceilInitMs,
      floor_bytes: e.x.floor_bytes(),
      aux_bytes: e.x.floor_aux_bytes(),
      stacks,
      ctl: e.x.ctl_ptr(),
      memory: e.mem.buffer.byteLength,
    }
  },

  root({ scramble }) {
    return { h0: e.x.root_set(ctx, ...e.moves(scramble)), symmetries: e.x.root_symmetries(ctx) }
  },

  bound({ bound, maxnodes }) {
    const t0 = performance.now()
    const found = !!e.x.bound_run(ctx, bound, maxnodes)
    return { found, nodes: e.x.nodes(ctx), aborted: !!e.x.aborted(ctx), ms: performance.now() - t0 }
  },

  collect({ bound, sd }) {
    return { tasks: e.x.tasks_collect(ctx, bound, sd), nodes: e.x.nodes(ctx) }
  },

  run({ bound, sd, maxnodes }) {
    const t0 = performance.now()
    const found = !!e.x.tasks_run(ctx, bound, sd, maxnodes)
    return { found, nodes: e.x.nodes(ctx), tasks: e.x.tasks_done(ctx), aborted: !!e.x.aborted(ctx), ms: performance.now() - t0 }
  },

  // Ceiling only: runs until a certificate, a prover's win, or cap seconds.
  ceil({ scramble, cap, race = true }) {
    const t0 = performance.now()
    const len = e.x.ceil_run(ceil, ...e.moves(scramble), cap, race ? 1 : 0)
    const trace = []
    for (let i = 0; i < e.x.ceil_nlog(ceil); i++) trace.push([e.x.ceil_log_t(ceil, i), e.x.ceil_log_len(ceil, i)])
    const best = len > 0 ? [...e.i32(e.x.ceil_best(ceil), len)] : []
    return { length: len, solution: e.pathString(best), trace, nodes: e.x.ceil_nodes(ceil), ms: performance.now() - t0 }
  },

  check({ path }) {
    return { verified: e.check(ctx, path) }
  },

  memory() {
    return { memory: e.mem.buffer.byteLength }
  },
}

self.onmessage = async ({ data }) => {
  const { id, op } = data
  try {
    if (!ops[op]) throw new Error(`unknown op ${op} (role ${role})`)
    const out = await ops[op](data)
    self.postMessage({ id, ok: true, ...out })
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.stack ? err.stack : err) })
  }
}
