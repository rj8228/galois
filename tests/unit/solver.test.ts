import { cube2x2x2 } from 'cubing/puzzles'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyMoves,
  canonical,
  indexOf,
  isSolvedAnyWay,
  MOVES,
  N,
  parseMoves,
  ROTATIONS,
  SOLVED,
  stateOf,
} from '../../src/solver/cube2'
import { compareFloors, FLOORS, floorOf, solve } from '../../src/solver/engine'
import { HARDEST } from '../../src/solver/hardest'
import { EXAMPLE, RING_COUNTS } from '../../src/solver/report'
import { buildTables, ensureStrong, type Tables, truthTable } from '../../src/solver/tables'

/** A small seeded random generator, so failures repeat. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randomFaces = (rand: () => number, n: number) =>
  Array.from({ length: n }, () => MOVES[Math.floor(rand() * MOVES.length)].name)

describe('2×2 solver', () => {
  let t: Tables
  // The tests check the solver against the full table of every position. The app never builds it.
  let dist: Int8Array
  let rings: number[]
  const distanceOf = (moves: string[]) => dist[indexOf(canonical(applyMoves(SOLVED, moves)).rel)]

  beforeAll(() => {
    t = buildTables()
    ensureStrong(t)
    ;({ dist, rings } = truthTable(t.permMove, t.twistMove))
  })

  it('the app builds no table of every position', () => {
    const fresh = buildTables()
    expect(fresh.cornerFloors).toBeNull()
    expect(Object.values(fresh).some((v) => ArrayBuffer.isView(v) && v.byteLength >= N)).toBe(false)
  })

  it('agrees with the published number of positions at every distance', () => {
    expect(rings).toEqual(RING_COUNTS)
  })

  it('knows the 24 ways to hold the cube', () => {
    expect(ROTATIONS).toHaveLength(24)
  })

  it('indexes positions both ways', () => {
    for (const i of [0, 1, 728, 729, 123_456, 2_000_001, N - 1]) expect(indexOf(stateOf(i))).toBe(i)
  })

  it.each(FLOORS)('the %s floor is never higher than the truth, on every position', (floor) => {
    const h = floorOf(t, floor)
    let tooHigh = 0
    for (let s = 0; s < N; s++) if (h(s) > dist[s]) tooHigh++
    expect(tooHigh).toBe(0)
  })

  it('proves the shortest solution, which solves the cube as you hold it', { timeout: 120_000 }, () => {
    const rand = seeded(8)
    for (let i = 0; i < 60; i++) {
      // All six faces, so the solver has to turn its view to hold DBL still.
      const position = randomFaces(rand, 14)
      const truth = distanceOf(position)
      for (const floor of ['medium', 'strong'] as const) {
        const report = solve(t, position, floor)
        expect(report.distance).toBe(truth)
        expect(report.solution).toHaveLength(truth)
        expect(report.rounds.at(-1)?.bound).toBe(truth)
        expect(isSolvedAnyWay(applyMoves(applyMoves(SOLVED, position), report.solution))).toBe(true)
      }
    }
  })

  it('agrees with cubing.js that every solution solves the cube', { timeout: 60_000 }, async () => {
    const kpuzzle = await cube2x2x2.kpuzzle()
    const rand = seeded(3)
    for (let i = 0; i < 25; i++) {
      const position = randomFaces(rand, 12)
      const { solution } = solve(t, position, 'strong')
      const pattern = kpuzzle.defaultPattern().applyAlg([...position, ...solution].join(' '))
      expect(pattern.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true })).toBe(true)
    }
  })

  it('lists only positions that really need 11 moves as the hardest', () => {
    expect(HARDEST).toHaveLength(30)
    for (const alg of HARDEST) expect(distanceOf(parseMoves(alg) ?? [])).toBe(11)
  })

  it('reproduces the worked example in the whole-cube view', () => {
    const position = parseMoves(EXAMPLE.scramble) ?? []
    const report = solve(t, position, EXAMPLE.floor)
    expect(report.floorAtStart).toBe(EXAMPLE.floorAtStart)
    expect(report.rounds).toEqual(EXAMPLE.rounds)
    expect(report.solution.join(' ')).toBe(EXAMPLE.solution)
    const c = compareFloors(t, position)
    expect(c.weak.nodes).toBe(EXAMPLE.weak.nodes)
    expect(c.strong.nodes).toBe(EXAMPLE.strong.nodes)
  })

  it('reads 2×2 face turns and nothing else', () => {
    expect(parseMoves("R U2 F' D2'")).toEqual(['R', 'U2', "F'", 'D2'])
    expect(parseMoves('R’ L')).toEqual(["R'", 'L'])
    expect(parseMoves('M')).toBeNull()
    expect(parseMoves('r U')).toBeNull()
    expect(parseMoves('')).toEqual([])
  })
})
