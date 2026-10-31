/**
 * The 3×3×3 as a permutation group: eight corners (slot, twist 0–2) and twelve edges (slot, flip
 * 0–1). The centres never move, because only face turns are allowed. Slots and pieces share
 * Kociemba's labels, in this order.
 *
 * A position is one flat typed array of 40 bytes, so the search can keep a stack of them:
 * corner places, corner twists, edge places, edge flips.
 */
export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const
export const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'] as const

export type Cube = Uint8Array
export const CP = 0
export const CO = 8
export const EP = 16
export const EO = 28
export const SIZE = 40

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const
export type Face = (typeof FACES)[number]

type Cubies = { cp: number[]; co: number[]; ep: number[]; eo: number[] }
const Z8 = [0, 0, 0, 0, 0, 0, 0, 0]
const Z12 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

/** Kociemba's quarter turns, clockwise: slot i receives the piece that was in slot cp[i] (or ep[i]). */
const BASE: Record<Face, Cubies> = {
  U: { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: Z8, ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: Z12 },
  R: {
    cp: [4, 1, 2, 0, 7, 5, 6, 3],
    co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
    eo: Z12,
  },
  F: {
    cp: [1, 5, 2, 3, 0, 4, 6, 7],
    co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  D: { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: Z8, ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: Z12 },
  L: {
    cp: [0, 2, 6, 3, 4, 1, 5, 7],
    co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
    eo: Z12,
  },
  B: {
    cp: [0, 1, 3, 7, 4, 5, 2, 6],
    co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
}

export function solved(): Cube {
  const c = new Uint8Array(SIZE)
  for (let i = 0; i < 8; i++) c[CP + i] = i
  for (let i = 0; i < 12; i++) c[EP + i] = i
  return c
}

export const SOLVED: Cube = solved()

function fromCubies({ cp, co, ep, eo }: Cubies): Cube {
  return Uint8Array.from([...cp, ...co, ...ep, ...eo])
}

/** a, then b: slot i receives the piece that a left in slot b's source for i, with the twists added. */
export function multiply(a: Cube, b: Cube, out: Cube = new Uint8Array(SIZE)): Cube {
  for (let i = 0; i < 8; i++) {
    const from = b[CP + i]
    out[CP + i] = a[CP + from]
    out[CO + i] = (a[CO + from] + b[CO + i]) % 3
  }
  for (let i = 0; i < 12; i++) {
    const from = b[EP + i]
    out[EP + i] = a[EP + from]
    out[EO + i] = a[EO + from] ^ b[EO + i]
  }
  return out
}

export function invert(a: Cube): Cube {
  const out = new Uint8Array(SIZE)
  for (let i = 0; i < 8; i++) {
    out[CP + a[CP + i]] = i
    out[CO + a[CP + i]] = (3 - a[CO + i]) % 3
  }
  for (let i = 0; i < 12; i++) {
    out[EP + a[EP + i]] = i
    out[EO + a[EP + i]] = a[EO + i]
  }
  return out
}

export const same = (a: Cube, b: Cube) => a.every((v, i) => v === b[i])
export const isSolved = (a: Cube) => same(a, SOLVED)

const SUFFIX = ['', '2', "'"]

/** All 18 face turns, in the order U U2 U′ R R2 R′ F F2 F′ D … B′. Move j turns face ⌊j/3⌋. */
export const MOVES: { name: string; face: number; t: Cube }[] = FACES.flatMap((f, face) => {
  const m1 = fromCubies(BASE[f])
  const m2 = multiply(m1, m1)
  const m3 = multiply(m2, m1)
  return [m1, m2, m3].map((t, k) => ({ name: f + SUFFIX[k], face, t }))
})
export const MOVE_NAMES = MOVES.map((m) => m.name)
const INDEX = new Map(MOVES.map((m, j) => [m.name, j]))

export function moveIndex(name: string): number {
  const j = INDEX.get(name)
  if (j === undefined) throw new Error(`Not a face turn: ${name}`)
  return j
}

/** Face turns such as "R U2 F'". Returns null for anything that is not a face turn. */
export function parseMoves(text: string): string[] | null {
  const out: string[] = []
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([URFDLB])(2'?|'|’)?$/.exec(token)
    if (!m) return null
    out.push(m[1] + (m[2] === undefined ? '' : m[2].startsWith('2') ? '2' : "'"))
  }
  return out
}

export function applyMoves(cube: Cube, moves: readonly string[]): Cube {
  let c = cube
  for (const name of moves) c = multiply(c, MOVES[moveIndex(name)].t)
  return c
}

export const invertMove = (m: string) => (m.endsWith("'") ? m[0] : m.endsWith('2') ? m : `${m}'`)
export const invertMoves = (moves: readonly string[]) => moves.toReversed().map(invertMove)

/** A short string that names the position, for sets and maps. */
export function keyOf(c: Cube): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += String.fromCharCode(65 + c[CP + i] * 3 + c[CO + i])
  for (let i = 0; i < 12; i++) s += String.fromCharCode(65 + c[EP + i] * 2 + c[EO + i])
  return s
}

/** Whether the arrays describe a position reachable by face turns: twists, flips and parities all add up. */
export function isLegal(c: Cube): boolean {
  const perm = (off: number, n: number) => {
    const seen = new Set<number>()
    for (let i = 0; i < n; i++) seen.add(c[off + i])
    return seen.size === n && [...seen].every((v) => v < n)
  }
  if (!perm(CP, 8) || !perm(EP, 12)) return false
  let twist = 0
  let flip = 0
  for (let i = 0; i < 8; i++) twist += c[CO + i]
  for (let i = 0; i < 12; i++) flip += c[EO + i]
  return twist % 3 === 0 && flip % 2 === 0 && parity(c, CP, 8) === parity(c, EP, 12)
}

function parity(c: Cube, off: number, n: number): number {
  let p = 0
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (c[off + j] < c[off + i]) p ^= 1
  return p
}

// ---- cubing.js's 3×3×3 KPuzzle, which numbers the same pieces differently ----

/** cubing.js's slot for each of Kociemba's corners: UFR URB UBL ULF DRF DFL DLB DBR. */
export const CUBING_CORNER = [0, 3, 2, 1, 4, 5, 6, 7]
/** cubing.js's slot for each of Kociemba's edges: UF UR UB UL DF DR DB DL FR FL BR BL. */
export const CUBING_EDGE = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10]

export type OrbitData = { pieces: number[]; orientation: number[] }

/** The position as cubing.js pattern data (twists and flips are measured the same way in both). */
export function toCubing(c: Cube): { CORNERS: OrbitData; EDGES: OrbitData } {
  const corners = { pieces: new Array<number>(8), orientation: new Array<number>(8) }
  const edges = { pieces: new Array<number>(12), orientation: new Array<number>(12) }
  for (let i = 0; i < 8; i++) {
    corners.pieces[CUBING_CORNER[i]] = CUBING_CORNER[c[CP + i]]
    corners.orientation[CUBING_CORNER[i]] = c[CO + i]
  }
  for (let i = 0; i < 12; i++) {
    edges.pieces[CUBING_EDGE[i]] = CUBING_EDGE[c[EP + i]]
    edges.orientation[CUBING_EDGE[i]] = c[EO + i]
  }
  return { CORNERS: corners, EDGES: edges }
}

export function fromCubing(data: { CORNERS: OrbitData; EDGES: OrbitData }): Cube {
  const c = new Uint8Array(SIZE)
  const corner = invertIndex(CUBING_CORNER)
  const edge = invertIndex(CUBING_EDGE)
  for (let i = 0; i < 8; i++) {
    c[CP + i] = corner[data.CORNERS.pieces[CUBING_CORNER[i]]]
    c[CO + i] = data.CORNERS.orientation[CUBING_CORNER[i]]
  }
  for (let i = 0; i < 12; i++) {
    c[EP + i] = edge[data.EDGES.pieces[CUBING_EDGE[i]]]
    c[EO + i] = data.EDGES.orientation[CUBING_EDGE[i]]
  }
  return c
}

function invertIndex(a: number[]): number[] {
  const out = new Array<number>(a.length)
  a.forEach((v, i) => {
    out[v] = i
  })
  return out
}
