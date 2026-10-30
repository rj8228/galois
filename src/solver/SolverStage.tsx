import { useEffect, useRef } from 'preact/hooks'
import {
  createSolverPlayer,
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

  const r = report.value
  const left = r ? r.trueDistance - played.value : 0
  const hint = !solverPlayer.value
    ? 'Loading cube…'
    : phase.value === 'searching'
      ? 'Searching…'
      : phase.value === 'proven' && r
        ? left > 0
          ? `${left} move${left === 1 ? '' : 's'} to go`
          : 'Solved'
        : positionLabel.value
  return (
    <>
      <div ref={host} class="stage-player" />
      <span class="stage-hint">{hint}</span>
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
