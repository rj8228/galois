import { cube3x3x3 } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { parseSequence } from '../../src/cube/notation'
import { analyse } from '../../src/engine/analysis'
import { LABS, labById } from '../../src/labs/labs'

const kpuzzle = await cube3x3x3.kpuzzle()
const check = (id: string, text: string) => {
  const p = parseSequence(text)
  if (!p.ok) throw new Error(p.error)
  return labById(id)?.done({ moves: p.moves, analysis: analyse(kpuzzle, p.alg) })
}

describe('labs', () => {
  it.each(LABS.map((l) => [l.id, l.hints.at(-1) ?? '']))('%s: the answer in the last hint passes', (id, answer) => {
    expect(check(id, answer)).toBe(true)
  })

  it('reject near misses', () => {
    expect(check('order-1260', 'R U')).toBe(false)
    expect(check('only-r-u', "M2 U M U2 M' U M2")).toBe(false) // an edge 3-cycle, but not with R and U
    expect(check('flip-two', "R U R' U'")).toBe(false)
    expect(check('odd-pair', 'R')).toBe(false)
    expect(check('bottom-three', "R U R' D R U' R' D'")).toBe(false) // UFR is on top
    expect(check('order-two-all-edges', 'R2')).toBe(false)
  })
})
