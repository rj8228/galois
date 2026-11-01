import { describe, expect, it } from 'vitest'
import { formatCount, RINGS, TOTAL } from '../../src/learn/far/far.ts'
import { CAP, explore, loopOrder, productOrder } from '../../src/learn/graph/graph.ts'
import { homeOf, loopText } from '../../src/lenses/home/home.ts'
import { progressOf } from '../../src/lenses/progress/progress.ts'
import { TOP_CASES, topCase, topView, twists } from '../../src/lenses/top/top.ts'
import { applyMoves, invertMoves, keyOf, MOVE_NAMES, parseMoves, SOLVED } from '../../src/solver3/cube3.ts'

const at = (text: string) => applyMoves(SOLVED, parseMoves(text) ?? [])
/** The case an algorithm solves: the position its inverse makes. */
const caseOf = (alg: string, after: string[] = []) =>
  applyMoves(SOLVED, [...invertMoves(parseMoves(alg) ?? []), ...after])

function random(n: number, seed: number): string[] {
  let x = seed
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648
    out.push(MOVE_NAMES[x % 18])
  }
  return out
}

describe('Progress', () => {
  it('counts 20 of 20 on the solved cube, with every step done', () => {
    const p = progressOf(SOLVED)
    expect(p.home).toBe(20)
    expect(p.layers.map((l) => l.home)).toEqual([8, 4, 8])
    expect(p.steps.every((s) => s.done)).toBe(true)
    expect(p.next).toBeNull()
  })

  it('after R: the right counts per layer', () => {
    const p = progressOf(at('R'))
    // R moves 4 corners (2 top, 2 bottom) and 4 edges (UR, DR, FR, BR).
    expect(p.layers.map((l) => l.home)).toEqual([5, 2, 5])
    expect(p.home).toBe(12)
    expect(p.next).toBe('Cross')
    const top = p.layers[0].pieces
    expect(top.filter((x) => x.state === 'away').map((x) => x.name)).toEqual(['UFR', 'URB', 'UR'])
  })

  it('a last-layer case: two layers done, the top not one colour', () => {
    const p = progressOf(at("R U R' U R U2 R'"))
    expect(p.steps.slice(0, 3).every((s) => s.done)).toBe(true)
    expect(p.next).toBe('Top colour')
    expect(p.advice).toContain('Edges are already flat')
    expect(p.advice).toContain('3 corners are twisted')
  })

  it('names turned pieces', () => {
    const p = progressOf(at("R U R' U R U2 R' L' U' L U' L' U2 L"))
    expect(p.layers[0].pieces.some((x) => x.state === 'turned')).toBe(true)
  })
})

describe('Top', () => {
  it('the twist sum is a multiple of 3 on random positions', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const t = twists(applyMoves(SOLVED, random(30, seed)))
      expect(t.sum % 3).toBe(0)
    }
  })

  it('names Sune, and all seven cases are told apart', () => {
    expect(topCase(caseOf("R U R' U R U2 R'"))?.name).toBe('Sune')
    const names = TOP_CASES.map((tc) => topCase(caseOf(tc.alg))?.name)
    expect(names).toEqual(TOP_CASES.map((tc) => tc.name))
    // The same case after a turn of the top.
    expect(topCase(caseOf("R U R' U R U2 R'", ['U']))?.name).toBe('Sune')
  })

  it('names nothing when solved or when the cross is not done', () => {
    expect(topCase(SOLVED)).toBeNull()
    expect(topCase(at("F R U R' U' F'"))).toBeNull()
  })

  it('shows the whole top in the top colour when solved, and no side stickers', () => {
    const v = topView(SOLVED)
    expect(v.grid.flat().every(Boolean)).toBe(true)
    expect([...v.back, ...v.front, ...v.left, ...v.right].some(Boolean)).toBe(false)
  })

  it('every top piece shows its top colour exactly once', () => {
    const v = topView(at("R U R' U R U2 R'"))
    const shown = [...v.grid.flat(), ...v.back, ...v.front, ...v.left, ...v.right].filter(Boolean).length
    expect(shown).toBe(9)
  })
})

describe('Home', () => {
  it('a 3-cycle of edges (U perm)', () => {
    const h = homeOf(at("R2 U R U R' U' R' U' R' U R'"))
    expect(h.lowerSolved).toBe(true)
    expect(h.arrows.filter((a) => a.kind === 'corner')).toEqual([])
    expect(h.arrows.filter((a) => a.kind === 'edge')).toHaveLength(3)
    expect(h.loops).toHaveLength(1)
    expect(h.loops[0].slots).toHaveLength(3)
    expect(h.homeEdges).toHaveLength(1)
    expect(h.homeCorners).toHaveLength(4)
  })

  it('a corner swap and an edge swap (T perm)', () => {
    const h = homeOf(at("R U R' U' R' F R2 U' R' U' R U R' F'"))
    const corners = h.loops.filter((l) => l.kind === 'corner')
    const edges = h.loops.filter((l) => l.kind === 'edge')
    expect(corners).toHaveLength(1)
    expect(edges).toHaveLength(1)
    expect(loopText(corners[0])).toMatch(/^U\w+ ↔ U\w+$/)
    expect(loopText(edges[0])).toBe('UR ↔ UL')
  })

  it('says when the lower layers are not solved', () => {
    expect(homeOf(at('R')).lowerSolved).toBe(false)
    expect(homeOf(SOLVED).arrows).toEqual([])
  })
})

describe('Graph', () => {
  it('R2 and U2 give exactly 12 positions on one loop, furthest 6 away', () => {
    const g = explore(['R2', 'U2'])
    expect(g.nodes).toHaveLength(12)
    expect(g.furthest).toBe(6)
    expect(g.capped).toBe(false)
    expect(g.loop).toBe(true)
    expect(loopOrder(g)).toHaveLength(12)
    expect(productOrder(['R2', 'U2'])).toBe(6)
  })

  it('every node path really reaches a position at that distance', () => {
    const g = explore(['R2', 'U2', 'F2'])
    const keys = new Set(g.nodes.map((n) => keyOf(applyMoves(SOLVED, n.path))))
    expect(keys.size).toBe(g.nodes.length)
    for (const n of g.nodes) expect(n.path).toHaveLength(n.dist)
  })

  it('the cap holds for a big group', () => {
    const g = explore(['R', 'U'])
    expect(g.capped).toBe(true)
    expect(g.nodes).toHaveLength(CAP)
    expect(g.loop).toBe(false)
    expect(productOrder(['R', 'U'])).toBe(105)
  })

  it('a single quarter turn is a loop of 4', () => {
    const g = explore(['R'])
    expect(g.nodes).toHaveLength(4)
    expect(g.loop).toBe(true)
  })
})

describe('Far', () => {
  it('has 21 rings, 0–15 exact and 16–20 estimated, starting 1, 18, 243, 3,240, 43,239, 574,908', () => {
    expect(RINGS).toHaveLength(21)
    expect(RINGS.filter((r) => r.exact).map((r) => r.distance)).toEqual([...Array(16).keys()])
    expect(RINGS.slice(0, 6).map((r) => Number(r.count))).toEqual([1, 18, 243, 3240, 43239, 574908])
  })

  it('the exact rings and the estimates add up to every position', () => {
    const exact = RINGS.filter((r) => r.exact).reduce((s, r) => s + r.count, 0n)
    const estimated = RINGS.filter((r) => !r.exact).reduce((s, r) => s + r.count, 0n)
    expect(exact < TOTAL).toBe(true)
    // The estimates are given to two figures, so they cover what the exact rings leave to within 2%.
    const rest = TOTAL - exact
    const diff = rest > estimated ? rest - estimated : estimated - rest
    expect(diff * 50n < rest).toBe(true)
    expect(TOTAL).toBe(43252003274489856000n)
  })

  it('the first four rings match a breadth-first search', () => {
    const seen = new Set([keyOf(SOLVED)])
    let frontier = [SOLVED]
    for (let d = 1; d <= 4; d++) {
      const next = []
      for (const c of frontier)
        for (const m of MOVE_NAMES) {
          const n = applyMoves(c, [m])
          const k = keyOf(n)
          if (!seen.has(k)) {
            seen.add(k)
            next.push(n)
          }
        }
      expect(BigInt(next.length)).toBe(RINGS[d].count)
      frontier = next
    }
  })

  it('labels estimates as estimates', () => {
    expect(formatCount(RINGS[5])).toBe('574,908')
    expect(formatCount(RINGS[16])).toBe('≈ 1.1 × 10¹⁸')
    expect(formatCount(RINGS[18])).toBe('≈ 2.9 × 10¹⁹')
    expect(formatCount(RINGS[20])).toBe('≈ 490 million')
  })
})
