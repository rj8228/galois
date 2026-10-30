import { compose, MOVABLE, MOVES, N, NP, NT, permRank, permUnrank, SOLVED, twistDigits } from './cube2.ts'

/** The solver's nine moves (DBL held still): U U2 U′ R R2 R′ F F2 F′. */
export const SEARCH_MOVES = MOVES.slice(0, 9).map((m) => m.name)
const SEARCH = MOVES.slice(0, 9)
const LABEL = [0, 1, 2, 3, 4, 5, -1, 6]

export type CornerFloor = { corners: number[]; table: Int8Array; entries: number }

export type Tables = {
  /** Where each permutation goes under each move (NP × 9). */
  permMove: Uint16Array
  /** Where each twist pattern goes under each move (NT × 9). */
  twistMove: Uint16Array
  /** Which corner is in each movable slot, per permutation (NP × 7). */
  perm7: Uint8Array
  /** Which movable slot each corner is in, per permutation (NP × 7). */
  loc7: Uint8Array
  /** The twist in each movable slot, per twist pattern (NT × 7). */
  twist7: Uint8Array
  /** Floors: exact distances in smaller puzzles that ignore part of the cube. */
  twistFloor: Uint8Array
  permFloor: Uint8Array
  /** The strong floor's two five-corner views, built the first time they are needed. */
  cornerFloors: CornerFloor[] | null
}

export function moveTables() {
  const permMove = new Uint16Array(NP * 9)
  const perm7 = new Uint8Array(NP * 7)
  const loc7 = new Uint8Array(NP * 7)
  for (let r = 0; r < NP; r++) {
    const p = permUnrank(r)
    const cp = [0, 1, 2, 3, 4, 5, 6, 7]
    MOVABLE.forEach((slot, k) => {
      cp[slot] = MOVABLE[p[k]]
      perm7[r * 7 + k] = p[k]
      loc7[r * 7 + p[k]] = k
    })
    const base = { cp, co: [0, 0, 0, 0, 0, 0, 0, 0] }
    for (let j = 0; j < 9; j++) {
      const t = compose(base, SEARCH[j].t)
      permMove[r * 9 + j] = permRank(MOVABLE.map((k) => LABEL[t.cp[k]]))
    }
  }
  const twistMove = new Uint16Array(NT * 9)
  const twist7 = new Uint8Array(NT * 7)
  for (let o = 0; o < NT; o++) {
    const d = twistDigits(o)
    const co = [0, 0, 0, 0, 0, 0, 0, 0]
    MOVABLE.forEach((slot, k) => {
      co[slot] = d[k]
      twist7[o * 7 + k] = d[k]
    })
    for (let j = 0; j < 9; j++) {
      const t = compose({ cp: SOLVED.cp, co }, SEARCH[j].t)
      let idx = 0
      for (let k = 5; k >= 0; k--) idx = idx * 3 + t.co[MOVABLE[k]]
      twistMove[o * 9 + j] = idx
    }
  }
  return { permMove, twistMove, perm7, loc7, twist7 }
}

/**
 * Breadth-first search from solved over all 3,674,160 positions, one ring at a time.
 * The app never runs this; the tests and the lab use it to check the solver against the truth.
 */
export function truthTable(permMove: Uint16Array, twistMove: Uint16Array) {
  const dist = new Int8Array(N).fill(-1)
  dist[0] = 0
  const rings = [1]
  for (let d = 0; ; d++) {
    let found = 0
    for (let s = 0; s < N; s++) {
      if (dist[s] !== d) continue
      const p = (s / NT) | 0
      const o = s - p * NT
      for (let j = 0; j < 9; j++) {
        const t = permMove[p * 9 + j] * NT + twistMove[o * 9 + j]
        if (dist[t] === -1) {
          dist[t] = d + 1
          found++
        }
      }
    }
    if (!found) break
    rings.push(found)
  }
  return { dist, rings }
}

/** Exact distances in a puzzle that sees only one coordinate (twists alone, or positions alone). */
function coordinateFloor(move: Uint16Array, n: number): Uint8Array {
  const d = new Uint8Array(n).fill(255)
  d[0] = 0
  let frontier = [0]
  for (let k = 0; frontier.length; k++) {
    const next: number[] = []
    for (const i of frontier) {
      for (let j = 0; j < 9; j++) {
        const t = move[i * 9 + j]
        if (d[t] === 255) {
          d[t] = k + 1
          next.push(t)
        }
      }
    }
    frontier = next
  }
  return d
}

/**
 * Exact distances in the smaller puzzle where only some corners are tracked (slot and twist).
 * It is a coset view of the cube, so its distance can never exceed the real one.
 */
export function cornerFloor(corners: number[]): CornerFloor {
  const k = corners.length
  const pow = Array.from({ length: k }, (_, t) => 21 ** t)
  const slotTo = new Uint8Array(9 * 7)
  const twistAdd = new Uint8Array(9 * 7)
  SEARCH.forEach(({ t }, j) => {
    for (let i = 0; i < 8; i++) {
      const src = t.cp[i]
      if (src === 6) continue
      slotTo[j * 7 + LABEL[src]] = LABEL[i]
      twistAdd[j * 7 + LABEL[src]] = t.co[i]
    }
  })
  const table = new Int8Array(21 ** k).fill(-1)
  const start = corners.reduce((acc, c, t) => acc + c * 3 * pow[t], 0)
  table[start] = 0
  let frontier = new Int32Array([start])
  let entries = 1
  const slot = new Array<number>(k)
  const tw = new Array<number>(k)
  for (let d = 0; frontier.length; d++) {
    const next = new Int32Array(frontier.length * 9)
    let n = 0
    for (const key of frontier) {
      let rest = key
      for (let t = 0; t < k; t++) {
        const digit = rest % 21
        rest = (rest - digit) / 21
        slot[t] = (digit / 3) | 0
        tw[t] = digit % 3
      }
      for (let j = 0; j < 9; j++) {
        let nk = 0
        for (let t = 0; t < k; t++) {
          const s = slot[t]
          nk += (slotTo[j * 7 + s] * 3 + ((tw[t] + twistAdd[j * 7 + s]) % 3)) * pow[t]
        }
        if (table[nk] === -1) {
          table[nk] = d + 1
          next[n++] = nk
          entries++
        }
      }
    }
    frontier = next.subarray(0, n)
  }
  return { corners, table, entries }
}

/** The two five-corner views used by the strong floor. */
export const STRONG_CORNERS = [
  [0, 1, 2, 3, 5],
  [0, 3, 4, 5, 6],
]

/** The move tables and the two small floors: a few milliseconds, and no scan of the cube's positions. */
export function buildTables(): Tables {
  const mv = moveTables()
  return {
    ...mv,
    twistFloor: coordinateFloor(mv.twistMove, NT),
    permFloor: coordinateFloor(mv.permMove, NP),
    cornerFloors: null,
  }
}

/** Builds the strong floor's corner views (about 1.2 million entries) if they are not built yet. */
export function ensureStrong(t: Tables): CornerFloor[] {
  t.cornerFloors ??= STRONG_CORNERS.map(cornerFloor)
  return t.cornerFloors
}
