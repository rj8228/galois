import { HomeLens } from './home/Home.tsx'
import { ProgressLens } from './progress/Progress.tsx'
import { TopLens } from './top/Top.tsx'
import type { Lens } from './types.ts'

/**
 * Row 2 of the lenses design, "Solve with it": Progress, Top, Home (in that order).
 * Filled by task L2 (GitHub issue, branch `lenses-solve`). Keep it to this list: the registry reads it,
 * and the other lens task never touches this file.
 */
export const SOLVE_LENSES: Lens[] = [
  { id: 'progress', label: 'Progress', hint: 'How solved the cube is, layer by layer', View: ProgressLens },
  { id: 'top', label: 'Top', hint: 'The top layer from above, with only the top colour shown', View: TopLens },
  { id: 'home', label: 'Home', hint: 'Where each top-layer piece belongs, and a short solution', View: HomeLens },
]
