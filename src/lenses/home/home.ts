import { CP, type Cube, EP } from '../../solver3/cube3.ts'
import { CORNER_LABELS, EDGE_LABELS } from '../labels.ts'

/** One top-layer piece's trip: from the slot it sits in to the slot it belongs in. */
export type Arrow = { kind: 'corner' | 'edge'; from: number; to: number }

/** A loop of top slots, in the order the pieces move: the piece in loop[0] belongs in loop[1], and so on. */
export type Loop = {
  kind: 'corner' | 'edge'
  slots: number[] /** Ends at a slot whose piece is from below. */
  open: boolean
}

export type HomeReport = {
  arrows: Arrow[]
  loops: Loop[]
  /** Top slots whose piece is already in it (it may still be turned). */
  homeCorners: number[]
  homeEdges: number[]
  /** Top pieces still down in the lower layers, so not drawn. */
  below: number
  /** Both lower layers solved: every piece in its slot, straight. */
  lowerSolved: boolean
}

const TOP = [0, 1, 2, 3]

function loopsOf(kind: Loop['kind'], dest: (number | null)[]): Loop[] {
  const loops: Loop[] = []
  const seen = new Set<number>()
  // Start open chains at their first piece: a slot that no top piece is headed for.
  const targets = new Set(dest.filter((d) => d !== null))
  const starts = [...TOP.filter((s) => !targets.has(s)), ...TOP]
  for (const start of starts) {
    if (seen.has(start) || dest[start] === null || dest[start] === start) continue
    const slots: number[] = []
    let s: number | null = start
    while (s !== null && !seen.has(s) && dest[s] !== s) {
      seen.add(s)
      slots.push(s)
      s = dest[s]
    }
    loops.push({ kind, slots, open: s === null })
  }
  return loops
}

export function homeOf(c: Cube): HomeReport {
  // dest[s]: where the piece in top slot s belongs, when it is a top piece.
  const cornerDest = TOP.map((s) => (c[CP + s] < 4 ? c[CP + s] : null))
  const edgeDest = TOP.map((s) => (c[EP + s] < 4 ? c[EP + s] : null))
  const arrows: Arrow[] = []
  TOP.forEach((s) => {
    const cd = cornerDest[s]
    const ed = edgeDest[s]
    if (cd !== null && cd !== s) arrows.push({ kind: 'corner', from: s, to: cd })
    if (ed !== null && ed !== s) arrows.push({ kind: 'edge', from: s, to: ed })
  })
  let lowerSolved = true
  for (let i = 4; i < 8; i++) if (c[CP + i] !== i || c[8 + i] !== 0) lowerSolved = false
  for (let i = 4; i < 12; i++) if (c[EP + i] !== i || c[28 + i] !== 0) lowerSolved = false
  const below = cornerDest.filter((d) => d === null).length + edgeDest.filter((d) => d === null).length
  return {
    arrows,
    loops: [...loopsOf('corner', cornerDest), ...loopsOf('edge', edgeDest)],
    homeCorners: TOP.filter((s) => cornerDest[s] === s),
    homeEdges: TOP.filter((s) => edgeDest[s] === s),
    below,
    lowerSolved,
  }
}

const label = (kind: Loop['kind'], s: number) => (kind === 'corner' ? CORNER_LABELS[s] : EDGE_LABELS[s])

/** "UFR ↔ UBL" for a swap, "UR → UL → UB" for a longer loop (and back to the start). */
export function loopText(l: Loop): string {
  const names = l.slots.map((s) => label(l.kind, s))
  // An open chain (a piece from below broke the loop) has no way back.
  return names.length === 2 && !l.open ? names.join(' ↔ ') : names.join(' → ')
}

/** "two swaps", "one loop of 3", "a swap and a loop of 3"… for one kind of piece. */
export function loopsSummary(loops: Loop[]): string {
  if (loops.length === 0) return 'all home'
  const swaps = loops.filter((l) => l.slots.length === 2).length
  const longer = loops.filter((l) => l.slots.length > 2)
  const parts: string[] = []
  const word = ['no', 'one', 'two', 'three', 'four']
  if (swaps) parts.push(`${word[swaps]} swap${swaps > 1 ? 's' : ''}`)
  if (longer.length) parts.push(`${word[longer.length]} loop${longer.length > 1 ? 's' : ''}`)
  return parts.join(' and ')
}
