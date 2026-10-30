import { RING_COUNTS } from './report.ts'

const SIZE = 600
const C = SIZE / 2
const radius = (d: number) => 26 + d * 24.5
const PER_DOT = 1000

/** A small seeded random generator, so the dots land in the same places every time. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One dot per 1,000 positions (at least one per ring), scattered around each ring's band. */
const DOTS = (() => {
  const rand = seeded(11)
  const dots: { x: number; y: number; d: number }[] = []
  RING_COUNTS.forEach((count, d) => {
    if (d === 0) return
    const n = Math.max(1, Math.round(count / PER_DOT))
    for (let i = 0; i < n; i++) {
      // Leave a narrow lane straight up from the centre, where the ring numbers sit.
      let angle = rand() * Math.PI * 2
      while (Math.abs(angle - Math.PI * 1.5) < 0.09) angle = rand() * Math.PI * 2
      const r = radius(d) + (rand() - 0.5) * 18
      dots.push({ x: C + Math.cos(angle) * r, y: C + Math.sin(angle) * r, d })
    }
  })
  return dots
})()

/**
 * Every 2×2 position on one picture: rings by moves from solved, one dot per 1,000 positions.
 * Nearly all of them sit far out, at 8 to 10 moves.
 */
export function Field() {
  return (
    <svg
      class="field"
      viewBox={`-20 -44 ${SIZE + 40} ${SIZE + 64}`}
      role="img"
      aria-label="All 3,674,160 positions as rings by moves from solved, one dot per 1,000 positions. Almost all lie 8 to 10 moves out; 2,644 need 11."
    >
      {RING_COUNTS.slice(1).map((_, i) => (
        <circle key={`r${i + 1}`} class="field-ring" cx={C} cy={C} r={radius(i + 1)} />
      ))}
      {DOTS.map((p, i) => (
        <circle
          key={i}
          class={p.d === 11 ? 'field-dot field-hard' : 'field-dot'}
          cx={p.x}
          cy={p.y}
          r={p.d === 11 ? 4 : 1.7}
        />
      ))}
      <circle class="ring-solved" cx={C} cy={C} r={7} />
      {RING_COUNTS.slice(1).map((_, i) => (
        <text key={`t${i + 1}`} class="field-label" x={C} y={C - radius(i + 1) + 4} text-anchor="middle">
          {i + 1}
        </text>
      ))}
    </svg>
  )
}
