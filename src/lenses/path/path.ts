import type { KPuzzle } from 'cubing/kpuzzle'
import { analyse, tracePiece } from '../../engine/analysis.ts'
import { ORBITS, type OrbitName, type PieceRef } from '../../engine/pieces.ts'

export type Route = {
  piece: PieceRef
  /** Slots the piece visits, one per repeat of the sequence, starting at its home: one lap. */
  slots: number[]
  /** Twist it carries when it first gets home (0 = straight). */
  twist: number
  /** Laps until it is home and straight. */
  laps: number
  /** Repeats of the sequence until that happens: slots × laps. */
  repeats: number
}

/** The first piece of the longest corner cycle, else of the longest edge cycle, else any twisted piece. */
export function defaultPiece(kp: KPuzzle, moves: string[]): PieceRef | null {
  const a = analyse(kp, moves.join(' '))
  for (const orbit of ['CORNERS', 'EDGES'] as const) {
    const o = a.orbits.find((x) => x.orbit === orbit)
    if (!o) continue
    const longest = o.cycles.reduce<number[] | null>(
      (best, c) => (!best || c.positions.length > best.length ? c.positions : best),
      null,
    )
    if (longest) return { orbit, index: longest[0] }
  }
  for (const orbit of ['CORNERS', 'EDGES'] as const) {
    const t = a.orbits.find((x) => x.orbit === orbit)?.twistedInPlace[0]
    if (t) return { orbit, index: t.position }
  }
  return null
}

/** Follow one piece while the sequence repeats: its lap of slots and how long until it is home straight. */
export function routeOf(kp: KPuzzle, moves: string[], piece: PieceRef): Route {
  const o = analyse(kp, moves.join(' ')).orbits.find((x) => x.orbit === piece.orbit)
  const twists = ORBITS.find((x) => x.name === piece.orbit)?.twists ?? 1
  const cycle = o?.cycles.find((c) => c.positions.includes(piece.index))
  const alone = o?.twistedInPlace.find((t) => t.position === piece.index)
  const length = cycle?.positions.length ?? 1
  const twist = cycle?.twist ?? alone?.twist ?? 0
  // Where the piece is after each move of one full lap; keep the slot after each whole repeat.
  const lap = Array.from({ length }, () => moves).flat()
  const trace = tracePiece(kp, lap, piece.orbit as OrbitName, piece.index)
  const slots = Array.from({ length }, (_, i) => trace[i * moves.length])
  const laps = twist ? twists : 1
  return { piece, slots, twist, laps, repeats: length * laps }
}
