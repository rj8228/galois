import { useState } from 'preact/hooks'
import { AnalysisPanel } from '../analysis/AnalysisPanel.tsx'
import { history, scramble } from '../cube/state.ts'

export function Play() {
  const [copied, setCopied] = useState(false)
  const moves = history.value
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(moves.join(' '))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div class="stack">
      <AnalysisPanel />
      <div class="card">
        <h3>Your moves ({moves.length})</h3>
        {scramble.value && (
          <p class="small">
            <span class="muted">Scramble: </span>
            <span class="mono">{scramble.value}</span>
          </p>
        )}
        <p class="mono history">
          {moves.length ? moves.join(' ') : 'None yet. Use the move pad, the keyboard, or Play.'}
        </p>
        {moves.length > 0 && (
          <button type="button" class="btn small" onClick={copy}>
            {copied ? 'Copied' : 'Copy moves'}
          </button>
        )}
      </div>
      <div class="card only-wide">
        <h3>Keyboard shortcuts</h3>
        <dl class="keys">
          <dt>
            <kbd>R</kbd> <kbd>U</kbd> <kbd>F</kbd> …
          </dt>
          <dd>Turn that face</dd>
          <dt>
            <kbd>Shift</kbd> + letter
          </dt>
          <dd>Prime (counter-clockwise)</dd>
          <dt>
            <kbd>Option</kbd> + letter
          </dt>
          <dd>Double turn</dd>
          <dt>
            <kbd>⌘</kbd> <kbd>Z</kbd>
          </dt>
          <dd>Undo</dd>
          <dt>
            <kbd>Space</kbd>
          </dt>
          <dd>Pause or resume</dd>
          <dt>
            <kbd>←</kbd> <kbd>→</kbd>
          </dt>
          <dd>Step through the sequence</dd>
        </dl>
      </div>
    </div>
  )
}
