// Worker protocol. Every message is {id, op, ...}; every reply is {id, ok, ...} or {id, ok: false, error}.
//
// role (set by 'init'):
//   'builder'  builds tables and hands their bytes back; thrown away afterwards, so the breadth-first
//              search's scratch memory goes with it
//   'prover'   holds a copy of a floor's tables and runs IDA*: a whole solve, one bound, or one subtree
//   'ceiling'  reserved for T6's ceiling solver (finds any solution, races the prover); same init and
//              table loading, its own ops ('ceiling-*') to be added
import { Engine } from './engine.js'
import * as store from './store.js'

let engine = null
let role = null

const ops = {
  async init({ wasm, role: r }) {
    role = r
    engine = await Engine.create(wasm)
    return { role, memory: engine.mem.buffer.byteLength }
  },

  // Builds one table file and stores it in IndexedDB; returns timings (the bytes stay in the store).
  async build({ name, bits }) {
    const t0 = performance.now()
    const b = engine.build(name, [bits])
    const buildMs = performance.now() - t0
    const t1 = performance.now()
    const meta = { entries: b.entries, depth: b.depth, counts: b.counts, build_ms: buildMs, bytes: b.data[bits].length }
    await store.put(`${name}.${bits}`, b.data[bits], meta)
    return { ...meta, store_ms: performance.now() - t1, memory: engine.mem.buffer.byteLength }
  },

  // Copies tables from IndexedDB into this instance, then sets the floor.
  async load({ tables, floor }) {
    const t0 = performance.now()
    let readMs = 0
    for (const [name, bits] of tables) {
      const t1 = performance.now()
      const rec = await store.get(`${name}.${bits}`)
      readMs += performance.now() - t1
      if (!rec) throw new Error(`table ${name}.${bits} not in the store`)
      engine.load(name, bits, rec.bytes)
    }
    const t2 = performance.now()
    const lookups = engine.setFloor(floor)
    return {
      lookups,
      load_ms: performance.now() - t0,
      idb_read_ms: readMs,
      index_ms: performance.now() - t2, // symmetry classes etc. are rebuilt in table_init
      floor_bytes: engine.x.floor_bytes(),
      aux_bytes: engine.x.floor_aux_bytes(),
      memory: engine.mem.buffer.byteLength,
    }
  },

  solve({ scramble, maxnodes }) {
    return engine.solve(scramble, maxnodes)
  },

  root({ scramble }) {
    return { h0: engine.setRoot(scramble), symmetries: engine.x.root_symmetries() }
  },

  bound({ bound, maxnodes }) {
    const found = engine.x.bound_run(bound, maxnodes)
    return { found: !!found, nodes: engine.x.nodes(), aborted: !!engine.x.aborted(), path: found ? engine.pathString(bound) : null, verified: found ? engine.x.path_check(bound) === 1 : false }
  },

  collect({ bound, sd }) {
    const nt = engine.x.tasks_collect(bound, sd)
    return { tasks: nt, nodes: engine.x.nodes() }
  },

  task({ t, bound, sd, maxnodes }) {
    const t0 = performance.now()
    const found = engine.x.task_run(t, bound, sd, maxnodes)
    return { found: !!found, nodes: engine.x.nodes(), aborted: !!engine.x.aborted(), ms: performance.now() - t0, path: found ? engine.pathString(bound) : null, verified: found ? engine.x.path_check(bound) === 1 : false }
  },

  memory() {
    return { memory: engine.mem.buffer.byteLength }
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
