import { effect, signal } from '@preact/signals'
import type { Analysis } from '../engine/analysis.ts'
import type { OrbitName } from '../engine/pieces.ts'

export type LabContext = { moves: string[]; analysis: Analysis }

export type Lab = {
  id: string
  title: string
  /** The lesson that teaches the idea behind it. */
  lesson: string
  body: string
  task: string
  done: (c: LabContext) => boolean
  success: string
  /** Revealed one at a time, from a nudge to the answer. */
  hints: string[]
}

const orbit = (a: Analysis, name: OrbitName) => a.orbits.find((o) => o.orbit === name)
const affected = (a: Analysis, name: OrbitName) => orbit(a, name)?.affected ?? 0
const total = (a: Analysis) => a.orbits.reduce((n, o) => n + o.affected, 0)
const names = (a: Analysis, name: OrbitName, positions: number[]) => {
  const o = orbit(a, name)
  return o ? positions.map((p) => o.names[p]) : []
}
/** Pieces of one orbit that only swap in pairs, as their names. */
const swapped = (a: Analysis, name: OrbitName) =>
  (orbit(a, name)?.cycles ?? []).filter((c) => c.positions.length === 2).flatMap((c) => names(a, name, c.positions))

export const LABS: Lab[] = [
  {
    id: 'order-1260',
    title: 'The longest loop',
    lesson: 'order',
    body: 'Some sequences return to solved after a handful of repeats; R U takes 105. The largest order any sequence can have is 1260.',
    task: 'A sequence of order 1260.',
    done: (c) => c.analysis.order === 1260,
    success: 'Order 1260: the most any sequence can have.',
    hints: [
      'The order is the least common multiple of the cycle lengths, so you want cycles of lengths like 5, 7 and 9 together.',
      'Five face turns are enough. Use four different faces.',
      "R U2 D' B D'",
    ],
  },
  {
    id: 'order-two-all-edges',
    title: 'Every edge, twice is nothing',
    lesson: 'cycles',
    body: 'Find a sequence of order 2 that moves all 12 edges. Do it twice and the cube is solved again.',
    task: 'Order 2, and all 12 edges move.',
    done: (c) => c.analysis.order === 2 && affected(c.analysis, 'EDGES') === 12,
    success: 'Twelve edges, all in swaps, so twice returns to solved.',
    hints: [
      'A half turn (R2) has order 2. What happens when you combine half turns of opposite faces?',
      'Use a half turn of every face, opposite faces next to each other.',
      'R2 L2 U2 D2 F2 B2',
    ],
  },
  {
    id: 'only-r-u',
    title: 'Only R and U',
    lesson: 'commutators',
    body: 'With only the right and top faces to turn, cycle exactly three edges and leave every other piece alone.',
    task: 'Only R and U turns; exactly 3 edges move, in one loop, and nothing else.',
    done: (c) =>
      c.moves.every((m) => m[0] === 'R' || m[0] === 'U') &&
      total(c.analysis) === 3 &&
      affected(c.analysis, 'EDGES') === 3 &&
      orbit(c.analysis, 'EDGES')?.cycles.length === 1,
    success: 'Three edges cycled with just two faces. This is the U-perm, used in every speedsolve.',
    hints: [
      'R and U share many pieces, so a single commutator moves too much. Expect around 11 moves.',
      'It starts R U′ R U and ends R2.',
      "R U' R U R U R U' R' U' R2",
    ],
  },
  {
    id: 'bottom-three',
    title: 'All on the bottom',
    lesson: 'conjugates',
    body: 'The corner 3-cycle R U R′ D R U′ R′ D′ moves one top corner and two bottom ones. Aim it so all three corners are on the bottom layer.',
    task: 'A 3-cycle of corners, all three on the bottom (D) layer; nothing else changes.',
    done: (c) => {
      const corners = orbit(c.analysis, 'CORNERS')
      return (
        total(c.analysis) === 3 &&
        corners?.cycles.length === 1 &&
        names(c.analysis, 'CORNERS', corners.cycles[0].positions).every((n) => n.startsWith('D'))
      )
    },
    success: 'Aimed at the bottom: one setup move did it.',
    hints: [
      'Conjugate it: one setup move before, its inverse after.',
      'The setup has to bring a bottom corner up into the top-front-right spot. Which face turn does that?',
      "R (R U R' D R U' R' D') R'",
    ],
  },
  {
    id: 'odd-pair',
    title: 'Odd one out',
    lesson: 'parity',
    body: "Lesson 7 says you can't swap just two edges. But you can swap two edges if two corners swap as well. Find a sequence that does exactly that.",
    task: 'Exactly 2 corners swap and 2 edges swap; nothing else changes.',
    done: (c) =>
      total(c.analysis) === 4 &&
      swapped(c.analysis, 'CORNERS').length === 2 &&
      swapped(c.analysis, 'EDGES').length === 2,
    success: 'Two corners and two edges swapped: odd and odd, so the parities still match.',
    hints: [
      'No commutator can do this: every commutator is an even rearrangement.',
      'Speedcubers call it the T-perm. It begins with R U R′ U′.',
      "R U R' U' R' F R2 U' R' U' R U R' F'",
    ],
  },
  {
    id: 'flip-two',
    title: 'Flip two edges',
    lesson: 'twists',
    body: "Lesson 8 showed edge flips always add up to an even number. So you can't flip one edge, but you can flip two. Flip two edges in place and move nothing else.",
    task: 'Exactly 2 edges flipped in place; nothing else changes.',
    done: (c) => total(c.analysis) === 2 && orbit(c.analysis, 'EDGES')?.twistedInPlace.length === 2,
    success: 'Two edges flipped, and the flips add up to zero, as they must.',
    hints: [
      'The middle slice M is your friend: it moves only edges and centres.',
      'Use only M and U moves. The answer is 12 moves: M′ U M′ U M′ U2, then something similar going back.',
      "M' U M' U M' U2 M U M U M U2",
    ],
  },
]

export const labById = (id: string) => LABS.find((l) => l.id === id)

/** Lab ids solved on this device. */
const KEY = 'galois.labs.v1'
function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
export const solvedLabs = signal<string[]>(load())
effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(solvedLabs.value))
  } catch {
    // Not saved; lasts for this visit only.
  }
})
export function markSolved(id: string) {
  if (!solvedLabs.value.includes(id)) solvedLabs.value = [...solvedLabs.value, id]
}
