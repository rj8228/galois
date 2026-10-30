/**
 * Results about the whole 2×2, for the Solver's "whole cube" view. They come from the Galois
 * solver lab, which built the exact table of every position and ran the solver on all of them.
 * The app shows them as they are and never recounts them; the unit tests check the ones the
 * app's own engine can reproduce.
 */

/** How many positions need each number of moves, 0 to 11 (half-turn metric; matches the published counts). */
export const RING_COUNTS = [1, 9, 54, 321, 1847, 9992, 50136, 227536, 870072, 1887748, 623800, 2644]
export const TOTAL_POSITIONS = 3_674_160

/** The lab ran IDA* with its 400 KB floor on every position and replayed every solution. */
export const EXHAUSTIVE = {
  positions: 3_674_160,
  mismatches: 0,
  nodes: 606_705_973,
  meanNodes: 165,
  maxNodes: 15_375,
  seconds: 97,
  cores: 2,
}

/** Mean positions checked per solve, over the same 1,000 random positions, for each floor. */
export const FLOOR_WORK: { name: string; size: string; nodes: number; note?: string }[] = [
  {
    name: 'No floor',
    size: 'nothing stored',
    nodes: 18_139_852,
    note: 'Counted, not run: every sequence shorter than 10 moves.',
  },
  { name: 'Twists only', size: '729 entries', nodes: 214_344 },
  { name: 'Places only', size: '5,040 entries', nodes: 90_238 },
  { name: 'Best tables', size: '2 KB', nodes: 18_609 },
  { name: 'Best tables', size: '20 KB', nodes: 2_319 },
  { name: 'Best tables', size: '100 KB', nodes: 627 },
  { name: 'Best tables', size: '400 KB', nodes: 162 },
]

/**
 * A worked example: one of the hardest positions, solved by the app's engine with the medium
 * floor. Each round is "at least this many moves", and how many positions it checked.
 */
export const EXAMPLE = {
  scramble: "F R' F' U2 F U' F2 R F2 R' U2",
  floor: 'medium' as const,
  floorAtStart: 6,
  rounds: [
    { bound: 6, nodes: 52 },
    { bound: 7, nodes: 490 },
    { bound: 8, nodes: 3_688 },
    { bound: 9, nodes: 23_698 },
    { bound: 10, nodes: 144_088 },
    { bound: 11, nodes: 113_461 },
  ],
  solution: "U2 R F2 R' F2 U F' U2 F R F'",
  /** The same position with the other floors. */
  weak: { nodes: 4_275_857, floorAtStart: 4 },
  strong: { nodes: 657, floorAtStart: 9 },
}
