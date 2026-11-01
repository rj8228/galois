import { computed } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { kpuzzle, loadKPuzzle } from '../analysis/kpuzzle.ts'
import { history, scramble } from '../cube/state.ts'
import { type Cube, fromCubing, type OrbitData, parseMoves } from '../solver3/cube3.ts'

/**
 * The current position on the Play stage (the scramble, then every move made), for the Solve lenses.
 *
 * Applied with cubing.js's 3×3 model, then read as Kociemba's cubies (`src/solver3/cube3.ts`):
 * corners URF UFL ULB UBR DFR DLF DBL DRB, edges UR UF UL UB DR DF DL DB FR FL BL BR.
 * The solved cube's U face is the top, as on the stage.
 */
export type Position = {
  cube: Cube
  /** False when whole-cube turns or slice moves have moved the centres: the lenses then read nothing. */
  centresHome: boolean
  /** The moves from solved, when they are all face turns (what the 3×3 solver accepts); else null. */
  faceMoves: string[] | null
}

const tokens = (text: string) => text.trim().split(/\s+/).filter(Boolean)

/** The current position, or null until cubing.js's model has loaded (or for a sequence it cannot read). */
export const position = computed<Position | null>(() => {
  const k = kpuzzle.value
  const moves = [...tokens(scramble.value), ...history.value]
  if (!k) return null
  try {
    const data = k.defaultPattern().applyAlg(moves.join(' ')).patternData as unknown as Record<string, OrbitData>
    const centres = data.CENTERS?.pieces ?? [0, 1, 2, 3, 4, 5]
    return {
      cube: fromCubing({ CORNERS: data.CORNERS, EDGES: data.EDGES }),
      centresHome: centres.every((p, i) => p === i),
      faceMoves: parseMoves(moves.join(' ')),
    }
  } catch {
    return null
  }
})

/** Loads cubing.js's 3×3 model on first use and returns the current position. */
export function usePosition(): Position | null {
  useEffect(() => {
    void loadKPuzzle()
  }, [])
  return position.value
}
