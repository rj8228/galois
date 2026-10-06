import { describe, expect, it } from 'vitest'
import { applyKey, invertMove, parseSequence } from '../../src/cube/notation'

describe('parseSequence', () => {
  it('expands a simple sequence', () => {
    const parsed = parseSequence("R U R' U'")
    expect(parsed.ok && parsed.moves).toEqual(['R', 'U', "R'", "U'"])
  })

  it('expands repeated groups', () => {
    const parsed = parseSequence('(R U)3')
    expect(parsed.ok && parsed.moves).toEqual(['R', 'U', 'R', 'U', 'R', 'U'])
  })

  it('accepts slices and rotations', () => {
    expect(parseSequence("M2 x y' z2").ok).toBe(true)
  })

  it('rejects text that is not notation', () => {
    expect(parseSequence('hello').ok).toBe(false)
    expect(parseSequence('   ').ok).toBe(false)
  })
})

describe('invertMove', () => {
  it.each([
    ['R', "R'"],
    ["R'", 'R'],
    ['R2', 'R2'],
  ])('%s inverts to %s', (move, inverse) => {
    expect(invertMove(move)).toBe(inverse)
  })
})

describe('applyKey', () => {
  it('adds a space before a new move letter', () => {
    expect(applyKey('R', 1, 1, 'U')).toEqual({ text: 'R U', caret: 3 })
  })
  it('appends a prime without a space', () => {
    expect(applyKey('R U', 3, 3, "'")).toEqual({ text: "R U'", caret: 4 })
  })
  it('deletes the character before the caret', () => {
    expect(applyKey("R U'", 4, 4, '⌫')).toEqual({ text: 'R U', caret: 3 })
  })
  it('clears everything', () => {
    expect(applyKey('R U', 1, 1, 'clear')).toEqual({ text: '', caret: 0 })
  })
})
