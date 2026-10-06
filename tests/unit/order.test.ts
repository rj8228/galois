import { cube3x3x3 } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { orderOf } from '../../src/engine/order'

describe('orderOf', async () => {
  const kpuzzle = await cube3x3x3.kpuzzle()

  it.each([
    ['R', 4],
    ['R2', 2],
    ['R U', 105],
    ["R U R' U'", 6],
    ['R2 U2', 6],
    ["R U2 D' B D'", 1260],
  ])('order of %s is %i', (sequence, expected) => {
    expect(orderOf(kpuzzle, sequence)).toBe(expected)
  })
})
