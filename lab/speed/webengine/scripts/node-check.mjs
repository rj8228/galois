// Node check of the wasm port (same V8 engine as Chromium): builds the tables in wasm, then solves a
// scramble set and compares node counts per bound with lab/3x3's native results.
//   node scripts/node-check.mjs <floor> <set> [count]      e.g. node scripts/node-check.mjs C8s+P1x3i moves-12
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Engine, floorTables } from '../bench/engine.js'

const here = dirname(fileURLToPath(import.meta.url))
const [floor, set, count] = process.argv.slice(2)
const lab = join(here, '..', '..', '..', '3x3')
const e = await Engine.create(readFileSync(join(here, '..', 'bench', 'core.wasm')))
for (const [name, bits] of floorTables(floor)) {
  const t0 = performance.now()
  const b = e.build(name, [bits])
  console.error(`build ${name}.${bits}: ${b.entries} entries, depth ${b.depth}, ${((performance.now() - t0) / 1e3).toFixed(1)} s`)
}
// build_table already left the tables in this instance.
e.setFloor(floor)
const native = JSON.parse(readFileSync(join(lab, 'results', `bench-${set}.json`), 'utf8')).floors[floor]
const byScramble = new Map(native.solves.map((s) => [s.scramble, s]))
const scrambles = readFileSync(join(lab, 'scrambles', `${set}.txt`), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'))
let same = 0, n = 0, ms = 0
for (const s of scrambles.slice(0, count ? +count : undefined)) {
  const r = e.solve(s)
  const nat = byScramble.get(s)
  const eq = nat && !nat.dnf && nat.length === r.length && nat.nodes === r.nodes &&
    JSON.stringify(Object.fromEntries(Object.entries(r.perBound).map(([k, v]) => [k, v]))) === JSON.stringify(nat.nodes_per_bound)
  same += eq ? 1 : 0, n++, ms += r.ms
  if (!eq || !r.verified) console.error('MISMATCH', s, r, nat && nat.nodes_per_bound)
}
console.log(`${floor} ${set}: ${same}/${n} identical node counts per bound, mean ${(ms / n).toFixed(1)} ms`)
