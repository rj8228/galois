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

/**
 * Applies one notation-keypad key to some text at the caret: letters start a new move (adding a space
 * when needed), ⌫ deletes, ␣ adds a space, and 'clear' empties it.
 */
export function applyKey(text: string, start: number, end: number, key: string): { text: string; caret: number } {
  if (key === 'clear') return { text: '', caret: 0 }
  if (key === '⌫') {
    const from = start === end ? Math.max(0, start - 1) : start
    return { text: text.slice(0, from) + text.slice(end), caret: from }
  }
  const before = text.slice(0, start)
  const isMoveLetter = /^[RLUDFBMESxyz]$/.test(key)
  const piece = key === '␣' ? ' ' : isMoveLetter && before && !/[\s(]$/.test(before) ? ` ${key}` : key
  return { text: before + piece + text.slice(end), caret: start + piece.length }
}

/** The inverse of a single move: R → R', R' → R, R2 → R2. */
export function invertMove(move: string): string {
  if (move.endsWith('2')) return move
  return move.endsWith("'") ? move.slice(0, -1) : `${move}'`
}
