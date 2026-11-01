import type { Lens } from './types.ts'

/**
 * Row 1 of the lenses design, "See what a move does": Net, Rings, Path (in that order).
 * Filled by task L1 (GitHub issue, branch `lenses-see`). Keep it to this list:
 * the registry reads it, and the other lens task never touches this file.
 */
export const SEE_LENSES: Lens[] = []
