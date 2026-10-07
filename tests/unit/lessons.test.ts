// @vitest-environment happy-dom
import { cube3x3x3 } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { parseSequence } from '../../src/cube/notation'
import { analyse } from '../../src/engine/analysis'
import { LESSONS } from '../../src/learn/lessons'
import type { StepContext } from '../../src/learn/types'

const kpuzzle = await cube3x3x3.kpuzzle()

/** The context a step's check sees when the sequence box holds `text`. */
function boxHolds(text: string): StepContext {
  const analyseText = (t: string) => {
    const p = parseSequence(t)
    return p.ok ? analyse(kpuzzle, p.alg) : null
  }
  return {
    history: [],
    solved: true,
    sequence: parseSequence(text),
    analysis: analyseText(text),
    actions: new Set(),
    analyse: analyseText,
  }
}

const prove = (id: string) => {
  const step = LESSONS.find((l) => l.id === id)?.steps.find((s) => s.kind === 'prove')
  if (!step?.done) throw new Error(`no prove check in ${id}`)
  return (text: string) => step.done?.(boxHolds(text))
}

describe('lessons', () => {
  it('are numbered in order, each with the five steps', () => {
    expect(LESSONS.map((l) => l.number)).toEqual(LESSONS.map((_, i) => i + 1))
    for (const l of LESSONS) expect(l.steps.map((s) => s.kind)).toEqual(['do', 'notice', 'name', 'explore', 'prove'])
  })

  it('5: accepts a different 3-piece sequence, not the one from Explore', () => {
    const check = prove('commutators')
    expect(check("R U R' D' R U' R' D")).toBe(true)
    expect(check("R U R' D R U' R' D'")).toBe(false)
    expect(check("R U R' U'")).toBe(false)
  })

  it('6: accepts a 3-cycle aimed at UBL', () => {
    const check = prove('conjugates')
    expect(check("U2 R U R' D R U' R' D' U2")).toBe(true)
    expect(check("U R U R' D R U' R' D' U'")).toBe(false)
    expect(check("R U R' D R U' R' D'")).toBe(false)
  })

  it('7: accepts odd corners', () => {
    const check = prove('parity')
    expect(check('R')).toBe(true)
    expect(check('R2')).toBe(false)
  })

  it('9: accepts an order-2 sequence of R2 and U2 turns only', () => {
    const check = prove('subgroups')
    expect(check('R2 U2 R2')).toBe(true)
    expect(check('R2 U2')).toBe(false) // order 6
    expect(check('R U R')).toBe(false)
  })

  it('10: accepts an order that is a multiple of 11', () => {
    const check = prove('lagrange')
    expect(check("R L U F'")).toBe(true)
    expect(check('R U')).toBe(false)
  })

  it('8: accepts twisting exactly UFR and ULF', () => {
    const check = prove('twists')
    expect(check("R' D' R D R' D' R D U' D' R' D R D' R' D R U")).toBe(true)
    expect(check("R' D' R D R' D' R D U D' R' D R D' R' D R U'")).toBe(false)
    expect(check("R' D' R D R' D' R D")).toBe(false)
  })
})

// Facts the lessons state, checked here rather than trusted.
describe('lesson facts', () => {
  it('<R2, U2> has 12 positions (lesson 9)', () => {
    const seen = new Set<string>()
    let frontier = [kpuzzle.defaultPattern()]
    seen.add(JSON.stringify(frontier[0].patternData))
    while (frontier.length) {
      const next = []
      for (const p of frontier)
        for (const m of ['R2', 'U2']) {
          const q = p.applyMove(m)
          const key = JSON.stringify(q.patternData)
          if (!seen.has(key)) {
            seen.add(key)
            next.push(q)
          }
        }
      frontier = next
    }
    expect(seen.size).toBe(12)
  })

  it('the count is 43,252,003,274,489,856,000 = 2^27 3^14 5^3 7^2 11 (lessons 10 and 11)', () => {
    const fact = (n: bigint): bigint => (n <= 1n ? 1n : n * fact(n - 1n))
    const g = (fact(8n) * 3n ** 7n * fact(12n) * 2n ** 11n) / 2n
    expect(g).toBe(43252003274489856000n)
    expect(g).toBe(2n ** 27n * 3n ** 14n * 5n ** 3n * 7n ** 2n * 11n)
    // Lesson 12's counting bound: sequences of up to 16 moves can't reach every position.
    let reachable = 1n
    for (let n = 1n; n <= 16n; n++) reachable += 18n * 15n ** (n - 1n)
    expect(reachable < g).toBe(true)
  })

  it('the superflip flips all 12 edges and nothing else (lesson 12)', () => {
    const a = analyse(kpuzzle, "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2")
    const [corners, edges] = a.orbits
    expect(corners.affected).toBe(0)
    expect(edges.twistedInPlace.length).toBe(12)
    expect(a.order).toBe(2)
  })
})
