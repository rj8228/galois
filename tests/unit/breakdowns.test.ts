import { cube3x3x3 } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { algOf, BREAKDOWNS, breakdownById } from '../../src/decode/breakdowns'
import { analyse } from '../../src/engine/analysis'
import { shapeOf, shapeText } from '../../src/engine/structure'

const kpuzzle = await cube3x3x3.kpuzzle()
const facts = (id: string) => {
  const b = breakdownById(id)
  if (!b) throw new Error(id)
  const a = analyse(kpuzzle, algOf(b))
  const [corners, edges, centres] = a.orbits
  return { order: a.order, corners, edges, centres, shape: shapeText(shapeOf(algOf(b).split(' '))) }
}

// The stories in breakdowns.ts make these claims; the engine checks them.
describe('algorithm breakdowns', () => {
  it('are the standard algorithms', () => {
    expect(BREAKDOWNS.map(algOf)).toEqual([
      "R' D' R D",
      "R U' L' U R' U' L U",
      "R U R' U R U2 R'",
      "R U R' U' R' F R2 U' R' U' R U R' F'",
    ])
  })

  it("beginner's corner algorithm: [R', D'], order 6", () => {
    const f = facts('corner-twister')
    expect(f.shape).toBe("[R', D']")
    expect(f.order).toBe(6)
  })

  it('Niklas: [R, [U′: L′]], a 3-cycle of UFR, URB, UBL and nothing else', () => {
    const f = facts('niklas')
    expect(f.shape).toBe("[R, [U': L']]")
    expect(f.corners.cycles.map((c) => c.positions.map((p) => f.corners.names[p]).sort())).toEqual([
      ['UBL', 'UFR', 'URB'],
    ])
    expect(f.edges.affected + f.centres.affected).toBe(0)
  })

  it('Sune: only the top layer changes, 4 corners and 3 edges, order 6', () => {
    const f = facts('sune')
    expect(f.order).toBe(6)
    expect(f.corners.affected).toBe(4)
    expect(f.edges.affected).toBe(3)
    expect(
      f.corners.cycles.flatMap((c) => c.positions.map((p) => f.corners.names[p])).every((n) => n.startsWith('U')),
    ).toBe(true)
    expect(
      f.edges.cycles.flatMap((c) => c.positions.map((p) => f.edges.names[p])).every((n) => n.startsWith('U')),
    ).toBe(true)
  })

  it('T-perm: two corner swaps and two edge swaps, odd and odd, order 2', () => {
    const f = facts('t-perm')
    expect(f.order).toBe(2)
    expect(f.corners.cycles.map((c) => c.positions.length)).toEqual([2])
    expect(f.edges.cycles.map((c) => c.positions.length)).toEqual([2])
    expect([f.corners.parity, f.edges.parity]).toEqual(['odd', 'odd'])
  })
})
