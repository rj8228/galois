import { SEE_LENSES } from './see.ts'
import { SOLVE_LENSES } from './solve.ts'
import type { Lens } from './types.ts'

/** The 3D cube itself: the stage's default view. */
export const CUBE_LENS: Lens = { id: 'cube', label: 'Cube', hint: 'The cube in 3D', View: null }

/** Every lens on the Play stage, in button order. */
export const LENSES: Lens[] = [CUBE_LENS, ...SEE_LENSES, ...SOLVE_LENSES]

export function findLens(id: string): Lens {
  return LENSES.find((l) => l.id === id) ?? CUBE_LENS
}
