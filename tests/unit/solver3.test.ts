import type { KPuzzle } from 'cubing/kpuzzle'
import { cube3x3x3 } from 'cubing/puzzles'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyMoves,
  type Cube,
  fromCubing,
  invertMoves,
  isSolved,
  keyOf,
  MOVE_NAMES,
  MOVES,
  multiply,
  SIZE,
  SOLVED,
  same,
  toCubing,
} from '../../src/solver3/cube3'
import { cubingCeiling, ida, prove, solve3 } from '../../src/solver3/engine'
import { buildTables, FLOOR_NAMES, floorOf, floors, type Tables } from '../../src/solver3/tables'

/** A small seeded random generator, so failures repeat. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randomMoves = (rand: () => number, n: number) =>
  Array.from({ length: n }, () => MOVE_NAMES[Math.floor(rand() * 18)])

/** Moves that never turn the same face twice in a row, so few of them cancel. */
function randomTurns(rand: () => number, n: number) {
  const out: string[] = []
  let last = -1
  while (out.length < n) {
    const j = Math.floor(rand() * 18)
    const face = (j / 3) | 0
    if (face === last) continue
    out.push(MOVE_NAMES[j])
    last = face
  }
  return out
}

const SUPERFLIP = "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U".split(' ')

/** Every position within `depth` moves of solved, once each, with its exact distance. */
function ball(depth: number) {
  const dist = new Map<string, number>([[keyOf(SOLVED), 0]])
  const cubes: Cube[] = [SOLVED]
  const rings = [1]
  let frontier: Cube[] = [SOLVED]
  for (let d = 1; d <= depth; d++) {
    const next: Cube[] = []
    for (const c of frontier) {
      for (const m of MOVES) {
        const n = multiply(c, m.t)
        const k = keyOf(n)
        if (!dist.has(k)) {
          dist.set(k, d)
          next.push(n)
        }
      }
    }
    rings.push(next.length)
    for (const n of next) cubes.push(n)
    frontier = next
  }
  return { dist, cubes, rings }
}

describe('3×3 cubie model', () => {
  let kpuzzle: KPuzzle
  beforeAll(async () => {
    kpuzzle = await cube3x3x3.kpuzzle()
  })

  it('has 18 face turns, each of order 4 (quarter turns exactly 4, half turns 2)', () => {
    expect(MOVES).toHaveLength(18)
    MOVES.forEach((m, j) => {
      let c = SOLVED
      const orders: number[] = []
      for (let k = 1; k <= 4; k++) {
        c = multiply(c, m.t)
        if (isSolved(c)) orders.push(k)
      }
      expect(orders.at(-1)).toBe(4)
      expect(orders[0]).toBe(j % 3 === 1 ? 2 : 4)
    })
  })

  it('matches cubing.js on each face turn', () => {
    for (const m of MOVES) {
      const theirs = kpuzzle.defaultPattern().applyMove(m.name).patternData
      expect(toCubing(m.t)).toEqual({ CORNERS: theirs.CORNERS, EDGES: theirs.EDGES })
    }
  })

  it('matches cubing.js on 500 random sequences, both ways', () => {
    const rand = seeded(3)
    for (let i = 0; i < 500; i++) {
      const moves = randomMoves(rand, 1 + Math.floor(rand() * 30))
      const ours = applyMoves(SOLVED, moves)
      const theirs = kpuzzle.defaultPattern().applyAlg(moves.join(' ')).patternData
      expect(toCubing(ours)).toEqual({ CORNERS: theirs.CORNERS, EDGES: theirs.EDGES })
      expect(same(fromCubing(theirs), ours)).toBe(true)
    }
  })

  it('undoes a sequence with its inverse', () => {
    const moves = randomMoves(seeded(4), 40)
    expect(isSolved(applyMoves(applyMoves(SOLVED, moves), invertMoves(moves)))).toBe(true)
  })
})

describe('3×3 solver', () => {
  let t: Tables
  let truth: ReturnType<typeof ball>
  beforeAll(() => {
    t = buildTables()
    truth = ball(5)
  })

  it('builds each coordinate puzzle by breadth-first search over all its values', () => {
    expect(t.twist).toHaveLength(2187)
    expect(t.flip).toHaveLength(2048)
    expect(t.slice).toHaveLength(495)
    expect(t.cperm).toHaveLength(40320)
    expect(t.twistSlice).toHaveLength(1_082_565)
    expect(t.flipSlice).toHaveLength(1_013_760)
    for (const name of FLOOR_NAMES) expect(t[name].includes(255)).toBe(false)
  })

  it('agrees with the published number of positions at each distance up to 5', () => {
    expect(truth.rings).toEqual([1, 18, 243, 3240, 43239, 574908])
  })

  it('no floor is ever higher than the true distance, on every position within 5 moves', () => {
    let tooHigh = 0
    let positions = 0
    for (const c of truth.cubes) {
      const d = truth.dist.get(keyOf(c)) as number
      const f = floors(t, c)
      for (const name of FLOOR_NAMES) if (f[name] > d) tooHigh++
      positions++
    }
    expect(positions).toBe(621_649)
    expect(tooHigh).toBe(0)
  })

  it('finds the shortest solution on 200 random positions up to 7 moves', { timeout: 120_000 }, async () => {
    // Exact distance up to 7: some 0–2 move sequence takes the position into the radius-5 table.
    const prefixes: Cube[] = [SOLVED]
    for (const m of MOVES) {
      prefixes.push(m.t)
      for (const n of MOVES) prefixes.push(multiply(m.t, n.t))
    }
    const lengths = prefixes.map((p) => (p === SOLVED ? 0 : MOVES.some((m) => m.t === p) ? 1 : 2))
    const distance = (c: Cube) => {
      let best = Number.POSITIVE_INFINITY
      prefixes.forEach((p, i) => {
        const d = truth.dist.get(keyOf(multiply(c, p)))
        if (d !== undefined) best = Math.min(best, d + lengths[i])
      })
      return best
    }
    const rand = seeded(7)
    const seen = new Map<number, number>()
    for (let i = 0; i < 200; i++) {
      const moves = randomTurns(rand, 1 + Math.floor(rand() * 7))
      const d = distance(applyMoves(SOLVED, moves))
      const report = await solve3(t, moves, { budget: 5_000_000 })
      expect(report.status).toBe('proven')
      expect(report.solution.length).toBe(d)
      expect(report.provenFloor).toBe(d)
      expect(isSolved(applyMoves(applyMoves(SOLVED, moves), report.solution))).toBe(true)
      seen.set(d, (seen.get(d) ?? 0) + 1)
    }
    expect(seen.get(7)).toBeGreaterThan(15)
  })

  it('reports a floor of at most 20 for the superflip, and an honest gap within its budget', async () => {
    const cube = applyMoves(SOLVED, SUPERFLIP)
    expect(floorOf(t, cube)).toBeLessThanOrEqual(20)
    const rounds: number[] = []
    const report = await solve3(t, SUPERFLIP, { budget: 3_000_000, onRound: (r) => rounds.push(r.bound) })
    expect(report.status).toBe('gap')
    expect(report.nodes).toBeLessThanOrEqual(3_000_000)
    expect(report.provenFloor).toBeLessThanOrEqual(20)
    expect(report.provenFloor).toBeGreaterThan(report.floorAtStart)
    // The superflip needs exactly 20 moves, so any correct ceiling is at least 20.
    expect(report.ceiling).toBeGreaterThanOrEqual(20)
    expect(report.provenFloor).toBeLessThan(report.ceiling)
    expect(isSolved(applyMoves(cube, report.solution))).toBe(true)
    // Each completed round was reported, and the floor is where the last one left off.
    expect(rounds).toEqual(report.rounds.map((r) => r.bound))
    expect(report.provenFloor).toBeGreaterThan(rounds.at(-1) as number)
  })

  it('proves a ceiling optimal once the bound reaches its length', () => {
    const moves = "R U F' D2 L B'".split(' ')
    const report = prove(t, applyMoves(SOLVED, moves), invertMoves(moves), { budget: 10_000_000 })
    expect(report).toMatchObject({ status: 'proven', source: 'ceiling', ceiling: 6, provenFloor: 6 })
  })

  it('replaces a ceiling that is too long with the shortest solution it finds', () => {
    const moves = "R U R' U' F2".split(' ')
    const long = [...invertMoves(moves), 'L', "L'"]
    const report = prove(t, applyMoves(SOLVED, moves), long, { budget: 10_000_000 })
    expect(report).toMatchObject({ status: 'proven', source: 'prover', ceiling: 5, provenFloor: 5, ceilingLength: 7 })
  })

  it('never turns the same face twice, or opposite faces out of order', () => {
    const run = ida(t, applyMoves(SOLVED, randomMoves(seeded(9), 9)), { budget: 50_000_000, upTo: 30 })
    const faces = (run.moves as string[]).map((m) => 'URFDLB'.indexOf(m[0]))
    for (let i = 1; i < faces.length; i++) {
      expect(faces[i]).not.toBe(faces[i - 1])
      expect(faces[i]).not.toBe(faces[i - 1] - 3)
    }
  })

  it('stops at its node budget without claiming more than it proved', () => {
    const cube = applyMoves(SOLVED, randomMoves(seeded(11), 30))
    const run = ida(t, cube, { budget: 20_000, upTo: 30 })
    expect(run.stopped).toBe(true)
    expect(run.nodes).toBeLessThanOrEqual(20_000)
    expect(run.moves).toBeNull()
    const last = run.rounds.at(-1)
    expect(run.provenFloor).toBeGreaterThan(last ? last.bound : run.floorAtStart - 1)
    expect(run.provenFloor).toBeLessThanOrEqual(20)
  })

  it('gets a ceiling from cubing.js that solves the position', async () => {
    const cube = applyMoves(SOLVED, randomMoves(seeded(12), 25))
    const ceiling = await cubingCeiling(cube)
    expect(ceiling.length).toBeLessThanOrEqual(30)
    expect(isSolved(applyMoves(cube, ceiling))).toBe(true)
    expect(cube.length).toBe(SIZE)
  })
})
