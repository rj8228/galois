import type { Analysis, OrbitAnalysis } from '../../engine/analysis.ts'
import { ORBITS, type OrbitName } from '../../engine/pieces.ts'

/** One piece slot on a ring: where it sits, and what the sequence does to it. */
export type RingNode = {
  name: string
  position: number
  /** Which cycle it belongs to (index into the orbit's cycles), or null if it stays put. */
  cycle: number | null
  /** Twist picked up in place (corners 1–2, edges 1), for pieces that stay put. 0 otherwise. */
  twist: number
  /** Angle on the ring, in degrees clockwise from the top. */
  angle: number
}

/**
 * A ring's slots in loop order: each cycle as one unbroken arc, in the order its pieces travel,
 * starting from the top and going clockwise; pieces twisted in place next, then the ones left alone.
 */
export function ringLayout(o: OrbitAnalysis): RingNode[] {
  const n = o.names.length
  const order: Omit<RingNode, 'angle'>[] = []
  o.cycles.forEach((c, i) => {
    for (const p of c.positions) order.push({ name: o.names[p], position: p, cycle: i, twist: 0 })
  })
  const placed = new Set(order.map((x) => x.position))
  for (const t of o.twistedInPlace) {
    order.push({ name: o.names[t.position], position: t.position, cycle: null, twist: t.twist })
    placed.add(t.position)
  }
  for (let p = 0; p < n; p++) if (!placed.has(p)) order.push({ name: o.names[p], position: p, cycle: null, twist: 0 })
  return order.map((x, i) => ({ ...x, angle: (360 * i) / n }))
}

/** One term of the order: a cycle (or a piece twisted alone) and what it contributes to the lcm. */
export type OrderTerm = {
  orbit: OrbitName
  /** The number it adds to the lcm: the cycle length, times 3 (or 2) if its pieces come back turned. */
  value: number
  /** How to write it: "7", "5 × 3", or "3" for a piece twisting alone. */
  text: string
  /** What it is, in a few words: "edges, one loop", "corners, back turned", "UFR twists alone". */
  label: string
}

const NOUN: Record<OrbitName, string> = { CORNERS: 'corners', EDGES: 'edges', CENTERS: 'centres' }

/** The terms of the order, ring by ring (edges, corners, then centres), as the Rings card lists them. */
export function orderTerms(a: Analysis): OrderTerm[] {
  const terms: OrderTerm[] = []
  for (const name of ['EDGES', 'CORNERS', 'CENTERS'] as const) {
    const o = a.orbits.find((x) => x.orbit === name)
    const twists = ORBITS.find((x) => x.name === name)?.twists ?? 1
    if (!o) continue
    const turned = name === 'EDGES' ? 'back flipped' : 'back turned'
    for (const c of o.cycles) {
      const k = c.positions.length
      terms.push({
        orbit: name,
        value: c.twist ? k * twists : k,
        text: c.twist ? `${k} × ${twists}` : `${k}`,
        label: `${NOUN[name]}, ${c.twist ? turned : 'one loop'}`,
      })
    }
    for (const t of o.twistedInPlace) {
      terms.push({
        orbit: name,
        value: twists,
        text: `${twists}`,
        label: `${o.names[t.position]} ${name === 'EDGES' ? 'flips' : 'twists'} alone`,
      })
    }
  }
  return terms
}

/** "order = lcm(7, 15, 3) = 105", or "order = 4" when there's only one distinct term. */
export function orderFormula(a: Analysis): string {
  const values = [...new Set(orderTerms(a).map((t) => t.value))]
  if (values.length <= 1) return `order = ${a.order}`
  return `order = lcm(${values.join(', ')}) = ${a.order}`
}
