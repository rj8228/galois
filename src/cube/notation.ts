import { Alg } from 'cubing/alg'

export const FACES = ['R', 'L', 'U', 'D', 'F', 'B'] as const
export const SLICES_AND_ROTATIONS = ['M', 'E', 'S', 'x', 'y', 'z'] as const
export const SUFFIXES = ['', "'", '2'] as const

/** Every face move with its prime and double variants, grouped by suffix (R L U D F B, then R' …, then R2 …). */
export const FACE_MOVES = SUFFIXES.flatMap((s) => FACES.map((f) => f + s))
export const EXTRA_MOVES = SUFFIXES.flatMap((s) => SLICES_AND_ROTATIONS.map((f) => f + s))

export type Parsed = { ok: true; moves: string[]; alg: Alg } | { ok: false; error: string }

/** Parses notation such as "R U R' U'" or "(R U)6" into a flat list of moves. */
export function parseSequence(text: string): Parsed {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'Type a sequence such as R U R′ U′.' }
  try {
    const alg = Alg.fromString(trimmed)
    const moves = [...alg.experimentalExpand()].map(String)
    for (const m of moves) {
      if (!/^[RLUDFBMESxyz](2|'|2'|)$/.test(m)) {
        return { ok: false, error: `"${m}" isn't a 3×3 move. Use R L U D F B (and M E S x y z), with ' or 2.` }
      }
    }
    if (moves.length === 0) return { ok: false, error: 'That sequence has no moves.' }
    return { ok: true, moves, alg }
  } catch {
    return { ok: false, error: "That isn't valid notation. Use R L U D F B, with ' or 2 after a letter." }
  }
}

/** The inverse of a single move: R → R', R' → R, R2 → R2. */
export function invertMove(move: string): string {
  if (move.endsWith('2')) return move
  return move.endsWith("'") ? move.slice(0, -1) : `${move}'`
}
