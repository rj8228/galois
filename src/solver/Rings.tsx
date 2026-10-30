import { RING_COUNTS } from './report.ts'
import { phase, played, report, shownRounds } from './state.ts'

const C = 170
const radius = (d: number) => 14 + d * 12.6
const ANGLE = -Math.PI / 3

/**
 * Rings of positions by how many moves they need. The dashed ring is the solver's floor, which
 * moves outward a round at a time. Once proven, the dot is your position, and it drops one ring
 * per move as the solution plays.
 */
export function Rings() {
  const r = report.value
  const searching = phase.value === 'searching'
  const proven = phase.value === 'proven'
  const rounds = r?.rounds ?? []
  const current = searching && rounds.length ? rounds[Math.min(shownRounds.value, rounds.length - 1)] : undefined
  const floor = searching ? current?.bound : proven ? r?.distance : undefined
  const at = proven && r ? Math.max(0, r.distance - played.value) : null
  const dot =
    at === null
      ? null
      : { x: C + Math.cos(ANGLE) * (at ? radius(at) : 0), y: C + Math.sin(ANGLE) * (at ? radius(at) : 0) }
  const label =
    at !== null
      ? `Rings of positions by moves from solved. Your position is ${at} move${at === 1 ? '' : 's'} from solved.`
      : floor !== undefined
        ? `Rings of positions by moves from solved. The solver's floor is at ${floor} moves.`
        : 'Rings of positions by moves from solved, from 0 at the centre to 11 at the edge.'

  return (
    <svg class="rings" viewBox="0 0 340 340" role="img" aria-label={label}>
      {RING_COUNTS.slice(1).map((_, i) => (
        <circle key={`r${i + 1}`} class="ring" cx={C} cy={C} r={radius(i + 1)} />
      ))}
      {floor !== undefined && <circle class="ring-floor" cx={C} cy={C} r={radius(floor)} />}
      <circle class="ring-solved" cx={C} cy={C} r={6} />
      {RING_COUNTS.slice(1).map((_, i) => (
        <text key={`t${i + 1}`} class="ring-label" x={C} y={C + radius(i + 1) - 3.5} text-anchor="middle">
          {i + 1}
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
