import { applyMoves, canonical, indexOf, NT, SOLVED, toHeldView } from './cube2.ts'
import { ensureStrong, SEARCH_MOVES, type Tables } from './tables.ts'

export type FloorName = 'weak' | 'medium' | 'strong'
export const FLOORS: FloorName[] = ['weak', 'medium', 'strong']

/** A floor: a number of moves the position certainly needs. Never higher than the truth. */
export function floorOf(t: Tables, name: FloorName): (s: number) => number {
  const { twistFloor, permFloor, loc7, twist7 } = t
  if (name === 'weak') return (s) => twistFloor[s % NT]
  if (name === 'medium') {
    return (s) => {
      const p = (s / NT) | 0
      return Math.max(twistFloor[s - p * NT], permFloor[p])
    }
  }
  const views = ensureStrong(t).map((f) => ({
    corners: f.corners,
    table: f.table,
    pow: f.corners.map((_, i) => 21 ** i),
  }))
  return (s) => {
    const p = (s / NT) | 0
    const o = s - p * NT
    let h = Math.max(twistFloor[o], permFloor[p])
    for (const v of views) {
      let key = 0
      for (let i = 0; i < v.corners.length; i++) {
        const slot = loc7[p * 7 + v.corners[i]]
        key += (slot * 3 + twist7[o * 7 + slot]) * v.pow[i]
      }
      if (v.table[key] > h) h = v.table[key]
    }
    return h
  }
}

/** One round of the search: every move sequence whose floor stays within the bound. */
export type Round = {
  /** The bound for this round: "at least this many moves". */
  bound: number
  /** Positions the solver looked at in this round. */
  nodes: number
}

export type Search = { moves: string[]; rounds: Round[]; nodes: number; ms: number; floorAtStart: number }

/** IDA*: raise the bound one round at a time; the first round that finds a solution proves it shortest. */
export function ida(t: Tables, start: number, floor: FloorName): Search {
  const h = floorOf(t, floor)
  const { permMove, twistMove } = t
  const path: number[] = []
  let nodes = 0
  const FOUND = -1
  const dfs = (s: number, g: number, bound: number, lastFace: number): number => {
    nodes++
    const f = g + h(s)
    if (f > bound) return f
    if (s === 0) return FOUND
    let best = 1e9
    const p = (s / NT) | 0
    const o = s - p * NT
    for (let j = 0; j < 9; j++) {
      const face = (j / 3) | 0
      if (face === lastFace) continue
      path.push(j)
      const r = dfs(permMove[p * 9 + j] * NT + twistMove[o * 9 + j], g + 1, bound, face)
      if (r === FOUND) return FOUND
      path.pop()
      if (r < best) best = r
    }
    return best
  }
  const t0 = performance.now()
  const floorAtStart = h(start)
  const rounds: Round[] = []
  let bound = floorAtStart
  for (;;) {
    const before = nodes
    const r = dfs(start, 0, bound, -1)
    rounds.push({ bound, nodes: nodes - before })
    if (r === FOUND) break
    bound = r
  }
  return { moves: path.map((j) => SEARCH_MOVES[j]), rounds, nodes, ms: performance.now() - t0, floorAtStart }
}

/** The position as the solver sees it: turned so DBL is home, as an index. */
function locate(position: readonly string[]) {
  const { rel, turn } = canonical(applyMoves(SOLVED, position))
  return { start: indexOf(rel), turn }
}

export type SolveReport = {
  /** Moves the position needs: the length of the proven-shortest solution. */
  distance: number
  floor: FloorName
  floorAtStart: number
  rounds: Round[]
  nodes: number
  ms: number
  /** The proven-shortest solution, as moves on the cube the way you hold it. */
  solution: string[]
}

/** Searches this one position, and nothing else. */
export function solve(t: Tables, position: readonly string[], floor: FloorName): SolveReport {
  const { start, turn } = locate(position)
  const run = ida(t, start, floor)
  return {
    distance: run.moves.length,
    floor,
    floorAtStart: run.floorAtStart,
    rounds: run.rounds,
    nodes: run.nodes,
    ms: run.ms,
    solution: toHeldView(run.moves, turn),
  }
}

export type Comparison = Record<FloorName, { nodes: number; ms: number; floorAtStart: number; rounds: number }>

/** The same position searched with each floor, only when you ask for it. */
export function compareFloors(t: Tables, position: readonly string[]): Comparison {
  const { start } = locate(position)
  return Object.fromEntries(
    FLOORS.map((f) => {
      const run = ida(t, start, f)
      return [f, { nodes: run.nodes, ms: run.ms, floorAtStart: run.floorAtStart, rounds: run.rounds.length }]
    }),
  ) as Comparison
}
