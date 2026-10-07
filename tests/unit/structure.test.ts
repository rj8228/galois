import { describe, expect, it } from 'vitest'
import { shapeOf, shapeText } from '../../src/engine/structure'

const read = (s: string) => shapeText(shapeOf(s.split(' ')))

describe('shape of a sequence', () => {
  it('finds commutators', () => {
    expect(read("R U R' U'")).toBe('[R, U]')
    // R U R' is itself a conjugate, so the 3-cycle reads as a commutator of a conjugate.
    expect(read("R U R' D R U' R' D'")).toBe('[[R: U], D]')
    expect(read("R' D' R D")).toBe("[R', D']")
  })

  it('finds conjugates, taking the whole setup', () => {
    expect(read("U2 R U R' D R U' R' D' U2")).toBe('[U2: [[R: U], D]]')
    expect(read("F R U R' U' F'")).toBe('[F: [R, U]]')
  })

  it('reads nested shapes, as in Niklas', () => {
    expect(read("R U' L' U R' U' L U")).toBe("[R, [U': L']]")
  })

  it('leaves other sequences as moves', () => {
    expect(read('R U')).toBe('R U')
    expect(read('R')).toBe('R')
    expect(read("R U R' U' R' F R2 U' R' U' R U R' F'")).toBe("R U R' U' R' F R2 U' R' U' R U R' F'")
  })

  it('needs both parts to be non-empty', () => {
    // R R' is the identity, not a conjugate of nothing.
    expect(read("R R'")).toBe("R R'")
  })
})
