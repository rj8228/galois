import {
  applyMoves,
  CO,
  CP,
  type Cube,
  EO,
  EP,
  fromCubing,
  isLegal,
  isSolved,
  MOVE_NAMES,
  MOVES,
  parseMoves,
  SIZE,
  SOLVED,
  toCubing,
} from './cube3.ts'
import { cpermOf, flipOf, floorOf, N_SLICE, sliceOf, type Tables, twistOf } from './tables.ts'

/** One completed round of the search: no solution of `bound` moves or fewer exists. */
export type Round = {
  bound: number
  /** Positions the prover looked at in this round. */
  nodes: number
  ms: number
}

export type Proof = {
  /** A solution found by the prover itself, which is then the shortest, or null. */
  moves: string[] | null
  rounds: Round[]
  nodes: number
  /** The position certainly needs at least this many moves. */
  provenFloor: number
  floorAtStart: number
  /** True when the prover ran out of budget before finishing. */
  stopped: boolean
}

export type ProveOptions = {
  /** The most positions to look at, over all rounds. */
  budget: number
  /** Stop once the floor reaches this many moves (a solution this long is already known). */
  upTo: number
  /** Called after each completed round. */
  onRound?: (r: Round) => void
}

// All 18 moves as one flat array, so a turn is a few typed-array reads.
const MT = new Uint8Array(18 * SIZE)
MOVES.forEach((m, j) => {
  MT.set(m.t, j * SIZE)
})
const MOD3 = [0, 1, 2, 0, 1, 2]

/**
 * IDA* on the full cube. Each round looks at every move sequence whose length plus floor stays
 * within the bound, never turning the same face twice in a row, and turning opposite faces only in
 * the order U before D, R before L, F before B. A round that finishes without a solution proves
 * the position needs more moves than the bound; the next bound is the smallest overshoot seen.
 */
export function ida(t: Tables, start: Cube, { budget, upTo, onRound }: ProveOptions): Proof {
  const { twistMove, flipMove, sliceMove, cpermMove, cperm, twistSlice, flipSlice } = t
  const floorAtStart = floorOf(t, start)
  const rounds: Round[] = []
  if (isSolved(start)) return { moves: [], rounds, nodes: 1, provenFloor: 0, floorAtStart, stopped: false }

  const depth = Math.max(upTo, floorAtStart) + 1
  const stack = new Uint8Array((depth + 1) * SIZE)
  stack.set(start, 0)
  const path = new Uint8Array(depth)
  let nodes = 1
  let nextBound = 0
  let stopped = false
  let foundAt = -1

  const dfs = (g: number, rem: number, lastFace: number, tw: number, fl: number, sl: number, cp: number) => {
    const base = g * SIZE
    const child = base + SIZE
    for (let j = 0; j < 18; j++) {
      const face = (j / 3) | 0
      if (face === lastFace || face === lastFace - 3) continue
      if (nodes >= budget) {
        stopped = true
        return false
      }
      nodes++
      const ntw = twistMove[tw * 18 + j]
      const nfl = flipMove[fl * 18 + j]
      const nsl = sliceMove[sl * 18 + j]
      const ncp = cpermMove[cp * 18 + j]
      // The twist, flip, slice floors can never beat the two pair floors that contain them.
      let h = cperm[ncp]
      const a = twistSlice[ntw * N_SLICE + nsl]
      if (a > h) h = a
      const b = flipSlice[nfl * N_SLICE + nsl]
      if (b > h) h = b
      if (h >= rem) {
        if (g + 1 + h < nextBound) nextBound = g + 1 + h
        continue
      }
      const m = j * SIZE
      for (let i = 0; i < 8; i++) {
        const from = base + MT[m + CP + i]
        stack[child + CP + i] = stack[from + CP]
        stack[child + CO + i] = MOD3[stack[from + CO] + MT[m + CO + i]]
      }
      for (let i = 0; i < 12; i++) {
        const from = base + MT[m + EP + i]
        stack[child + EP + i] = stack[from + EP]
        stack[child + EO + i] = stack[from + EO] ^ MT[m + EO + i]
      }
      path[g] = j
      if (h === 0) {
        // Corners solved, edges unflipped and the middle edges in the middle: check the edges' places.
        let ok = true
        for (let i = 0; i < 12; i++) if (stack[child + EP + i] !== i) ok = false
        if (ok) {
          foundAt = g + 1
          return true
        }
      }
      if (dfs(g + 1, rem - 1, face, ntw, nfl, nsl, ncp)) return true
      if (stopped) return false
    }
    return false
  }

  const tw0 = twistOf(start)
  const fl0 = flipOf(start)
  const sl0 = sliceOf(start)
  const cp0 = cpermOf(start)
  let bound = floorAtStart
  let provenFloor = floorAtStart
  while (bound < upTo) {
    const before = nodes
    const t0 = performance.now()
    nextBound = Number.MAX_SAFE_INTEGER
    const found = dfs(0, bound, -1, tw0, fl0, sl0, cp0)
    if (found) {
      const moves = Array.from(path.subarray(0, foundAt), (j) => MOVE_NAMES[j])
      return { moves, rounds, nodes, provenFloor: foundAt, floorAtStart, stopped: false }
    }
    if (stopped) break
    const round = { bound, nodes: nodes - before, ms: performance.now() - t0 }
    rounds.push(round)
    onRound?.(round)
    bound = nextBound
    provenFloor = bound
  }
  return { moves: null, rounds, nodes, provenFloor, floorAtStart, stopped }
}

export type Solve3Report = {
  /** The shortest solution known: proven shortest when status is 'proven'. */
  solution: string[]
  /** Its length. */
  ceiling: number
  /** The position certainly needs at least this many moves. */
  provenFloor: number
  /** 'proven': floor meets ceiling, so the solution is optimal. 'gap': the budget ran out first. */
  status: 'proven' | 'gap'
  /** Where the solution came from: cubing.js's two-phase solver, or the prover itself. */
  source: 'ceiling' | 'prover'
  /** Length of the ceiling solution the prover started from. */
  ceilingLength: number
  floorAtStart: number
  rounds: Round[]
  nodes: number
  ms: number
}

/**
 * Floor meets ceiling: the prover raises its bound until it either finds a solution shorter than
 * the ceiling (then that one is the shortest) or proves none exists (then the ceiling is), or the
 * budget runs out, leaving a gap between the proven floor and the ceiling.
 */
export function prove(
  t: Tables,
  cube: Cube,
  ceiling: readonly string[],
  opts: { budget: number; onRound?: (r: Round) => void },
): Solve3Report {
  if (!isSolved(applyMoves(cube, ceiling))) throw new Error('The ceiling does not solve the position')
  const t0 = performance.now()
  const run = ida(t, cube, { ...opts, upTo: ceiling.length })
  const solution = run.moves ?? [...ceiling]
  const provenFloor = run.moves ? run.moves.length : Math.min(run.provenFloor, ceiling.length)
  return {
    solution,
    ceiling: solution.length,
    provenFloor,
    status: provenFloor === solution.length ? 'proven' : 'gap',
    source: run.moves ? 'prover' : 'ceiling',
    ceilingLength: ceiling.length,
    floorAtStart: run.floorAtStart,
    rounds: run.rounds,
    nodes: run.nodes,
    ms: performance.now() - t0,
  }
}

/** Any solution, from cubing.js's two-phase solver. Fast, usually 17–21 moves, and not always the shortest. */
export async function cubingCeiling(cube: Cube): Promise<string[]> {
  const [{ cube3x3x3 }, { KPattern }, { experimentalSolve3x3x3IgnoringCenters }] = await Promise.all([
    import('cubing/puzzles'),
    import('cubing/kpuzzle'),
    import('cubing/search'),
  ])
  const kpuzzle = await cube3x3x3.kpuzzle()
  const pattern = new KPattern(kpuzzle, { ...kpuzzle.defaultPattern().patternData, ...toCubing(cube) })
  const alg = await experimentalSolve3x3x3IgnoringCenters(pattern)
  const moves = parseMoves([...alg.experimentalExpand()].map(String).join(' '))
  if (!moves) throw new Error(`cubing.js returned a move that is not a face turn: ${alg}`)
  return moves
}

export type Solve3Options = { budget: number; onRound?: (r: Round) => void }

/** Solves a position given as moves from solved, or as cubing.js pattern data. */
export async function solve3(
  t: Tables,
  position: readonly string[] | Parameters<typeof fromCubing>[0],
  opts: Solve3Options,
): Promise<Solve3Report & { ceilingMs: number }> {
  const cube = Array.isArray(position)
    ? applyMoves(SOLVED, position)
    : fromCubing(position as Parameters<typeof fromCubing>[0])
  if (!isLegal(cube)) throw new Error('Not a reachable position')
  const t0 = performance.now()
  const ceiling = await cubingCeiling(cube)
  const ceilingMs = performance.now() - t0
  return { ...prove(t, cube, ceiling, opts), ceilingMs }
}
