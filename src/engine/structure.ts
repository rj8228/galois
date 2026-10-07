import { invertMove } from '../cube/notation.ts'

/**
 * The shape of a sequence, read straight from its moves:
 * a commutator X Y X′ Y′, a conjugate A B A′, or neither. The parts are themselves shapes,
 * so R U′ L′ U R′ U′ L U reads as [R, [U′: L′]].
 */
export type Shape =
  | { kind: 'moves'; moves: string[] }
  | { kind: 'commutator'; x: Shape; y: Shape }
  | { kind: 'conjugate'; a: Shape; b: Shape }

const invert = (moves: string[]) => moves.toReversed().map(invertMove)
const same = (a: string[], b: string[]) => a.length === b.length && a.every((m, i) => m === b[i])

/** X Y X′ Y′ with X and Y non-empty, trying the shortest X first. */
function asCommutator(m: string[]) {
  const n = m.length
  for (let i = 1; 2 * i < n; i++) {
    const y = n / 2 - i
    if (!Number.isInteger(y) || y < 1) continue
    const x = m.slice(0, i)
    const ys = m.slice(i, i + y)
    if (same(m.slice(i + y, 2 * i + y), invert(x)) && same(m.slice(2 * i + y), invert(ys))) return { x, y: ys }
  }
  return null
}

/** A B A′ with A and B non-empty, taking the longest A (the whole setup). */
function asConjugate(m: string[]) {
  for (let i = Math.floor((m.length - 1) / 2); i >= 1; i--) {
    const a = m.slice(0, i)
    if (same(m.slice(m.length - i), invert(a))) return { a, b: m.slice(i, m.length - i) }
  }
  return null
}

export function shapeOf(moves: string[]): Shape {
  const c = asCommutator(moves)
  if (c) return { kind: 'commutator', x: shapeOf(c.x), y: shapeOf(c.y) }
  const j = asConjugate(moves)
  if (j) return { kind: 'conjugate', a: shapeOf(j.a), b: shapeOf(j.b) }
  return { kind: 'moves', moves }
}

/** Standard cube notation: [X, Y] for a commutator, [A: B] for a conjugate. */
export function shapeText(s: Shape): string {
  if (s.kind === 'moves') return s.moves.join(' ')
  if (s.kind === 'commutator') return `[${shapeText(s.x)}, ${shapeText(s.y)}]`
  return `[${shapeText(s.a)}: ${shapeText(s.b)}]`
}
