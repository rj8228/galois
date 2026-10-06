import { signal } from '@preact/signals'
import type { KPuzzle } from 'cubing/kpuzzle'

/** The 3×3×3 puzzle definition, loaded once on first use. */
export const kpuzzle = signal<KPuzzle | null>(null)

let loading: Promise<KPuzzle> | null = null
export function loadKPuzzle(): Promise<KPuzzle> {
  loading ??= import('cubing/puzzles')
    .then(({ cube3x3x3 }) => cube3x3x3.kpuzzle())
    .then((k) => {
      kpuzzle.value = k
      return k
    })
  return loading
}
