import { FACES, SUFFIXES } from '../cube/notation.ts'
import { phase, solverPlayer, turnSolver } from './state.ts'

const MOVES = SUFFIXES.flatMap((s) => FACES.map((f) => f + s))

/** Turn the 2×2 by hand to set up any position you like. */
export function SolverPad() {
  const disabled = !solverPlayer.value || phase.value === 'searching'
  return (
    <div class="pad-wrap">
      <h3>Turn the 2×2</h3>
      <div class="pad" role="group" aria-label="2×2 face moves">
        {MOVES.map((m) => (
          <button type="button" key={m} onClick={() => turnSolver(m)} disabled={disabled}>
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}
