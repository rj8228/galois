import { useEffect, useRef } from 'preact/hooks'
import { Field } from './Field.tsx'
import {
  createSolverPlayer,
  mode,
  phase,
  played,
  position,
  positionLabel,
  report,
  resetSolver,
  solverPlayer,
  undoSolver,
} from './state.ts'

/** The stage while the Solver is open: a 2×2 in place of the main cube. */
export function SolverStage() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    createSolverPlayer().then((p) => {
      if (host.current && p.parentElement !== host.current) host.current.append(p)
    })
  }, [])

  if (mode.value === 'all') {
    return (
      <>
        <div ref={host} class="stage-player" hidden />
        <Field />
        <span class="stage-hint">1 dot = 1,000 positions</span>
      </>
    )
  }
  const r = report.value
  const n = r?.solution.length ?? 0
  const done = Math.min(played.value, n)
  const hint = !solverPlayer.value
    ? 'Loading cube…'
    : phase.value === 'searching'
      ? 'Searching…'
      : phase.value === 'proven' && r
        ? done < n
          ? `Move ${done + 1} of ${n}: ${r.solution[done]} · ${n - done} to go`
          : n
            ? `Solved in ${n}`
            : 'Already solved'
        : positionLabel.value
  return (
    <>
      <div ref={host} class="stage-player" />
      <span class="stage-hint" aria-live="polite">
        {hint}
      </span>
      <div class="stage-actions">
        <button
          type="button"
          class="btn small"
          onClick={undoSolver}
          disabled={!solverPlayer.value || phase.value === 'searching' || position.value.length === 0}
        >
          Undo
        </button>
        <button
          type="button"
          class="btn small"
          onClick={resetSolver}
          disabled={!solverPlayer.value || phase.value === 'searching'}
        >
          Reset
        </button>
      </div>
    </>
  )
}
