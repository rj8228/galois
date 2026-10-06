import { Alg } from 'cubing/alg'
import type { KPuzzle } from 'cubing/kpuzzle'

/** The largest order of any element of the cube group. */
export const MAX_ORDER = 1260

/**
 * Order of a move sequence: how many times it must be repeated
 * before the cube returns to the state it started in.
 */
export function orderOf(kpuzzle: KPuzzle, sequence: string): number {
  const transformation = kpuzzle.algToTransformation(Alg.fromString(sequence))
  const solved = kpuzzle.defaultPattern()
  let pattern = solved
  for (let n = 1; n <= MAX_ORDER; n++) {
    pattern = pattern.applyTransformation(transformation)
    if (pattern.isIdentical(solved)) return n
  }
  throw new Error(`Order of "${sequence}" exceeds ${MAX_ORDER}`)
}
