import type { FloorName, SolveReport } from './engine.ts'

/** Messages to the solver worker. */
export type Request =
  | { id: number; type: 'init' }
  | { id: number; type: 'solve'; moves: string[]; floor: FloorName }
  | { id: number; type: 'random'; ring?: number }

/** Messages back from it. */
export type Reply =
  | { id: number; type: 'ready'; rings: number[]; ms: number }
  | { id: number; type: 'solved'; report: SolveReport }
  | { id: number; type: 'random'; moves: string[] }
  | { id: number; type: 'error'; message: string }
