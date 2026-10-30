/**
 * The 2×2×2 as a permutation group: eight corners, each in a slot and twisted 0, 1 or 2.
 * Slots and corners share Kociemba's labels, in this order.
 *
 * The solver holds the DBL corner still, which removes whole-cube rotations: then U, R and F
 * are enough, and a position is two numbers, `perm` (7! = 5040) and `twist` (3^6 = 729).
 */
export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const

export type Corners = { cp: number[]; co: number[] }
export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'

const BASE: Record<Face, Corners> = {
  U: { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0] },
  R: { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2] },
  F: { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0] },
  D: { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0] },
  L: { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0] },
  B: { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1] },
}

export const SOLVED: Corners = { cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0] }

/** a, then b: slot i receives the corner that was in slot b.cp[i], twisted by b.co[i]. */
export function compose(a: Corners, b: Corners): Corners {
  const cp = new Array<number>(8)
  const co = new Array<number>(8)
  for (let i = 0; i < 8; i++) {
    cp[i] = a.cp[b.cp[i]]
    co[i] = (a.co[b.cp[i]] + b.co[i]) % 3
  }
  return { cp, co }
}

export function invert(a: Corners): Corners {
  const cp = new Array<number>(8)
  const co = new Array<number>(8)
  for (let i = 0; i < 8; i++) {
    cp[a.cp[i]] = i
    co[a.cp[i]] = (3 - a.co[i]) % 3
  }
  return { cp, co }
}

export const same = (a: Corners, b: Corners) =>
  a.cp.every((v, i) => v === b.cp[i]) && a.co.every((v, i) => v === b.co[i])

const FACES: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']
const SUFFIX = ['', '2', "'"]

/** All 18 face turns: U U2 U′ R R2 R′ F F2 F′ D … B′. The first nine are the solver's moves. */
export const MOVES: { name: string; face: Face; t: Corners }[] = FACES.flatMap((f) => {
  const m1 = BASE[f]
  const m2 = compose(m1, m1)
  const m3 = compose(m2, m1)
  return [m1, m2, m3].map((t, k) => ({ name: f + SUFFIX[k], face: f, t }))
})
const BY_NAME = new Map(MOVES.map((m) => [m.name, m]))

function moveT(name: string): Corners {
  const m = BY_NAME.get(name)
  if (!m) throw new Error(`Not a 2×2 face turn: ${name}`)
  return m.t
}

/** Face turns such as "R U2 F'". Returns null for anything that is not a 2×2 face turn. */
export function parseMoves(text: string): string[] | null {
  const out: string[] = []
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([URFDLB])(2'?|'|’)?$/.exec(token)
    if (!m) return null
    out.push(m[1] + (m[2] === undefined ? '' : m[2].startsWith('2') ? '2' : "'"))
  }
  return out
}

export function applyMoves(state: Corners, moves: readonly string[]): Corners {
  let s = state
  for (const name of moves) {
    s = compose(s, moveT(name))
  }
  return s
}

export const invertMove = (m: string) => (m.endsWith("'") ? m[0] : m.endsWith('2') ? m : `${m}'`)
export const invertMoves = (moves: readonly string[]) => moves.toReversed().map(invertMove)

/** The name of the face turn that a transformation is, or null if it is not one. */
export function moveName(t: Corners): string | null {
  return MOVES.find((m) => same(m.t, t))?.name ?? null
}

// On a 2×2 a whole-cube turn is two opposite layers turned together: x = R L′, y = U D′, z = F B′.
const turnCube = (a: string, b: string) => compose(moveT(a), moveT(b))

/** The 24 ways to hold the cube, as transformations of the corners. */
export const ROTATIONS: Corners[] = (() => {
  const gens = [turnCube('R', "L'"), turnCube('U', "D'"), turnCube('F', "B'")]
  const seen = [SOLVED]
  for (let i = 0; i < seen.length; i++) {
    for (const g of gens) {
      const next = compose(seen[i], g)
      if (!seen.some((s) => same(s, next))) seen.push(next)
    }
  }
  return seen
})()

/**
 * Turns the whole cube so the DBL corner sits home, untwisted. Returns that view of the position
 * and the turn used. Exactly one of the 24 turns does it.
 */
export function canonical(s: Corners): { rel: Corners; turn: Corners } {
  for (const turn of ROTATIONS) {
    const rel = compose(s, turn)
    if (rel.cp[6] === 6 && rel.co[6] === 0) return { rel, turn }
  }
  throw new Error('No whole-cube turn brings DBL home')
}

/**
 * The solver works in the turned view. Each of its moves m becomes turn · m · turn⁻¹ on the cube
 * as you hold it, which is again a face turn. Played in order from the position, those moves
 * leave the cube solved, possibly turned as a whole.
 */
export function toHeldView(searchMoves: readonly string[], turn: Corners): string[] {
  const back = invert(turn)
  return searchMoves.map((name) => {
    const held = moveName(compose(compose(turn, moveT(name)), back))
    if (!held) throw new Error(`Turned move is not a face turn: ${name}`)
    return held
  })
}

/** Solved up to holding the cube differently: the position is one of the 24 rotations. */
export const isSolvedAnyWay = (s: Corners) => ROTATIONS.some((r) => same(r, s))

// ---- Coordinates (DBL held still) ----

export const NP = 5040
export const NT = 729
export const N = NP * NT
/** The seven slots that move when DBL is held still. */
export const MOVABLE = [0, 1, 2, 3, 4, 5, 7]
const LABEL = [0, 1, 2, 3, 4, 5, -1, 6]
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040]

/** Lexicographic rank of a permutation of 0..6. */
export function permRank(p: ArrayLike<number>): number {
  let r = 0
  for (let i = 0; i < 7; i++) {
    let smaller = 0
    for (let j = i + 1; j < 7; j++) if (p[j] < p[i]) smaller++
    r += smaller * FACT[6 - i]
  }
  return r
}

export function permUnrank(r: number): number[] {
  const pool = [0, 1, 2, 3, 4, 5, 6]
  const out: number[] = []
  for (let i = 6; i >= 0; i--) {
    const k = Math.floor(r / FACT[i])
    r %= FACT[i]
    out.push(pool.splice(k, 1)[0])
  }
  return out
}

/** Twist of each of the seven movable slots; the seventh is forced by the other six. */
export function twistDigits(t: number): number[] {
  const d: number[] = []
  let sum = 0
  for (let k = 0; k < 6; k++) {
    d.push(t % 3)
    sum += t % 3
    t = Math.floor(t / 3)
  }
  d.push((3 - (sum % 3)) % 3)
  return d
}

/** The index (0 … 3,674,159) of a position whose DBL corner is home and untwisted. */
export function indexOf(rel: Corners): number {
  const p = permRank(MOVABLE.map((k) => LABEL[rel.cp[k]]))
  let t = 0
  for (let k = 5; k >= 0; k--) t = t * 3 + rel.co[MOVABLE[k]]
  return p * NT + t
}

export function stateOf(index: number): Corners {
  const p = permUnrank(Math.floor(index / NT))
  const d = twistDigits(index % NT)
  const cp = [0, 1, 2, 3, 4, 5, 6, 7]
  const co = [0, 0, 0, 0, 0, 0, 0, 0]
  MOVABLE.forEach((slot, k) => {
    cp[slot] = MOVABLE[p[k]]
    co[slot] = d[k]
  })
  return { cp, co }
}
