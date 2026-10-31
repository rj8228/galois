// Port check of the threads build in Node: one instance on a shared memory, tables built in place,
// whole solves one bound at a time (bound_run), node counts per bound against lab/3x3's results.
//   node scripts/node-check-shared.mjs <floor> <set> [count]
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SharedEngine, ctlReset, floorTables, sharedMemory } from '../bench/shared-engine.js'

const here = dirname(fileURLToPath(import.meta.url))
const [floor, set, count] = process.argv.slice(2)
const lab = join(here, '..', '..', '..', '3x3')
const module = new WebAssembly.Module(readFileSync(join(here, '..', 'bench', 'core-shared.wasm')))
const memory = sharedMemory()
const e = await SharedEngine.create(module, memory, { first: true })
for (const [name, bits] of floorTables(floor)) {
  const t0 = performance.now()
  const depth = e.build(name, bits)
  console.error(`build ${name}.${bits}: depth ${depth}, ${((performance.now() - t0) / 1e3).toFixed(1)} s`)
}
e.setFloor(floor)
const ctx = e.x.ctx_new()
const native = JSON.parse(readFileSync(join(lab, 'results', `bench-${set}.json`), 'utf8')).floors[floor]
const byScramble = new Map(native.solves.map((s) => [s.scramble, s]))
const scrambles = readFileSync(join(lab, 'scrambles', `${set}.txt`), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'))
let same = 0, n = 0, ms = 0
const rows = []
for (const s of scrambles.slice(0, count ? +count : undefined)) {
  ctlReset(e.ctl)
  const t0 = performance.now()
  const h0 = e.x.root_set(ctx, ...e.moves(s))
  const perBound = {}
  let nodes = 0, length = -1, path = []
  for (let b = h0; b <= 26; b++) {
    const found = e.x.bound_run(ctx, b, 3e9)
    perBound[b] = e.x.nodes(ctx)
    nodes += perBound[b]
    if (found) {
      length = b
      path = e.winPath()
      break
    }
  }
  const dt = performance.now() - t0
  const nat = byScramble.get(s)
  const verified = e.check(ctx, path)
  const eq = nat && !nat.dnf && nat.length === length && nat.nodes === nodes && JSON.stringify(perBound) === JSON.stringify(nat.nodes_per_bound)
  same += eq && verified ? 1 : 0, n++, ms += dt
  rows.push({ scramble: s, length, solution: e.pathString(path), verified, nodes, perBound, ms: dt, same_as_native: !!eq })
  if (!eq || !verified) console.error('MISMATCH', s, length, nodes, perBound, nat && nat.nodes_per_bound)
}
console.log(JSON.stringify({ floor, set, identical: same, of: n, mean_ms: ms / n }))
if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, `${JSON.stringify({ kind: 'node-check-shared', floor, set, identical: same, of: n, solves: rows.map((r) => ({ ...r, dnf: r.length < 0 })) }, null, 1)}\n`)
