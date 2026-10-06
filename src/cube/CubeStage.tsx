import { useEffect, useRef } from 'preact/hooks'
import { HelpHeading } from '../help/Help.tsx'
import { createPlayer, history, newScramble, notice, player, reset, undo } from './state.ts'

/** The stage: the shared cube plus its quick actions. Mounted once, outside the routed panel. */
export function CubeStage() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    createPlayer().then((p) => {
      if (host.current && p.parentElement !== host.current) host.current.append(p)
    })
  }, [])

  const ready = player.value !== null
  return (
    <section class="stage" aria-label="Cube">
      <div ref={host} class="stage-player" />
      <span class="stage-hint">{ready ? notice.value || 'Drag to rotate the view' : 'Loading cube…'}</span>
      <div class="stage-help">
        <HelpHeading topic="stage" placement="overlay" label="the cube">
          {null}
        </HelpHeading>
      </div>
      <div class="stage-actions">
        <button type="button" class="btn small" onClick={undo} disabled={!ready || history.value.length === 0}>
          Undo
        </button>
        <button type="button" class="btn small" onClick={newScramble} disabled={!ready}>
          Scramble
        </button>
        <button type="button" class="btn small" onClick={reset} disabled={!ready}>
          Reset
        </button>
      </div>
    </section>
  )
}
