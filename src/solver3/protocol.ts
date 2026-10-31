import type { Round, Solve3Report } from './engine.ts'

/** Messages to the 3×3 solver worker. */
export type Request = { id: number; type: 'init' } | { id: number; type: 'solve'; moves: string[]; budget: number }

/** Messages back from it. A solve sends a 'round' for each completed round, then 'solved'. */
export type Reply =
  | { id: number; type: 'ready'; ms: number }
  | { id: number; type: 'round'; round: Round }
  | { id: number; type: 'solved'; report: Solve3Report & { ceilingMs: number } }
  | { id: number; type: 'error'; message: string }
