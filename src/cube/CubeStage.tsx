import { useEffect, useRef } from 'preact/hooks'
import { route } from '../app/router.ts'
import { SolveTimer } from '../daily/SolveTimer.tsx'
import { HelpHeading } from '../help/Help.tsx'
import { SolverStage } from '../solver/SolverStage.tsx'
import { createPlayer, history, locked, newScramble, notice, player, reset, undo } from './state.ts'

/**
 * The stage: the shared cube plus its quick actions. Mounted once, outside the routed panel.
 * The Solver shows its own 2×2 here; the 3×3 stays mounted underneath, hidden, with its state intact.
 */
export function CubeStage() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    createPlayer().then((p) => {
      if (host.current && p.parentElement !== host.current) host.current.append(p)
    })
  }, [])

  const ready = player.value !== null
  if (route.value === 'solver') {
    return (
      <section class="stage" aria-label="2×2 cube">
        <div ref={host} class="stage-player" hidden />
        <SolverStage />
      </section>
    )
  }
  return (
    <section class="stage" aria-label="Cube">
      <div ref={host} class="stage-player" />
      <span class="stage-hint">{ready ? notice.value || 'Drag to rotate the view' : 'Loading cube…'}</span>
      <SolveTimer />
      <div class="stage-help">
        <HelpHeading topic="stage" placement="overlay" label="the cube">
          {null}
        </HelpHeading>
      </div>
      <div class="stage-actions">
        <button type="button" class="btn small" onClick={undo} disabled={!ready || history.value.length === 0}>
          Undo
        </button>
        <button type="button" class="btn small" onClick={newScramble} disabled={!ready || locked.value}>
          Scramble
        </button>
        <button type="button" class="btn small" onClick={reset} disabled={!ready || locked.value}>
          Reset
        </button>
      </div>
    </section>
  )
}
