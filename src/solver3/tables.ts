import { CO, CP, type Cube, EO, EP, MOVES, multiply, SIZE, SOLVED } from './cube3.ts'

/**
 * Coordinates: numbers that see only part of the cube. Each one is a smaller puzzle in its own
 * right, because a face turn moves it to a value that depends only on the value it had.
 */
export const N_TWIST = 2187 // 3^7: the eighth corner's twist is forced by the other seven
export const N_FLIP = 2048 // 2^11
export const N_SLICE = 495 // C(12, 4): which four slots hold the FR, FL, BL, BR edges
export const N_CPERM = 40320 // 8!

export function twistOf(c: Cube): number {
  let t = 0
  for (let i = 6; i >= 0; i--) t = t * 3 + c[CO + i]
  return t
}

export function flipOf(c: Cube): number {
  let f = 0
  for (let i = 10; i >= 0; i--) f = f * 2 + c[EO + i]
  return f
}

const CHOOSE = Array.from({ length: 13 }, (_, n) =>
  Array.from({ length: 5 }, (_, k) => {
    let r = 1
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
    return k > n ? 0 : r
  }),
)

/** The slots of the four middle-layer edges, ranked so that solved is 0. */
export function sliceOf(c: Cube): number {
  let r = 0
  let k = 0
  for (let slot = 11; slot >= 0; slot--) {
    if (c[EP + slot] >= 8) {
      k++
      r += CHOOSE[11 - slot][k]
    }
  }
  return r
}

const FACT = [1, 1, 2, 6, 24, 120, 720, 5040]

/** Lexicographic rank of the corner places; solved is 0. */
export function cpermOf(c: Cube): number {
  let r = 0
  for (let i = 0; i < 8; i++) {
    let smaller = 0
    for (let j = i + 1; j < 8; j++) if (c[CP + j] < c[CP + i]) smaller++
    r += smaller * FACT[7 - i]
  }
  return r
}

/**
 * Where each value of a coordinate goes under each of the 18 moves, found by breadth-first search
 * in the coordinate's own space: every value reached keeps one cube that has it, and the moves
 * are played on that cube. No unranking is needed, and every value must be reached.
 */
export function moveTable(n: number, coord: (c: Cube) => number): Uint16Array {
  const table = new Uint16Array(n * 18)
  const reps = new Uint8Array(n * SIZE)
  const seen = new Uint8Array(n)
  const start = coord(SOLVED)
  reps.set(SOLVED, start * SIZE)
  seen[start] = 1
  const queue = new Uint32Array(n)
  queue[0] = start
  let tail = 1
  const next = new Uint8Array(SIZE)
  for (let head = 0; head < tail; head++) {
    const v = queue[head]
    const rep = reps.subarray(v * SIZE, v * SIZE + SIZE)
    for (let j = 0; j < 18; j++) {
      multiply(rep, MOVES[j].t, next)
      const w = coord(next)
      table[v * 18 + j] = w
      if (!seen[w]) {
        seen[w] = 1
        reps.set(next, w * SIZE)
        queue[tail++] = w
      }
    }
  }
  if (tail !== n) throw new Error(`Coordinate reached ${tail} of ${n} values`)
  return table
}

/** Exact distances from solved in a coordinate puzzle, by breadth-first search. */
export function distanceTable(n: number, move: Uint16Array): Uint8Array {
  return pairDistanceTable(n, move, 1, new Uint16Array(18))
}

/**
 * Exact distances in the puzzle that sees two coordinates at once, indexed a × nb + b, by
 * breadth-first search over its own n × nb values.
 */
export function pairDistanceTable(na: number, moveA: Uint16Array, nb: number, moveB: Uint16Array): Uint8Array {
  const n = na * nb
  const d = new Uint8Array(n).fill(255)
  d[0] = 0
  let frontier = new Uint32Array([0])
  for (let k = 0; frontier.length; k++) {
    const next = new Uint32Array(Math.min(n, frontier.length * 18))
    let len = 0
    for (let f = 0; f < frontier.length; f++) {
      const v = frontier[f]
      const a = (v / nb) | 0
      const b = v - a * nb
      for (let j = 0; j < 18; j++) {
        const w = moveA[a * 18 + j] * nb + moveB[b * 18 + j]
        if (d[w] === 255) {
          d[w] = k + 1
          next[len++] = w
        }
      }
    }
    frontier = next.subarray(0, len)
  }
  if (d.includes(255)) throw new Error('Coordinate puzzle is not connected')
  return d
}

export type Tables = {
  twistMove: Uint16Array
  flipMove: Uint16Array
  sliceMove: Uint16Array
  cpermMove: Uint16Array
  /** Floors: exact distances in the six smaller puzzles. */
  twist: Uint8Array
  flip: Uint8Array
  slice: Uint8Array
  cperm: Uint8Array
  /** Indexed twist × 495 + slice. */
  twistSlice: Uint8Array
  /** Indexed flip × 495 + slice. */
  flipSlice: Uint8Array
}

export const FLOOR_NAMES = ['twist', 'flip', 'slice', 'cperm', 'twistSlice', 'flipSlice'] as const
export type FloorName = (typeof FLOOR_NAMES)[number]

/** All move tables and floors: about 2.2 million entries, built in a fraction of a second. */
export function buildTables(): Tables {
  const twistMove = moveTable(N_TWIST, twistOf)
  const flipMove = moveTable(N_FLIP, flipOf)
  const sliceMove = moveTable(N_SLICE, sliceOf)
  const cpermMove = moveTable(N_CPERM, cpermOf)
  return {
    twistMove,
    flipMove,
    sliceMove,
    cpermMove,
    twist: distanceTable(N_TWIST, twistMove),
    flip: distanceTable(N_FLIP, flipMove),
    slice: distanceTable(N_SLICE, sliceMove),
    cperm: distanceTable(N_CPERM, cpermMove),
    twistSlice: pairDistanceTable(N_TWIST, twistMove, N_SLICE, sliceMove),
    flipSlice: pairDistanceTable(N_FLIP, flipMove, N_SLICE, sliceMove),
  }
}

/** Each floor for this position: moves it certainly needs, according to each smaller puzzle. */
export function floors(t: Tables, c: Cube): Record<FloorName, number> {
  const tw = twistOf(c)
  const fl = flipOf(c)
  const sl = sliceOf(c)
  return {
    twist: t.twist[tw],
    flip: t.flip[fl],
    slice: t.slice[sl],
    cperm: t.cperm[cpermOf(c)],
    twistSlice: t.twistSlice[tw * N_SLICE + sl],
    flipSlice: t.flipSlice[fl * N_SLICE + sl],
  }
}

/** The floor: the highest of the six. It can never exceed the real distance. */
export function floorOf(t: Tables, c: Cube): number {
  return Math.max(...Object.values(floors(t, c)))
}
