// One worker's view of core-shared.wasm (src/core.c): an instance on the shared memory every worker
// uses. The tables, the floor and the control block are shared; each instance has its own stack,
// its own scratch buffer and its own Ctx (prover) or Ceil (ceiling) record.
//
// Runs in a Web Worker and in Node.
import { MOVENAMES, parseMoves } from './engine.js'

export { MOVENAMES, floorTables, parseMoves } from './engine.js'

// Control block layout (Int32 indices), as struct Ctl in src/core.c.
export const CTL = { stop: 0, ceiling: 1, bound: 2, next_task: 3, nt: 4, winner: 5, win_len: 6, ceil_len: 7, certified: 8, win_path: 16, ceil_path: 48, size: 80 }
export const PAGE = 65536
export const MAX_PAGES = 32768 // 2 GiB, as --max-memory in the Makefile
export const STACK = 2 * 1024 * 1024 // per worker, as -z stack-size

/** The memory the page creates once and posts to every worker. */
export function sharedMemory(initialBytes = 32 * 1024 * 1024) {
  return new WebAssembly.Memory({ initial: initialBytes / PAGE, maximum: MAX_PAGES, shared: true })
}

export class SharedEngine {
  /**
   * module: a compiled WebAssembly.Module (posted from the page); memory: the shared Memory.
   * stackTop: 0 for the first instance (it keeps the linker's stack), else the top of a region the
   * first instance allocated for this one. first: run init() (cube model, coordinates, control block).
   */
  static async create(module, memory, { stackTop = 0, first = false, log = () => {} } = {}) {
    const e = new SharedEngine()
    e.mem = memory
    const str = (p) => {
      const b = new Uint8Array(memory.buffer, p, 512).slice() // TextDecoder refuses shared views
      return new TextDecoder().decode(b.subarray(0, b.indexOf(0)))
    }
    const instance = await WebAssembly.instantiate(module, {
      env: {
        memory,
        js_die: (p) => {
          throw new Error(`core: ${str(p)}`)
        },
        js_log: (p, a, b) => log(str(p), a, b),
        js_now: () => performance.now() / 1000,
      },
    })
    e.x = instance.exports
    // Before anything else runs: this instance's own stack.
    if (stackTop) e.x.__stack_pointer.value = stackTop
    if (first) e.x.init()
    e.buf = e.x.scratch(4096) // reused for strings and move lists
    e.ctl = new Int32Array(memory.buffer, e.x.ctl_ptr(), CTL.size)
    return e
  }

  i32(p, n) {
    return new Int32Array(this.mem.buffer, p, n)
  }

  cstr(s) {
    const b = new TextEncoder().encode(`${s}\0`)
    if (b.length > 4096) throw new Error('string too long')
    new Uint8Array(this.mem.buffer, this.buf, b.length).set(b)
    return this.buf
  }

  /** Writes a scramble's moves into the scratch buffer; returns [ptr, n]. */
  moves(scramble) {
    const mv = parseMoves(scramble)
    this.i32(this.buf, mv.length).set(mv)
    return [this.buf, mv.length]
  }

  tableId(name) {
    const id = this.x.table_id(this.cstr(name))
    if (id < 0) throw new Error(`unknown table ${name}`)
    return id
  }

  /** Copies a table's bytes into shared memory (once, by the loader). */
  load(name, bits, bytes) {
    const id = this.tableId(name)
    const n = this.x.table_bytes(id, bits)
    if (bytes.length !== n) throw new Error(`${name}.${bits}: ${bytes.length} bytes, want ${n}`)
    const p = this.x.table_alloc(id, bits)
    new Uint8Array(this.mem.buffer, p, n).set(bytes)
  }

  /** Builds a table in place (Node check only: the breadth-first scratch is never freed). */
  build(name, bits) {
    const id = this.tableId(name)
    return this.x.table_build(id, bits === 4 ? 1 : 2)
  }

  setFloor(spec) {
    return this.x.floor_set(this.cstr(spec))
  }

  pathString(path) {
    return path.map((m) => MOVENAMES[m]).join(' ')
  }

  /** The winning prover's path, from the control block. */
  winPath() {
    const n = Atomics.load(this.ctl, CTL.win_len)
    return [...this.ctl.subarray(CTL.win_path, CTL.win_path + n)]
  }

  ceilPath() {
    const n = Atomics.load(this.ctl, CTL.ceil_len)
    return n < 0 ? [] : [...this.ctl.subarray(CTL.ceil_path, CTL.ceil_path + n)]
  }

  /** Replays a path on ctx's root inside wasm: true if it ends solved. */
  check(ctx, path) {
    this.i32(this.buf + 1024, path.length).set(path)
    return this.x.path_check(ctx, this.buf + 1024, path.length) === 1
  }
}

/** Resets the control block for a new solve (only while every worker is idle). */
export function ctlReset(ctl) {
  for (const [k, v] of [['stop', 0], ['ceiling', 99], ['bound', 0], ['next_task', 0], ['nt', 0], ['winner', 0], ['win_len', 0], ['ceil_len', -1], ['certified', 0]]) Atomics.store(ctl, CTL[k], v)
}
