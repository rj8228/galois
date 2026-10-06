import type { KPuzzle } from 'cubing/kpuzzle'

/** A small, fast seeded random number generator (mulberry32). Same seed, same numbers, every browser. */
export function seededRandom(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Turns a day string into a 32-bit seed (FNV-1a). */
export function seedFor(day: string): number {
  let h = 0x811c9dc5
  for (const ch of `galois-daily-${day}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function parity(p: number[]): number {
  const seen = new Set<number>()
  let swaps = 0
  for (let i = 0; i < p.length; i++) {
    let length = 0
    for (let j = i; !seen.has(j); j = p[j]) {
      seen.add(j)
      length++
    }
    if (length > 0) swaps += length - 1
  }
  return swaps % 2
}

/**
 * A random legal cube position: every reachable position is equally likely.
 * Pieces are shuffled, parities matched, and the last edge and corner orientations fixed so twists sum to 0.
 */
export function randomPositionData(rng: () => number) {
  const shuffle = (n: number) => {
    const a = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const edges = shuffle(12)
  const corners = shuffle(8)
  if (parity(edges) !== parity(corners)) [edges[0], edges[1]] = [edges[1], edges[0]]
  const edgeOrientation = Array.from({ length: 11 }, () => Math.floor(rng() * 2))
  edgeOrientation.push((2 - (edgeOrientation.reduce((a, b) => a + b, 0) % 2)) % 2)
  const cornerOrientation = Array.from({ length: 7 }, () => Math.floor(rng() * 3))
  cornerOrientation.push((3 - (cornerOrientation.reduce((a, b) => a + b, 0) % 3)) % 3)
  return { edges, corners, edgeOrientation, cornerOrientation }
}

export type DailyPuzzle = {
  day: string
  /** The scramble to apply to a solved cube. */
  scramble: string
  /** Length of the solution Galois's solver found (two-phase, not always optimal). */
  solverLength: number
}

const CACHE = 'galois.daily.puzzle.v2.'

/** Today's puzzle, the same for everyone: a seeded random position, solved by cubing.js; the scramble is that solution reversed. */
export async function dailyPuzzle(kpuzzle: KPuzzle, day: string): Promise<DailyPuzzle> {
  try {
    const cached = localStorage.getItem(CACHE + day)
    if (cached) return JSON.parse(cached)
  } catch {
    // Not cached; compute it.
  }
  const [{ KPattern }, { experimentalSolve3x3x3IgnoringCenters }] = await Promise.all([
    import('cubing/kpuzzle'),
    import('cubing/search'),
  ])
  const p = randomPositionData(seededRandom(seedFor(day)))
  const base = kpuzzle.defaultPattern().patternData
  const pattern = new KPattern(kpuzzle, {
    ...base,
    EDGES: { pieces: p.edges, orientation: p.edgeOrientation },
    CORNERS: { pieces: p.corners, orientation: p.cornerOrientation },
  })
  const solution = await experimentalSolve3x3x3IgnoringCenters(pattern)
  const puzzle: DailyPuzzle = {
    day,
    // Inverting writes double turns as R2'; R2 is the same move and the usual way to write it.
    scramble: [...solution.invert().experimentalExpand()].map((m) => String(m).replace("2'", '2')).join(' '),
    solverLength: [...solution.experimentalExpand()].length,
  }
  try {
    localStorage.setItem(CACHE + day, JSON.stringify(puzzle))
  } catch {
    // Fine: it is recomputed next time.
  }
  return puzzle
}
