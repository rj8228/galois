/** Piece names in cubing.js's 3×3×3 orbit order (checked against U, D, F, R and M in tests). */
export const EDGE_NAMES = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'] as const
export const CORNER_NAMES = ['UFR', 'URB', 'UBL', 'ULF', 'DRF', 'DFL', 'DLB', 'DBR'] as const
export const CENTER_NAMES = ['U', 'L', 'F', 'R', 'B', 'D'] as const

export type OrbitName = 'EDGES' | 'CORNERS' | 'CENTERS'

export const ORBITS: { name: OrbitName; label: string; names: readonly string[]; twists: number }[] = [
  { name: 'CORNERS', label: 'Corners', names: CORNER_NAMES, twists: 3 },
  { name: 'EDGES', label: 'Edges', names: EDGE_NAMES, twists: 2 },
  // Centre orientation is ignored on a normal 3×3, so centres only ever move, never twist.
  { name: 'CENTERS', label: 'Centres', names: CENTER_NAMES, twists: 1 },
]

export type PieceRef = { orbit: OrbitName; index: number }

export const pieceName = (p: PieceRef) => ORBITS.find((o) => o.name === p.orbit)?.names[p.index] ?? '?'
