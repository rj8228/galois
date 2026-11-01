// @vitest-environment happy-dom
import { cube3x3x3 } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { analyse } from '../../src/engine/analysis'
import { CORNER_NAMES } from '../../src/engine/pieces'
import { defaultPiece, routeOf } from '../../src/lenses/path/path'
import { orderFormula, orderTerms, ringLayout } from '../../src/lenses/rings/rings'
import { SEE_LENSES } from '../../src/lenses/see'

const kpuzzle = await cube3x3x3.kpuzzle()
const ru = analyse(kpuzzle, 'R U')
const [corners, edges] = ru.orbits

describe('See lenses', () => {
  it('registers Net, Rings and Path, in that order', () => {
    expect(SEE_LENSES.map((l) => l.id)).toEqual(['net', 'rings', 'path'])
  })
})

describe('Rings', () => {
  it('reads R U as an edge 7-cycle, a corner 5-cycle coming back turned, one corner twisted alone, order 105', () => {
    expect(edges.cycles.map((c) => [c.positions.length, c.twist])).toEqual([[7, 0]])
    expect(corners.cycles.map((c) => c.positions.length)).toEqual([5])
    expect(corners.cycles[0].twist).not.toBe(0)
    expect(corners.twistedInPlace.map((t) => CORNER_NAMES[t.position])).toEqual(['UFR'])
    expect(orderTerms(ru).map((t) => [t.text, t.label])).toEqual([
      ['7', 'edges, one loop'],
      ['5 × 3', 'corners, back turned'],
      ['3', 'UFR twists alone'],
    ])
    expect(orderFormula(ru)).toBe('order = lcm(7, 15, 3) = 105')
  })

  it('lays each loop out as one arc, in the order its pieces travel, from the top', () => {
    const ring = ringLayout(corners)
    expect(ring.map((n) => n.name).slice(0, 5)).toEqual(['URB', 'DBR', 'DRF', 'ULF', 'UBL'])
    expect(ring[5]).toMatchObject({ name: 'UFR', cycle: null })
    expect(ring[5].twist).not.toBe(0)
    expect(ring.map((n) => n.angle)).toEqual([0, 45, 90, 135, 180, 225, 270, 315])
    expect(ringLayout(edges).filter((n) => n.cycle === 0)).toHaveLength(7)
  })

  it('writes a single-term order plainly', () => {
    expect(orderFormula(analyse(kpuzzle, 'R'))).toBe('order = 4')
  })
})

describe('Path', () => {
  it('follows URB through R U: URB → DBR → DRF → ULF → UBL, 3 laps to come back straight', () => {
    const piece = defaultPiece(kpuzzle, ['R', 'U'])
    expect(piece).toEqual({ orbit: 'CORNERS', index: CORNER_NAMES.indexOf('URB') })
    if (!piece) return
    const r = routeOf(kpuzzle, ['R', 'U'], piece)
    expect(r.slots.map((p) => CORNER_NAMES[p])).toEqual(['URB', 'DBR', 'DRF', 'ULF', 'UBL'])
    expect(r.laps).toBe(3)
    expect(r.repeats).toBe(15)
  })

  it('gives a piece that never moves a lap of one slot', () => {
    const r = routeOf(kpuzzle, ['R', 'U'], { orbit: 'CORNERS', index: CORNER_NAMES.indexOf('DFL') })
    expect(r).toMatchObject({ slots: [CORNER_NAMES.indexOf('DFL')], twist: 0, laps: 1, repeats: 1 })
  })
})
