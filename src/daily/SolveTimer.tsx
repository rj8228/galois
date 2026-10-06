import { formatTime } from './date.ts'
import { closeSession, giveUp, INSPECTION_MS, now, session } from './session.ts'

/** The big timer over the cube during a Speed attempt. */
export function SolveTimer() {
  const s = session.value
  if (s.phase === 'idle') return null
  if (s.phase === 'done') {
    return (
      <div class="solve-timer done" role="status">
        <span class="solve-time">{s.ms === null ? 'DNF' : formatTime(s.ms)}</span>
        <span class="solve-label">
          {s.ms === null ? 'Did not finish' : s.ranked ? 'Solved! Saved to today' : 'Solved (practice)'}
        </span>
        <button type="button" class="btn small" onClick={closeSession}>
          Close
        </button>
      </div>
    )
  }
  const inspecting = s.phase === 'inspecting'
  const left = Math.max(0, Math.ceil((INSPECTION_MS - (now.value - s.startedAt)) / 1000))
  return (
    <div class={`solve-timer ${inspecting ? 'inspecting' : 'running'}`} role="timer" aria-live="off">
      <span class="solve-time">{inspecting ? left : formatTime(now.value - s.startedAt)}</span>
      <span class="solve-label">
        {inspecting ? 'Inspect. The clock starts with your first turn.' : s.ranked ? 'Solving' : 'Practice'}
      </span>
      <button type="button" class="btn small" onClick={giveUp}>
        Give up
      </button>
    </div>
  )
}
