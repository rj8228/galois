import { useState } from 'preact/hooks'
import { EXTRA_MOVES, FACE_MOVES } from './notation.ts'
import { player, turn } from './state.ts'

export function MovePad() {
  const [more, setMore] = useState(false)
  const disabled = player.value === null
  return (
    <div class="pad-wrap">
      <div class="pad" role="group" aria-label="Face moves">
        {FACE_MOVES.map((m) => (
          <button type="button" key={m} onClick={() => turn(m)} disabled={disabled}>
            {m}
          </button>
        ))}
      </div>
      {more && (
        <div class="pad" role="group" aria-label="Slice moves and rotations">
          {EXTRA_MOVES.map((m) => (
            <button type="button" key={m} onClick={() => turn(m)} disabled={disabled}>
              {m}
            </button>
          ))}
        </div>
      )}
      <button type="button" class="link-btn" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? 'Hide slices and rotations' : 'Slices and rotations (M E S x y z)'}
      </button>
    </div>
  )
}
