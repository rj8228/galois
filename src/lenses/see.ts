import { NetLens } from './net/NetLens.tsx'
import { PathLens } from './path/PathLens.tsx'
import { RingsLens } from './rings/RingsLens.tsx'
import type { Lens } from './types.ts'

/**
 * Row 1 of the lenses design, "See what a move does": Net, Rings, Path (in that order).
 * Filled by task L1 (GitHub issue, branch `lenses-see`). Keep it to this list:
 * the registry reads it, and the other lens task never touches this file.
 */
export const SEE_LENSES: Lens[] = [
  {
    id: 'net',
    label: 'Net',
    hint: 'The cube unfolded flat after the sequence, with the moved strips outlined',
    View: NetLens,
  },
  {
    id: 'rings',
    label: 'Rings',
    hint: "The sequence's loops: edges on the outer ring, corners on the inner",
    View: RingsLens,
  },
  { id: 'path', label: 'Path', hint: 'Follow one piece while the sequence repeats', View: PathLens },
]
