import type { KPuzzle } from 'cubing/kpuzzle'
import { useEffect, useState } from 'preact/hooks'
import { parseSequence } from '../cube/notation.ts'
import { sequenceText } from '../cube/SequenceBar.tsx'
import { history, scramble } from '../cube/state.ts'
import { orderOf } from '../engine/order.ts'

let kpuzzlePromise: Promise<KPuzzle> | null = null
const loadKPuzzle = () => {
  kpuzzlePromise ??= import('cubing/puzzles').then(({ cube3x3x3 }) => cube3x3x3.kpuzzle())
  return kpuzzlePromise
}

function OrderCard() {
  const [kpuzzle, setKPuzzle] = useState<KPuzzle | null>(null)
  useEffect(() => {
    loadKPuzzle().then(setKPuzzle)
  }, [])
  const parsed = parseSequence(sequenceText.value)
  const order = kpuzzle && parsed.ok ? orderOf(kpuzzle, parsed.moves.join(' ')) : null
  return (
    <div class="card" aria-live="polite">
      <h3>Order of the sequence</h3>
      {order === null ? (
        <p class="muted">{parsed.ok ? 'Working it out…' : 'Type a valid sequence to see its order.'}</p>
      ) : (
        <>
          <p class="big-number">{order}</p>
          <p>
            {order === 1
              ? 'This sequence does nothing overall: it is the identity.'
              : `Play ${sequenceText.value.trim()} ${order} times and the cube returns to where it started.`}
          </p>
        </>
      )}
      <p class="muted small">Full analysis (cycles, parity, piece tracker) arrives in Phase 2.</p>
    </div>
  )
}

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
      <OrderCard />
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
