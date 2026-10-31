// Thin wrapper around core.wasm (src/core.c). Runs in a Web Worker and in Node (for tests).
//
// One Engine = one wasm instance = one private copy of the tables it holds.

export const FACES = 'URFDLB'
export const MOVENAMES = [...FACES].flatMap((f) => [f, `${f}2`, `${f}'`])

/** "R U2 F'" -> [3, 1, 8] (cube3 numbering: face * 3 + quarter turns - 1). */
export function parseMoves(s) {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const i = MOVENAMES.indexOf(t)
      if (i < 0) throw new Error(`bad move ${t}`)
      return i
    })
}

/** Tables a floor spec reads, as [name, bits] pairs (same tokens as cube3's parse_floor). */
export function floorTables(spec) {
  const names = [
    ['Kts', 'twist_slice'], ['Kfs', 'flip_slice'], ['Ktf', 'twist_flip'], ['Kt', 'twist'], ['Kf', 'flip'],
    ['Ks', 'slice'], ['P1', 'phase1_sym'], ['C8s', 'corners_sym'], ['C8', 'corners'], ['E6', 'edges6'],
    ['E7', 'edges7'],
  ]
  const out = []
  for (const tok of spec.split('+')) {
    const hit = names.find(([t]) => tok.startsWith(t))
    if (!hit) throw new Error(`unknown floor token ${tok}`)
    const bits = tok.endsWith('@2') ? 2 : 4
    if (!out.some(([n, b]) => n === hit[1] && b === bits)) out.push([hit[1], bits])
  }
  return out
}

export class Engine {
  static async create(wasmBytes, log = () => {}) {
    const e = new Engine()
    let mem
    const str = (p) => {
      const b = new Uint8Array(mem.buffer, p)
      return new TextDecoder().decode(b.subarray(0, b.indexOf(0)))
    }
    const { instance } = await WebAssembly.instantiate(wasmBytes, {
      env: {
        js_die: (p) => {
          throw new Error(`core: ${str(p)}`)
        },
        js_log: (p, a, b) => log(str(p), a, b),
      },
    })
    e.x = instance.exports
    mem = e.x.memory
    e.mem = mem
    e.x.init()
    return e
  }

  cstr(s) {
    const b = new TextEncoder().encode(`${s}\0`)
    const p = this.x.scratch(b.length)
    new Uint8Array(this.mem.buffer, p, b.length).set(b)
    return p
  }

  tableId(name) {
    const id = this.x.table_id(this.cstr(name))
    if (id < 0) throw new Error(`unknown table ${name}`)
    return id
  }

  /** Builds a table here (breadth-first search); returns {bits: Uint8Array copy} for each of bitsList. */
  build(name, bitsList) {
    const id = this.tableId(name)
    const which = (bitsList.includes(4) ? 1 : 0) | (bitsList.includes(2) ? 2 : 0)
    const depth = this.x.table_build(id, which)
    const counts = []
    for (let d = 0; d <= depth; d++) counts.push(this.x.build_count(d))
    const out = { depth, counts, entries: this.x.table_entries(id), data: {} }
    for (const bits of bitsList) {
      const n = this.x.table_bytes(id, bits)
      out.data[bits] = new Uint8Array(this.mem.buffer, this.x.table_ptr(id, bits), n).slice()
    }
    return out
  }

  /** Copies a table's bytes (from the cache or a builder) into this instance. */
  load(name, bits, bytes) {
    const id = this.tableId(name)
    const n = this.x.table_bytes(id, bits)
    if (bytes.length !== n) throw new Error(`${name}.${bits}: ${bytes.length} bytes, want ${n}`)
    const p = this.x.table_alloc(id, bits)
    new Uint8Array(this.mem.buffer, p, n).set(bytes)
  }

  setFloor(spec) {
    return this.x.floor_set(this.cstr(spec))
  }

  /** Sets the root position; returns h0. */
  setRoot(scramble) {
    const mv = parseMoves(scramble)
    const p = this.x.scratch(4 * Math.max(1, mv.length))
    new Int32Array(this.mem.buffer, p, mv.length).set(mv)
    return this.x.root_set(p, mv.length)
  }

  path(n) {
    return [...new Int32Array(this.mem.buffer, this.x.path_ptr(), n)]
  }

  pathString(n) {
    return this.path(n)
      .map((m) => MOVENAMES[m])
      .join(' ')
  }

  /** Single-instance IDA* (cube3's solve without split). */
  solve(scramble, maxnodes = 2e9) {
    const t0 = performance.now()
    const h0 = this.setRoot(scramble)
    const perBound = {}
    let nodes = 0
    for (let bound = h0; bound <= 26; bound++) {
      const found = this.x.bound_run(bound, Math.max(0, maxnodes - nodes))
      perBound[bound] = this.x.nodes()
      nodes += perBound[bound]
      if (found) {
        const ok = this.x.path_check(bound) === 1
        return { length: bound, solution: this.pathString(bound), verified: ok, dnf: false, h0, nodes, perBound, ms: performance.now() - t0 }
      }
      if (this.x.aborted()) break
    }
    return { length: -1, solution: '', verified: false, dnf: true, h0, nodes, perBound, ms: performance.now() - t0 }
  }
}
