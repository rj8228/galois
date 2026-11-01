import type { ComponentChildren } from 'preact'

/** Geometry of the top layer seen from above, shared by the Top and Home lenses. */
export const CELL = 58
export const GAP = 6
export const STRIP = 16
export const X0 = 27
export const Y0 = 33
export const WIDTH = X0 * 2 + CELL * 3 + GAP * 2
export const HEIGHT = Y0 + CELL * 3 + GAP * 2 + 23 + 22

/** The top-left corner of the grid cell in row r (0 = back) and column c (0 = left). */
export const cellAt = (r: number, c: number) => ({ x: X0 + c * (CELL + GAP), y: Y0 + r * (CELL + GAP) })
/** The centre of a cell. */
export const centreOf = (r: number, c: number) => {
  const p = cellAt(r, c)
  return { x: p.x + CELL / 2, y: p.y + CELL / 2 }
}

/** An SVG of the top layer, with FRONT written under it. */
export function TopFrame({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <svg class="solve-drawing" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
      {children}
      <text
        x={WIDTH / 2}
        y={HEIGHT - 4}
        text-anchor="middle"
        font-size="10"
        style={{ fill: 'var(--muted)', fontFamily: 'var(--mono)' }}
      >
        FRONT
      </text>
    </svg>
  )
}
