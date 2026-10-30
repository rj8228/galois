import { applyMoves, canonical, indexOf, invertMoves, N, NT, SOLVED, toHeldView } from './cube2.ts'
import { SEARCH_MOVES, type Tables } from './tables.ts'

export type FloorName = 'weak' | 'medium' | 'strong'
export const FLOORS: FloorName[] = ['weak', 'medium', 'strong']

/** A floor: a number of moves the position certainly needs. Never higher than the truth. */
export function floorOf(t: Tables, name: FloorName): (s: number) => number {
  const { twistFloor, permFloor, cornerFloors, loc7, twist7 } = t
  if (name === 'weak') return (s) => twistFloor[s % NT]
  if (name === 'medium') {
    return (s) => {
      const p = (s / NT) | 0
      return Math.max(twistFloor[s - p * NT], permFloor[p])
    }
  }
  const views = cornerFloors.map((f) => ({ corners: f.corners, table: f.table, pow: f.corners.map((_, i) => 21 ** i) }))
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
  /** Of those, how many lay on each ring (labelled with the truth, which the solver never uses). */
  byRing: number[]
}

export type Search = { moves: string[]; rounds: Round[]; nodes: number; ms: number; floorAtStart: number }

/** IDA*: raise the bound one round at a time; the first round that finds a solution proves it shortest. */
export function ida(t: Tables, start: number, floor: FloorName): Search {
  const h = floorOf(t, floor)
  const { permMove, twistMove, dist, rings } = t
  const path: number[] = []
  let nodes = 0
  let byRing: number[] = []
  const FOUND = -1
  const dfs = (s: number, g: number, bound: number, lastFace: number): number => {
    nodes++
    byRing[dist[s]]++
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
    byRing = rings.map(() => 0)
    const before = nodes
    const r = dfs(start, 0, bound, -1)
    rounds.push({ bound, nodes: nodes - before, byRing })
    if (r === FOUND) break
    bound = r
  }
  return { moves: path.map((j) => SEARCH_MOVES[j]), rounds, nodes, ms: performance.now() - t0, floorAtStart }
}

export type SolveReport = {
  /** The position, as an index with DBL held still. */
  start: number
  trueDistance: number
  floor: FloorName
  floorAtStart: number
  rounds: Round[]
  nodes: number
  ms: number
  /** The proven-shortest solution, as moves on the cube the way you hold it. */
  solution: string[]
  /** The same search with each floor, for comparison. */
  compare: Record<FloorName, { nodes: number; ms: number; floorAtStart: number; rounds: number }>
}

export function solve(t: Tables, position: readonly string[], floor: FloorName): SolveReport {
  const { rel, turn } = canonical(applyMoves(SOLVED, position))
  const start = indexOf(rel)
  const runs = Object.fromEntries(FLOORS.map((f) => [f, ida(t, start, f)])) as Record<FloorName, Search>
  const main = runs[floor]
  return {
    start,
    trueDistance: t.dist[start],
    floor,
    floorAtStart: main.floorAtStart,
    rounds: main.rounds,
    nodes: main.nodes,
    ms: main.ms,
    solution: toHeldView(main.moves, turn),
    compare: Object.fromEntries(
      FLOORS.map((f) => [
        f,
        { nodes: runs[f].nodes, ms: runs[f].ms, floorAtStart: runs[f].floorAtStart, rounds: runs[f].rounds.length },
      ]),
    ) as SolveReport['compare'],
  }
}

/** An optimal solution read straight off the truth table: always step to a neighbour one ring in. */
export function downhill(t: Tables, index: number): string[] {
  const { permMove, twistMove, dist } = t
  const out: string[] = []
  let s = index
  while (s !== 0) {
    const p = (s / NT) | 0
    const o = s - p * NT
    for (let j = 0; j < 9; j++) {
      const n = permMove[p * 9 + j] * NT + twistMove[o * 9 + j]
      if (dist[n] === dist[s] - 1) {
        out.push(SEARCH_MOVES[j])
        s = n
        break
      }
    }
  }
  return out
}

/** A uniformly random position (on a given ring, if asked), as the moves that make it from solved. */
export function randomPosition(t: Tables, ring?: number, rand: () => number = Math.random): string[] {
  if (ring === 0) return []
  let idx: number
  do idx = Math.floor(rand() * N)
  while (ring !== undefined && t.dist[idx] !== ring)
  return invertMoves(downhill(t, idx))
}
