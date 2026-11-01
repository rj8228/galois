// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { CUBE_LENS, findLens, LENSES } from '../../src/lenses/registry.ts'

describe('lens registry', () => {
  it('starts with the cube lens, which is the 3D player itself', () => {
    expect(LENSES[0]).toBe(CUBE_LENS)
    expect(CUBE_LENS.View).toBeNull()
  })

  it('has unique ids, and every other lens has a view, a label and a hint', () => {
    const ids = LENSES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const l of LENSES.slice(1)) {
      expect(l.View).not.toBeNull()
      expect(l.label.length).toBeGreaterThan(0)
      expect(l.hint.length).toBeGreaterThan(0)
    }
  })

  it('falls back to the cube lens for an unknown id', () => {
    expect(findLens('no-such-lens')).toBe(CUBE_LENS)
  })
})
