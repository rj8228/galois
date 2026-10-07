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

  it('8: accepts twisting exactly UFR and ULF', () => {
    const check = prove('twists')
    expect(check("R' D' R D R' D' R D U' D' R' D R D' R' D R U")).toBe(true)
    expect(check("R' D' R D R' D' R D U D' R' D R D' R' D R U'")).toBe(false)
    expect(check("R' D' R D R' D' R D")).toBe(false)
  })
})
