import { signal } from '@preact/signals'
import { useRef, useState } from 'preact/hooks'
import { settings, updateSettings } from '../settings/settings.ts'
import { NotationKeypad } from './NotationKeypad.tsx'
import { parseSequence } from './notation.ts'
import { looping, loopSequence, player, playing, playSequence, step, stopLoop, togglePlay } from './state.ts'

/** The text in the sequence box, shared with the analysis card. */
export const sequenceText = signal('R U')

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

export function SequenceBar() {
  const input = useRef<HTMLInputElement>(null)
  const [keypadOpen, setKeypadOpen] = useState(false)
  const parsed = parseSequence(sequenceText.value)
  const ready = player.value !== null
  const keypadMode = settings.value.keypad
  const useKeypad = keypadMode === 'on' || (keypadMode === 'auto' && coarse)

  const insert = (key: string) => {
    const el = input.current
    if (!el) return
    const text = sequenceText.value
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    let next = text
    let caret = start
    if (key === 'clear') {
      next = ''
      caret = 0
    } else if (key === '⌫') {
      const from = start === end ? Math.max(0, start - 1) : start
      next = text.slice(0, from) + text.slice(end)
      caret = from
    } else {
      // Letters start a new move, so add a space before them when needed.
      const isMoveLetter = /^[RLUDFBMESxyz]$/.test(key)
      const before = text.slice(0, start)
      const piece = key === '␣' ? ' ' : isMoveLetter && before && !/[\s(]$/.test(before) ? ` ${key}` : key
      next = before + piece + text.slice(end)
      caret = start + piece.length
    }
    sequenceText.value = next
    requestAnimationFrame(() => el.setSelectionRange(caret, caret))
  }

  const play = (e: Event) => {
    e.preventDefault()
    if (parsed.ok) playSequence(parsed.moves)
  }

  return (
    <form class="seq" onSubmit={play}>
      <label class="seq-label" for="sequence">
        Sequence
      </label>
      <div class="seq-row">
        <input
          id="sequence"
          ref={input}
          value={sequenceText.value}
          onInput={(e) => {
            sequenceText.value = e.currentTarget.value
          }}
          onFocus={() => useKeypad && setKeypadOpen(true)}
          inputMode={useKeypad ? 'none' : 'text'}
          spellcheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={!parsed.ok}
          aria-describedby="sequence-error"
        />
        <button type="submit" class="btn primary" disabled={!ready || !parsed.ok}>
          Play
        </button>
      </div>
      {!parsed.ok && sequenceText.value.trim() && (
        <p id="sequence-error" class="field-error">
          {parsed.error}
        </p>
      )}
      {useKeypad && keypadOpen && (
        <NotationKeypad
          onKey={insert}
          onDone={() => {
            setKeypadOpen(false)
            input.current?.blur()
          }}
        />
      )}
      <div class="transport" role="group" aria-label="Playback">
        <button type="button" class="btn small" onClick={() => step(-1)} disabled={!ready} aria-label="Step back">
          ◀ Step
        </button>
        <button type="button" class="btn small" onClick={togglePlay} disabled={!ready}>
          {playing.value ? 'Pause' : 'Play ▶'}
        </button>
        <button type="button" class="btn small" onClick={() => step(1)} disabled={!ready} aria-label="Step forward">
          Step ▶
        </button>
        <button
          type="button"
          class="btn small"
          aria-pressed={looping.value}
          disabled={!ready || !parsed.ok}
          onClick={() => (looping.value ? stopLoop() : parsed.ok && loopSequence(parsed.moves))}
        >
          {looping.value ? 'Stop loop' : 'Loop'}
        </button>
        <label class="speed">
          <span>Speed</span>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.25"
            value={settings.value.speed}
            onInput={(e) => updateSettings({ speed: Number(e.currentTarget.value) })}
          />
          <span class="mono">{settings.value.speed.toFixed(2)}×</span>
        </label>
      </div>
    </form>
  )
}
