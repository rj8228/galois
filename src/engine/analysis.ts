import type { Alg } from 'cubing/alg'
import type { KPuzzle, KTransformation } from 'cubing/kpuzzle'
import { ORBITS, type OrbitName } from './pieces.ts'

/** One cycle of pieces: each piece moves to the next position, and the last back to the first. */
export type Cycle = {
  /** Position indices in the order pieces travel: pieces[0] goes to pieces[1], and so on. */
  positions: number[]
  /** Total twist the pieces pick up going once round the cycle (mod 3 for corners, mod 2 for edges). */
  twist: number
}

export type OrbitAnalysis = {
  orbit: OrbitName
  label: string
  names: readonly string[]
  /** Cycles of length 2 or more. */
  cycles: Cycle[]
  /** Pieces that stay put but are twisted (corners) or flipped (edges), with their twist. */
  twistedInPlace: { position: number; twist: number }[]
  /** How many pieces change position or orientation. */
  affected: number
  /** Permutation parity: even if it can be made from an even number of swaps. */
  parity: 'even' | 'odd'
  /** Sum of all twists, mod 3 (corners) or 2 (edges). Always 0 on a real cube. */
  twistSum: number
  /** Cycles of individual stickers, as lengths (a twisted 4-cycle of corners is one 12-cycle of stickers). */
  stickerCycleLengths: number[]
}

export type Analysis = {
  order: number
  orbits: OrbitAnalysis[]
  /** True when the permutation parities agree, as they must on a real cube. */
  parityMatches: boolean
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const lcm = (a: number, b: number) => (a * b) / gcd(a, b)

function analyseOrbit(t: KTransformation, orbit: (typeof ORBITS)[number]): OrbitAnalysis {
  const { permutation, orientationDelta } = t.transformationData[orbit.name]
  const n = permutation.length
  // cubing.js: position i receives the piece from position permutation[i]. Invert it so we can
  // follow a piece forward: the piece at position j moves to dest[j].
  const dest = new Array<number>(n)
  permutation.forEach((from, to) => {
    dest[from] = to
  })
  const twistOf = (position: number) => (orbit.twists > 1 ? orientationDelta[position] % orbit.twists : 0)

  const seen = new Set<number>()
  const cycles: Cycle[] = []
  const twistedInPlace: { position: number; twist: number }[] = []
  const stickerCycleLengths: number[] = []
  let cycleCount = 0
  for (let start = 0; start < n; start++) {
    if (seen.has(start)) continue
    cycleCount++
    const positions: number[] = []
    let twist = 0
    for (let p = start; !seen.has(p); p = dest[p]) {
      seen.add(p)
      positions.push(p)
      twist += twistOf(dest[p])
    }
    twist = orbit.twists > 1 ? twist % orbit.twists : 0
    if (positions.length > 1) cycles.push({ positions, twist })
    else if (twist !== 0) twistedInPlace.push({ position: start, twist })
    // Stickers: an untwisted k-cycle of pieces with s stickers each is s separate k-cycles;
    // a twisted one joins them into a single cycle of length k·s (s = number of twists).
    if (positions.length > 1 || twist !== 0) {
      const stickers = orbit.name === 'CENTERS' ? 1 : orbit.twists
      if (twist === 0) for (let s = 0; s < stickers; s++) stickerCycleLengths.push(positions.length)
      else stickerCycleLengths.push(positions.length * stickers)
    }
  }
  const affected = permutation.filter((from, to) => from !== to || twistOf(to) !== 0).length
  const twistSum = orbit.twists > 1 ? orientationDelta.reduce((a, b) => a + b, 0) % orbit.twists : 0
  return {
    orbit: orbit.name,
    label: orbit.label,
    names: orbit.names,
    cycles,
    twistedInPlace,
    affected,
    parity: (n - cycleCount) % 2 === 0 ? 'even' : 'odd',
    twistSum,
    stickerCycleLengths: stickerCycleLengths.sort((a, b) => b - a),
  }
}

/**
 * Full analysis of a sequence. The order comes from the cycle structure: a k-cycle returns
 * after k repeats, or 3k (corners) / 2k (edges) if the pieces come back twisted.
 */
export function analyse(kpuzzle: KPuzzle, alg: Alg | string): Analysis {
  const t = kpuzzle.algToTransformation(alg)
  const orbits = ORBITS.map((o) => analyseOrbit(t, o))
  let order = 1
  for (const o of orbits) {
    const twists = ORBITS.find((x) => x.name === o.orbit)?.twists ?? 1
    for (const c of o.cycles) order = lcm(order, c.positions.length * (c.twist ? twists : 1))
    for (const p of o.twistedInPlace) order = lcm(order, p.twist ? twists : 1)
  }
  const parities = orbits.map((o) => (o.parity === 'odd' ? 1 : 0) as number)
  return { order, orbits, parityMatches: parities.reduce((a, b) => a + b, 0) % 2 === 0 }
}

/** Where a piece (by identity, starting from solved) sits after each move of a sequence. */
export function tracePiece(kpuzzle: KPuzzle, moves: string[], orbit: OrbitName, piece: number): number[] {
  const path: number[] = [piece]
  let pattern = kpuzzle.defaultPattern()
  for (const move of moves) {
    pattern = pattern.applyMove(move)
    path.push(pattern.patternData[orbit].pieces.indexOf(piece))
  }
  return path
}

/** A cubing.js stickering mask string: highlighted pieces normal, all others dimmed. */
export function highlightMask(highlight: Partial<Record<OrbitName, number[]>>): string {
  return ORBITS.map((o) => {
    const on = new Set(highlight[o.name] ?? [])
    return `${o.name}:${o.names.map((_, i) => (on.has(i) ? '-' : 'D')).join('')}`
  }).join(',')
}

/** Pieces (by their solved-state identity) that a sequence moves or twists, when started from solved. */
export function affectedPieces(analysis: Analysis): Partial<Record<OrbitName, number[]>> {
  const out: Partial<Record<OrbitName, number[]>> = {}
  for (const o of analysis.orbits) {
    out[o.orbit] = [...o.cycles.flatMap((c) => c.positions), ...o.twistedInPlace.map((p) => p.position)]
  }
  return out
}
