import { applyMoves, CO, CP, type Cube, EO, EP, invertMoves, parseMoves, SOLVED } from '../../solver3/cube3.ts'
import { CORNER_LABELS } from '../labels.ts'

/**
 * The top layer from above, front at the bottom: which stickers show the top colour.
 * `grid` is the 3×3 top face, row by row from the back; `back`, `front`, `left`, `right` are the
 * top layer's side stickers, left to right as seen from above (back and front) or back to front (sides).
 */
export type TopView = {
  grid: boolean[][]
  back: boolean[]
  front: boolean[]
  left: boolean[]
  right: boolean[]
}

// Kociemba's corner slots list their faces clockwise: URF (U R F), UFL (U F L), ULB (U L B), UBR (U B R).
// A corner's twist t puts its U/D sticker on the slot's face number t.
type Side = 'U' | 'R' | 'F' | 'L' | 'B'
const CORNER_FACES: Side[][] = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
]
const EDGE_SIDE: Side[] = ['R', 'F', 'L', 'B']

/** Which face of a top corner slot shows the top colour, or null when the piece there has none. */
function cornerTopFace(c: Cube, slot: number): Side | null {
  if (c[CP + slot] >= 4) return null
  return CORNER_FACES[slot][c[CO + slot]]
}

function edgeTopFace(c: Cube, slot: number): Side | null {
  if (c[EP + slot] >= 4) return null
  return c[EO + slot] === 0 ? 'U' : EDGE_SIDE[slot]
}

export function topView(c: Cube): TopView {
  const cf = [0, 1, 2, 3].map((s) => cornerTopFace(c, s))
  const ef = [0, 1, 2, 3].map((s) => edgeTopFace(c, s))
  // Slots: corners 0 URF (front right), 1 UFL (front left), 2 ULB (back left), 3 UBR (back right);
  // edges 0 UR, 1 UF, 2 UL, 3 UB.
  return {
    grid: [
      [cf[2] === 'U', ef[3] === 'U', cf[3] === 'U'],
      [ef[2] === 'U', true, ef[0] === 'U'],
      [cf[1] === 'U', ef[1] === 'U', cf[0] === 'U'],
    ],
    back: [cf[2] === 'B', ef[3] === 'B', cf[3] === 'B'],
    front: [cf[1] === 'F', ef[1] === 'F', cf[0] === 'F'],
    left: [cf[2] === 'L', ef[2] === 'L', cf[1] === 'L'],
    right: [cf[3] === 'R', ef[0] === 'R', cf[0] === 'R'],
  }
}

export type Twist = { slot: string; twist: number }

/**
 * The twist of the corner in each top slot (0, 1 or 2: how far clockwise its top-or-bottom sticker
 * has turned), in the design's order UBL, URB, ULF, UFR. `rest` is the twist of the four bottom
 * corners together, so `sum` (all eight) is always a multiple of 3.
 */
export function twists(c: Cube): { top: Twist[]; rest: number; sum: number } {
  const order = [2, 3, 1, 0]
  const top = order.map((s) => ({ slot: CORNER_LABELS[s], twist: c[CO + s] }))
  let rest = 0
  for (let s = 4; s < 8; s++) rest += c[CO + s]
  return { top, rest, sum: top.reduce((n, t) => n + t.twist, 0) + rest }
}

/** The seven top-colour cases with the cross done, each with an algorithm that solves it. */
export const TOP_CASES = [
  { name: 'Sune', nick: 'fish', alg: "R U R' U R U2 R'" },
  { name: 'Antisune', nick: 'fish', alg: "R U2 R' U' R U' R'" },
  { name: 'H', nick: 'double headlights', alg: "R U R' U R U' R' U R U2 R'" },
  { name: 'Pi', nick: 'bruno', alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { name: 'Headlights', nick: 'U', alg: "R2 D R' U2 R D' R' U2 R'" },
  { name: 'Chameleon', nick: 'T', alg: "L F R' F' L' F R F'" },
  { name: 'Bowtie', nick: 'L', alg: "F' L F R' F' L' F R" },
] as const

export type TopCase = (typeof TOP_CASES)[number]

// Top corner slots in order around the top, so a turn of U rotates the pattern.
const AROUND = [0, 1, 2, 3]

/** The twists around the top as a string, the same whichever way the top is turned (the least rotation). */
function signature(c: Cube): string | null {
  for (const s of [0, 1, 2, 3]) {
    if (c[CP + s] >= 4) return null
    if (c[EP + s] >= 4 || c[EO + s] !== 0) return null
  }
  const t = AROUND.map((s) => c[CO + s])
  if (t.every((x) => x === 0)) return null
  const rotations = [0, 1, 2, 3].map((k) => [...t.slice(k), ...t.slice(0, k)].join(''))
  return rotations.sort()[0]
}

const CASE_BY_SIGNATURE = new Map<string, TopCase>()
for (const tc of TOP_CASES) {
  const moves = parseMoves(tc.alg)
  if (!moves) continue
  // The case an algorithm solves is the position its inverse makes.
  const sig = signature(applyMoves(SOLVED, invertMoves(moves)))
  if (sig) CASE_BY_SIGNATURE.set(sig, tc)
}

/**
 * The named case, when every top slot holds a top piece, the top edges are all flat (the cross is
 * done) and some corner is twisted. Otherwise null.
 */
export function topCase(c: Cube): TopCase | null {
  const sig = signature(c)
  return sig ? (CASE_BY_SIGNATURE.get(sig) ?? null) : null
}
