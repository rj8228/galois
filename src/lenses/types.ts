import type { FunctionComponent } from 'preact'

/**
 * A lens: another way to look at the cube on the Play stage (design: `design/lenses/`).
 *
 * The stage shows the 3D cube for the `cube` lens. For any other lens it shows the lens's `View` instead,
 * while the 3D player stays mounted (hidden) so its state is kept. A view reads what it needs from the
 * app's signals itself:
 * - `sequenceText` (`src/cube/SequenceBar.tsx`): the sequence typed in the box, e.g. "R U"
 * - `scramble`, `history` (`src/cube/state.ts`): the current position is the scramble plus the moves made
 * - `kpuzzle` / `loadKPuzzle()` (`src/analysis/kpuzzle.ts`): cubing.js's 3×3 model, loaded once
 */
export interface Lens {
  /** Stable id, used in storage: 'cube', 'net', 'rings', 'path', 'progress', 'top', 'home'. */
  id: string
  /** The button's text. */
  label: string
  /** One sentence: what this lens shows. Used as the button's title and by screen readers. */
  hint: string
  /** What the stage shows. `null` only for the cube lens, which is the 3D player itself. */
  View: FunctionComponent | null
}
