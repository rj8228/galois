import { cube3x3x3 } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { affectedPieces, analyse, highlightMask, tracePiece } from '../../src/engine/analysis'
import { orderOf } from '../../src/engine/order'

const kpuzzle = await cube3x3x3.kpuzzle()
const named = (seq: string, orbit: 'CORNERS' | 'EDGES' | 'CENTERS') => {
  const o = analyse(kpuzzle, seq).orbits.find((x) => x.orbit === orbit)
  if (!o) throw new Error(orbit)
  return o.cycles.map((c) => c.positions.map((p) => o.names[p]).join(' '))
}

describe('piece names', () => {
  it('match the faces each move turns', () => {
    expect(new Set(named('U', 'EDGES')[0].split(' '))).toEqual(new Set(['UF', 'UR', 'UB', 'UL']))
    expect(new Set(named('D', 'CORNERS')[0].split(' '))).toEqual(new Set(['DRF', 'DFL', 'DLB', 'DBR']))
    expect(new Set(named('F', 'EDGES')[0].split(' '))).toEqual(new Set(['UF', 'FR', 'DF', 'FL']))
    expect(new Set(named('R', 'EDGES')[0].split(' '))).toEqual(new Set(['UR', 'FR', 'DR', 'BR']))
    expect(new Set(named('M', 'CENTERS')[0].split(' '))).toEqual(new Set(['U', 'F', 'D', 'B']))
  })

  it('follow pieces in the direction they travel', () => {
    // R sends the top-front-right corner up and back to the top-back-right.
    const cycle = named('R', 'CORNERS')[0].split(' ')
    const i = cycle.indexOf('UFR')
    expect(cycle[(i + 1) % cycle.length]).toBe('URB')
  })
})

describe('analyse', () => {
  it.each(['R', 'R U', "R U R' U'", 'R2 U2', "R U2 D' B D'", 'M', "M' U2 M U2", "R U R' U R U2 R'", 'x y', 'F2 B2'])(
    'order of %s from cycles matches repeating it',
    (seq) => {
      expect(analyse(kpuzzle, seq).order).toBe(orderOf(kpuzzle, seq))
    },
  )

  it('describes the sexy move', () => {
    const a = analyse(kpuzzle, "R U R' U'")
    const corners = a.orbits[0]
    const edges = a.orbits[1]
    expect(corners.cycles.map((c) => c.positions.length)).toEqual([2, 2])
    expect(edges.cycles.map((c) => c.positions.length)).toEqual([3])
    expect(corners.affected).toBe(4)
    expect(edges.affected).toBe(3)
  })

  it('finds a corner twisted in place in R U', () => {
    const corners = analyse(kpuzzle, 'R U').orbits[0]
    expect(corners.cycles.map((c) => c.positions.length)).toEqual([5])
    expect(corners.twistedInPlace).toHaveLength(1)
  })

  it('keeps the invariants on any real sequence', () => {
    for (const seq of ['R', 'R U', "R U2 D' B D'", 'M', "F R' U L2 B' D M E S x"]) {
      const a = analyse(kpuzzle, seq)
      expect(a.parityMatches).toBe(true)
      expect(a.orbits[0].twistSum).toBe(0)
      expect(a.orbits[1].twistSum).toBe(0)
    }
  })

  it('counts sticker cycles: R moves 20 stickers in five 4-cycles', () => {
    const a = analyse(kpuzzle, 'R')
    const stickers = a.orbits.flatMap((o) => o.stickerCycleLengths)
    expect(stickers).toEqual([4, 4, 4, 4, 4])
  })

  it('reports the identity', () => {
    const a = analyse(kpuzzle, "R R'")
    expect(a.order).toBe(1)
    expect(a.orbits.every((o) => o.affected === 0)).toBe(true)
  })
})

describe('tracePiece', () => {
  it('follows UFR through R U', () => {
    const path = tracePiece(kpuzzle, ['R', 'U'], 'CORNERS', 0)
    expect(path.map((p) => ['UFR', 'URB', 'UBL', 'ULF', 'DRF', 'DFL', 'DLB', 'DBR'][p])).toEqual(['UFR', 'URB', 'UFR'])
  })
})

describe('highlightMask', () => {
  it('dims everything except the affected pieces', () => {
    const mask = highlightMask(affectedPieces(analyse(kpuzzle, 'U')))
    expect(mask).toBe('CORNERS:----DDDD,EDGES:----DDDDDDDD,CENTERS:DDDDDD')
  })
})

describe('speed', () => {
  it('analyses a 200-move sequence in under 50 ms', () => {
    const faces = ['R', 'L', 'U', 'D', 'F', 'B']
    const seq = Array.from({ length: 200 }, (_, i) => faces[(i * 7) % 6] + ['', "'", '2'][i % 3]).join(' ')
    analyse(kpuzzle, seq) // warm up
    const start = performance.now()
    analyse(kpuzzle, seq)
    expect(performance.now() - start).toBeLessThan(50)
  })
})
