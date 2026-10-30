import type { Comparison, FloorName, SolveReport } from './engine.ts'

/** Messages to the solver worker. */
export type Request =
  | { id: number; type: 'init' }
  | { id: number; type: 'solve'; moves: string[]; floor: FloorName }
  | { id: number; type: 'compare'; moves: string[] }

/** Messages back from it. */
export type Reply =
  | { id: number; type: 'ready'; ms: number }
  | { id: number; type: 'solved'; report: SolveReport; buildMs: number }
  | { id: number; type: 'compared'; comparison: Comparison }
  | { id: number; type: 'error'; message: string }
