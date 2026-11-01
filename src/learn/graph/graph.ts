import { applyMoves, type Cube, isSolved, keyOf, MOVES, moveIndex, multiply, SOLVED } from '../../solver3/cube3.ts'

/** One position in the subgroup: how far it is from solved, and a shortest way there. */
export type GraphNode = {
  dist: number
  path: string[] /** The node one move nearer solved (-1 for solved). */
  parent: number
}

export type Subgroup = {
  nodes: GraphNode[]
  /** Pairs of node indices one allowed move apart (each pair once), with the move. */
  edges: { a: number; b: number; move: string }[]
  /** True when the search stopped at the cap: the group is larger than `nodes`. */
  capped: boolean
  /** The furthest distance found (a lower bound when capped). */
  furthest: number
  /** True when the positions form one single loop. */
  loop: boolean
}

export const CAP = 5000

/** Breadth-first search from solved over the positions the moves reach, stopping at `cap` positions. */
export function explore(moves: string[], cap = CAP): Subgroup {
  const ts = moves.map((m) => MOVES[moveIndex(m)].t)
  const index = new Map<string, number>([[keyOf(SOLVED), 0]])
  const cubes: Cube[] = [SOLVED]
  const nodes: GraphNode[] = [{ dist: 0, path: [], parent: -1 }]
  const seenEdge = new Set<string>()
  const edges: Subgroup['edges'] = []
  let capped = false
  for (let i = 0; i < cubes.length; i++) {
    for (let j = 0; j < ts.length; j++) {
      const next = multiply(cubes[i], ts[j])
      const k = keyOf(next)
      let n = index.get(k)
      if (n === undefined) {
        if (cubes.length >= cap) {
          capped = true
          continue
        }
        n = cubes.length
        index.set(k, n)
        cubes.push(next)
        nodes.push({ dist: nodes[i].dist + 1, path: [...nodes[i].path, moves[j]], parent: i })
      }
      if (n === i) continue
      const key = i < n ? `${i},${n}` : `${n},${i}`
      if (!seenEdge.has(key)) {
        seenEdge.add(key)
        edges.push({ a: i, b: n, move: moves[j] })
      }
    }
  }
  const degree = new Array<number>(nodes.length).fill(0)
  for (const e of edges) {
    degree[e.a]++
    degree[e.b]++
  }
  const loop = !capped && nodes.length > 2 && degree.every((d) => d === 2)
  return { nodes, edges, capped, furthest: Math.max(...nodes.map((n) => n.dist)), loop }
}

/** The order of the product of the moves (all of them in turn): how many repeats return to solved. */
export function productOrder(moves: string[]): number {
  if (moves.length === 0) return 1
  const p = applyMoves(SOLVED, moves)
  let c = p
  for (let n = 1; n <= 1260; n++) {
    if (isSolved(c)) return n
    c = multiply(c, p)
  }
  return Number.NaN
}

/** Node indices in the order they sit around a loop, starting at solved. */
export function loopOrder(g: Subgroup): number[] {
  const next = new Map<number, number[]>()
  for (const e of g.edges) {
    next.set(e.a, [...(next.get(e.a) ?? []), e.b])
    next.set(e.b, [...(next.get(e.b) ?? []), e.a])
  }
  const order = [0]
  let prev = -1
  let at = 0
  while (order.length < g.nodes.length) {
    const step: number | undefined = (next.get(at) ?? []).find((n) => n !== prev)
    if (step === undefined || step === 0) break
    order.push(step)
    prev = at
    at = step
  }
  return order
}
