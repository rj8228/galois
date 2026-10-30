import { phase, played, report, rings, shownRounds } from './state.ts'

const C = 170
const radius = (d: number) => 14 + d * 12.6
const ANGLE = -Math.PI / 3

/**
 * Every 2×2 position, sorted onto rings by how many moves it needs. The dashed ring is the solver's
 * floor; while it searches, rings glow where it is looking. Once proven, the dot is the position,
 * and it drops one ring per move as the solution plays.
 */
export function Rings() {
  const counts = rings.value
  const n = counts.length || 12
  const r = report.value
  const searching = phase.value === 'searching'
  const proven = phase.value === 'proven'
  const rounds = r?.rounds ?? []
  const current = searching ? rounds[Math.min(shownRounds.value, rounds.length - 1)] : undefined
  // The glow shows where the current round is looking; once proven it gives way to the dot.
  const heat = current?.byRing ?? []
  const hottest = Math.log1p(Math.max(1, ...heat))
  const floor = searching ? current?.bound : proven ? r?.trueDistance : undefined
  const at = proven && r ? Math.max(0, r.trueDistance - played.value) : null
  const dot =
    at === null
      ? null
      : { x: C + Math.cos(ANGLE) * (at ? radius(at) : 0), y: C + Math.sin(ANGLE) * (at ? radius(at) : 0) }
  const label =
    at !== null
      ? `Rings of positions by moves from solved. The position is ${at} move${at === 1 ? '' : 's'} from solved.`
      : floor !== undefined
        ? `Rings of positions by moves from solved. The solver's floor is at ${floor} moves.`
        : 'Rings of positions by moves from solved, from 0 at the centre to 11 at the edge.'

  return (
    <svg class="rings" viewBox="0 0 340 340" role="img" aria-label={label}>
      {Array.from({ length: n - 1 }, (_, i) => i + 1).map((d) => (
        <circle key={d} class="ring" cx={C} cy={C} r={radius(d)} />
      ))}
      {heat.map((count, d) => {
        if (!count || d === 0) return null
        const w = Math.log1p(count) / hottest
        return (
          <circle
            key={`h${d}`}
            class="ring-heat"
            cx={C}
            cy={C}
            r={radius(d)}
            style={{ opacity: 0.12 + 0.6 * w, strokeWidth: 1 + 3.5 * w }}
          />
        )
      })}
      {floor !== undefined && <circle class="ring-floor" cx={C} cy={C} r={radius(floor)} />}
      <circle class="ring-solved" cx={C} cy={C} r={6} />
      {Array.from({ length: n - 1 }, (_, i) => i + 1).map((d) => (
        <text key={`t${d}`} class="ring-label" x={C} y={C + radius(d) - 3.5} text-anchor="middle">
          {d}
        </text>
      ))}
      {dot && (
        <g class="ring-dot" style={{ transform: `translate(${dot.x}px, ${dot.y}px)` }}>
          <circle r={8} />
        </g>
      )}
    </svg>
  )
}
