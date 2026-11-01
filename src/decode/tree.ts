import { invertMove } from '../cube/notation.ts'
import type { Shape } from '../engine/structure.ts'

const invert = (moves: string[]) => moves.toReversed().map(invertMove)

/** The moves a tree stands for: [X, Y] is X Y X′ Y′, and [A: B] is A B A′. */
export function expand(s: Shape): string[] {
  if (s.kind === 'moves') return s.moves
  if (s.kind === 'commutator') {
    const x = expand(s.x)
    const y = expand(s.y)
    return [...x, ...y, ...invert(x), ...invert(y)]
  }
  const a = expand(s.a)
  return [...a, ...expand(s.b), ...invert(a)]
}

/** One move of the expanded algorithm, with the part it comes from: X, Y, A or B, primed when undone. */
export type Token = { move: string; part: string; undone: boolean; half: 'x' | 'y' | 'a' | 'b' | null }

const undo = (ts: Token[]): Token[] =>
  ts.toReversed().map((t) => ({ ...t, move: invertMove(t.move), undone: !t.undone }))

/**
 * The algorithm's moves, each labelled with the innermost part it belongs to, and `half` naming the
 * top-level part (so the row can be coloured by X and Y while labels show A and B inside Y).
 */
export function tokens(s: Shape, part = '', half: Token['half'] = null): Token[] {
  if (s.kind === 'moves') return s.moves.map((move) => ({ move, part, undone: false, half }))
  if (s.kind === 'commutator') {
    const x = tokens(s.x, 'X', half ?? 'x')
    const y = tokens(s.y, 'Y', half ?? 'y')
    return [...x, ...y, ...undo(x), ...undo(y)]
  }
  const a = tokens(s.a, 'A', half ?? 'a')
  return [...a, ...tokens(s.b, 'B', half ?? 'b'), ...undo(a)]
}
