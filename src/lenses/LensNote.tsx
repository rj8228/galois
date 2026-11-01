import './solve.css'
import type { Position } from './position.ts'

/** What a Solve lens shows while cubing.js loads, or when whole-cube turns have moved the centres. */
export function PositionNote({ pos }: { pos: Position | null }) {
  if (!pos) return <p class="solve-note">Reading the cube…</p>
  if (!pos.centresHome)
    return (
      <p class="solve-note">
        The centres have moved (a whole-cube turn or a slice move). This lens reads the cube with its starting top on
        top: undo those moves, or reset, to see it.
      </p>
    )
  return null
}
