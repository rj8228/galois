type Props = { onKey: (key: string) => void; onDone: () => void }

const ROWS = [
  ['R', 'L', 'U', 'D', 'F', 'B'],
  ['M', 'E', 'S', 'x', 'y', 'z'],
  ["'", '2', '(', ')', '␣', '⌫'],
]

/** On-screen notation keys, so phones don't need the system keyboard to type moves. */
export function NotationKeypad({ onKey, onDone }: Props) {
  return (
    <div class="keypad" role="group" aria-label="Notation keypad">
      {ROWS.flat().map((k) => (
        <button
          type="button"
          key={k}
          aria-label={k === '␣' ? 'Space' : k === '⌫' ? 'Delete' : k}
          // Keep focus in the input so the caret stays put.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onKey(k)}
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        class="keypad-wide"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => onKey('clear')}
      >
        Clear
      </button>
      <button type="button" class="keypad-wide primary" onClick={onDone}>
        Done
      </button>
    </div>
  )
}
