import './lenses.css'
import { findLens, LENSES } from './registry.ts'
import { activeLens } from './state.ts'

/**
 * The row of lens buttons at the top of the Play stage. Hidden while the cube is the only lens,
 * so the base ships invisible until the lens tasks register theirs.
 */
export function LensBar() {
  if (LENSES.length < 2) return null
  const current = findLens(activeLens.value).id
  return (
    <div class="lens-bar" role="group" aria-label="Lenses">
      {LENSES.map((l) => (
        <button
          key={l.id}
          type="button"
          class={l.id === current ? 'lens-chip lens-chip-on' : 'lens-chip'}
          aria-pressed={l.id === current}
          title={l.hint}
          onClick={() => {
            activeLens.value = l.id
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

/** The active lens's view, or null for the cube lens (the stage then shows the 3D player). */
export function LensView() {
  const lens = findLens(activeLens.value)
  if (!lens.View) return null
  const View = lens.View
  return (
    <section class="lens-view" aria-label={`${lens.label} lens`}>
      <View />
    </section>
  )
}
