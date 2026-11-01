/** Drawing helpers shared by the Rings and Path lenses: points on a ring, arcs and chords between them. */

export const CX = 170
export const CY = 170

export type Point = { x: number; y: number }

/** A point on a ring, at an angle in degrees clockwise from the top. */
export const at = (r: number, angle: number): Point => {
  const t = (angle * Math.PI) / 180
  return { x: CX + r * Math.sin(t), y: CY - r * Math.cos(t) }
}

const f = (n: number) => n.toFixed(1)

/** A clockwise arc along a ring from one node to the next, stopping short of both nodes. */
export function arcPath(r: number, from: number, to: number, gap: number): string {
  const span = (((to - from) % 360) + 360) % 360 || 360
  const d = (gap / r) * (180 / Math.PI)
  const a = at(r, from + d)
  const b = at(r, from + span - d)
  return `M${f(a.x)} ${f(a.y)} A${r} ${r} 0 ${span - 2 * d > 180 ? 1 : 0} 1 ${f(b.x)} ${f(b.y)}`
}

/** A line from one node to another, stopping short of both, bowed a little towards the centre. */
export function chordPath(p: Point, q: Point, gap: number): string {
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
  const ux = (q.x - p.x) / len
  const uy = (q.y - p.y) / len
  const a = { x: p.x + ux * gap, y: p.y + uy * gap }
  const b = { x: q.x - ux * gap, y: q.y - uy * gap }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const c = { x: mid.x + (CX - mid.x) * 0.25, y: mid.y + (CY - mid.y) * 0.25 }
  return `M${f(a.x)} ${f(a.y)} Q${f(c.x)} ${f(c.y)} ${f(b.x)} ${f(b.y)}`
}

/** A small loop beside a node, for a piece that twists or flips where it is. */
export function loopPath(p: Point, angle: number, r: number): string {
  // Sit the loop just outside the node, away from the centre.
  const t = (angle * Math.PI) / 180
  const cx = p.x + Math.sin(t + 0.7) * (r + 7)
  const cy = p.y - Math.cos(t + 0.7) * (r + 7)
  const a = { x: cx - 6, y: cy + 3 }
  const b = { x: cx + 1, y: cy + 7 }
  return `M${f(a.x)} ${f(a.y)} A7 7 0 1 1 ${f(b.x)} ${f(b.y)}`
}

/** Arrowheads, one per tone, coloured by CSS so they follow the look. */
export function Arrowheads({ prefix, tones }: { prefix: string; tones: string[] }) {
  return (
    <defs>
      {tones.map((t) => (
        <marker
          key={t}
          id={`${prefix}-${t}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path class={`arrow-${t}`} d="M0 0L10 5L0 10z" />
        </marker>
      ))}
    </defs>
  )
}
