/**
 * Measures the 3×3 solver in Node: run with `node scripts/bench-solver3.ts` (Node 22.18+).
 *
 * 1. Speed: positions the prover looks at per second, on random-state positions.
 * 2. Proofs: for scrambles of 8, 10, 12 and 14 random face turns (never the same face twice in a
 *    row) and for random-state positions, the share proven optimal within a 2-second budget. The
 *    budget is in positions, 2 s × the measured speed, so the run is repeatable; the cubing.js
 *    ceiling is not counted in it and is timed separately.
 */
import { cpus } from 'node:os'
import { randomPositionData, seededRandom } from '../src/daily/scramble.ts'
import { applyMoves, fromCubing, MOVE_NAMES, SOLVED } from '../src/solver3/cube3.ts'
import { cubingCeiling, ida, prove } from '../src/solver3/engine.ts'
import { buildTables } from '../src/solver3/tables.ts'

const PER_LENGTH = Number(process.env.PER_LENGTH ?? 50)
const RANDOM_STATES = 20
const SECONDS = 2

const rand = seededRandom(2026)

function scramble(n: number): string[] {
  const out: string[] = []
  let last = -1
  while (out.length < n) {
    const j = Math.floor(rand() * 18)
    if (((j / 3) | 0) === last) continue
    out.push(MOVE_NAMES[j])
    last = (j / 3) | 0
  }
  return out
}

function randomState() {
  const p = randomPositionData(rand)
  return fromCubing({
    CORNERS: { pieces: p.corners, orientation: p.cornerOrientation },
    EDGES: { pieces: p.edges, orientation: p.edgeOrientation },
  })
}

let t0 = performance.now()
const t = buildTables()
const buildMs = performance.now() - t0
console.log(`tables built in ${buildMs.toFixed(0)} ms (${cpus()[0].model}, Node ${process.version})`)

// Speed: 5 random-state positions, 10 million positions each, after a warm-up.
ida(t, randomState(), { budget: 2_000_000, upTo: 30 })
let nodes = 0
let ms = 0
for (let i = 0; i < 5; i++) {
  const cube = randomState()
  t0 = performance.now()
  nodes += ida(t, cube, { budget: 10_000_000, upTo: 30 }).nodes
  ms += performance.now() - t0
}
const nps = (nodes / ms) * 1000
const budget = Math.round(nps * SECONDS)
console.log(`speed: ${(nps / 1e6).toFixed(1)} million positions per second; ${SECONDS} s budget = ${budget} positions`)

type Row = {
  label: string
  n: number
  proven: number
  optimal: number[]
  floors: number[]
  ceilings: number[]
  proverMs: number[]
  ceilingMs: number[]
}

const rows: Row[] = []
const median = (a: number[]) => (a.length ? a.toSorted((x, y) => x - y)[a.length >> 1] : Number.NaN)
const mean = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '–')

async function run(label: string, cubes: Uint8Array[]) {
  const row: Row = {
    label,
    n: cubes.length,
    proven: 0,
    optimal: [],
    floors: [],
    ceilings: [],
    proverMs: [],
    ceilingMs: [],
  }
  for (const cube of cubes) {
    const c0 = performance.now()
    const ceiling = await cubingCeiling(cube)
    row.ceilingMs.push(performance.now() - c0)
    const r = prove(t, cube, ceiling, { budget })
    row.proverMs.push(r.ms)
    if (r.status === 'proven') {
      row.proven++
      row.optimal.push(r.ceiling)
    } else {
      row.floors.push(r.provenFloor)
      row.ceilings.push(r.ceiling)
    }
  }
  rows.push(row)
  console.log(`${label}: ${row.proven}/${row.n} proven`)
}

for (const n of [8, 10, 12, 14]) {
  await run(
    `${n} random moves`,
    Array.from({ length: PER_LENGTH }, () => applyMoves(SOLVED, scramble(n))),
  )
}
await run('Random state', Array.from({ length: RANDOM_STATES }, randomState))

console.log(
  '\n| Scrambles | Proven optimal | Mean optimal length (proven) | Mean floor → ceiling (gaps) | Median prover time | Median ceiling time |',
)
console.log('| --- | --- | --- | --- | --- | --- |')
for (const r of rows) {
  const gap = r.floors.length ? `${mean(r.floors)} → ${mean(r.ceilings)}` : '–'
  console.log(
    `| ${r.label} (${r.n}) | ${r.proven}/${r.n} (${Math.round((100 * r.proven) / r.n)}%) | ${mean(r.optimal)} | ${gap} | ${median(r.proverMs).toFixed(0)} ms | ${median(r.ceilingMs).toFixed(0)} ms |`,
  )
}
process.exit(0)
