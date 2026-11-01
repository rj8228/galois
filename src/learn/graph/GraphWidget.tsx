import './graph.css'
import { useMemo, useState } from 'preact/hooks'
import { MOVE_NAMES } from '../../solver3/cube3.ts'
import { CAP, explore, loopOrder, productOrder, type Subgroup } from './graph.ts'

const W = 358
const H = 330
const CX = W / 2
const CY = 168
const R = 128
/** Up to this many positions, each one is drawn and can be tapped; beyond it, whole rings. */
const NODE_LIMIT = 40
const COLOURS = ['var(--danger)', 'var(--accent)', 'var(--good)', 'var(--ink)']
const MAX_MOVES = 4

type Point = { x: number; y: number }

/** Where each node is drawn: around one loop, or on rings by distance from solved. */
function layout(g: Subgroup): Point[] {
  const pts: Point[] = new Array(g.nodes.length)
  if (g.loop) {
    loopOrder(g).forEach((n, i, all) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / all.length
      pts[n] = { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }
    })
    return pts
  }
  const byDist: number[][] = []
  g.nodes.forEach((n, i) => {
    byDist[n.dist] ??= []
    byDist[n.dist].push(i)
  })
  byDist.forEach((ring, d) => {
    const r = g.furthest === 0 ? 0 : (R * d) / g.furthest
    ring.forEach((n, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * (i + (d % 2) * 0.5)) / ring.length
      pts[n] = { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
    })
  })
  return pts
}

const fmt = (n: number) => n.toLocaleString('en-US')

function describe(g: Subgroup, moves: string[]): string {
  if (g.loop)
    return `${g.nodes.length} positions on one loop, made by ${moves.join(' and ')}; the furthest is ${g.furthest} moves from solved.`
  if (g.capped)
    return `Rings of positions by distance from solved, made by ${moves.join(', ')}. The search stopped at ${fmt(CAP)} positions, ${g.furthest} moves out.`
  return `${g.nodes.length} positions made by ${moves.join(', ')}, on rings by distance from solved, out to ${g.furthest} moves.`
}

/** Lesson 9: pick moves, see the subgroup they generate as a graph. */
export function GraphWidget() {
  const [moves, setMoves] = useState<string[]>(['R2', 'U2'])
  const [picking, setPicking] = useState(false)
  // Start with a position 3 moves away tapped, as in the design.
  const [tapped, setTapped] = useState<number | null>(() => explore(['R2', 'U2']).nodes.findIndex((n) => n.dist === 3))
  const g = useMemo(() => explore(moves), [moves])
  const pts = useMemo(() => layout(g), [g])
  const order = useMemo(() => productOrder(moves), [moves])
  const showNodes = g.nodes.length <= NODE_LIMIT
  const sel = tapped !== null && tapped < g.nodes.length ? tapped : null

  const colourOf = (m: string) => COLOURS[moves.indexOf(m) % COLOURS.length]
  // The path from solved to the tapped node, as node pairs.
  const onPath = new Set<string>()
  if (sel !== null)
    for (let n = sel; g.nodes[n].parent >= 0; n = g.nodes[n].parent) onPath.add(`${g.nodes[n].parent},${n}`)
  const byDist: number[][] = []
  g.nodes.forEach((n, i) => {
    byDist[n.dist] ??= []
    byDist[n.dist].push(i)
  })

  const change = (next: string[]) => {
    setMoves(next)
    setTapped(null)
    setPicking(false)
  }

  return (
    <div class="graph-widget">
      <div class="graph-gens" role="group" aria-label="Allowed moves">
        <span class="graph-k">Allowed moves</span>
        {moves.map((m) => (
          <button
            key={m}
            type="button"
            class="graph-gen"
            aria-label={moves.length > 1 ? `Remove ${m}` : m}
            title={moves.length > 1 ? `Remove ${m}` : undefined}
            disabled={moves.length === 1}
            onClick={() => change(moves.filter((x) => x !== m))}
          >
            <span class="graph-swatch" style={{ background: colourOf(m) }} />
            {m}
          </button>
        ))}
        {moves.length < MAX_MOVES && (
          <button
            type="button"
            class="graph-gen graph-add"
            aria-label="Add a move"
            aria-expanded={picking}
            onClick={() => setPicking(!picking)}
          >
            +
          </button>
        )}
      </div>
      {picking && (
        <div class="graph-pick" role="group" aria-label="Pick a move to add">
          {MOVE_NAMES.filter((m) => !moves.includes(m)).map((m) => (
            <button key={m} type="button" class="graph-pick-btn" onClick={() => change([...moves, m])}>
              {m}
            </button>
          ))}
        </div>
      )}
      <div class="graph-stage">
        <svg class="graph-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(g, moves)}>
          {!showNodes &&
            byDist.map((_ring, d) => {
              const r = g.furthest === 0 ? 0 : (R * d) / g.furthest
              return (
                <circle
                  key={`r${d}`}
                  cx={CX}
                  cy={CY}
                  r={Math.max(r, 3)}
                  fill="none"
                  stroke-width={sel !== null && g.nodes[sel].dist === d ? 3 : 1.2}
                  style={{ stroke: sel !== null && g.nodes[sel].dist === d ? 'var(--accent)' : 'var(--line)' }}
                />
              )
            })}
          {!showNodes &&
            pts
              .slice(0, 1500)
              .map((p, i) => <circle key={`d${i}`} cx={p.x} cy={p.y} r="1.6" style={{ fill: 'var(--muted)' }} />)}
          {showNodes &&
            g.edges.map((e) => (
              <line
                key={`${e.a}-${e.b}`}
                x1={pts[e.a].x}
                y1={pts[e.a].y}
                x2={pts[e.b].x}
                y2={pts[e.b].y}
                stroke-width="3"
                style={{ stroke: colourOf(e.move) }}
              />
            ))}
          {showNodes &&
            g.edges
              .filter((e) => onPath.has(`${e.a},${e.b}`) || onPath.has(`${e.b},${e.a}`))
              .map((e) => (
                <line
                  key={`p${e.a}-${e.b}`}
                  x1={pts[e.a].x}
                  y1={pts[e.a].y}
                  x2={pts[e.b].x}
                  y2={pts[e.b].y}
                  stroke-width="8"
                  stroke-linecap="round"
                  opacity="0.35"
                  style={{ stroke: 'var(--ink)' }}
                />
              ))}
          {showNodes &&
            g.nodes.map((n, i) => {
              const strong = i === 0 || i === sel
              return (
                <g key={`n${i}`}>
                  <circle
                    cx={pts[i].x}
                    cy={pts[i].y}
                    r={strong ? 15 : 13}
                    stroke-width="1.5"
                    style={{
                      fill: strong ? 'var(--accent)' : 'var(--surface)',
                      stroke: strong ? 'var(--accent)' : 'var(--line)',
                    }}
                  />
                  <text
                    x={pts[i].x}
                    y={pts[i].y + 4}
                    text-anchor="middle"
                    font-size="11"
                    font-weight={strong ? 600 : 400}
                    style={{ fill: strong ? 'var(--accent-ink)' : 'var(--ink)', fontFamily: 'var(--mono)' }}
                  >
                    {n.dist}
                  </text>
                </g>
              )
            })}
          <text
            x={CX}
            y={pts[0].y - 22}
            text-anchor="middle"
            font-size="10"
            style={{ fill: 'var(--accent)', fontFamily: 'var(--mono)' }}
          >
            SOLVED
          </text>
          {g.loop && (
            <>
              <text x={CX} y={CY - 2} text-anchor="middle" font-size="34" class="graph-big">
                {g.nodes.length}
              </text>
              <text
                x={CX}
                y={CY + 20}
                text-anchor="middle"
                font-size="12"
                style={{ fill: 'var(--muted)', fontFamily: 'var(--body)' }}
              >
                positions, nothing else
              </text>
            </>
          )}
        </svg>
        {showNodes &&
          g.nodes.map((n, i) => (
            <button
              key={`b${i}`}
              type="button"
              class="graph-node"
              aria-pressed={i === sel}
              aria-label={i === 0 ? 'Solved' : `A position ${n.dist} ${n.dist === 1 ? 'move' : 'moves'} away`}
              style={{ left: `${(pts[i].x / W) * 100}%`, top: `${(pts[i].y / H) * 100}%` }}
              onClick={() => setTapped(i)}
            />
          ))}
      </div>
      {!showNodes && (
        <div class="graph-rings" role="group" aria-label="Rings by distance">
          <span class="graph-k">Positions at each distance (tap one):</span>
          {byDist.map((ring, d) => (
            <button
              key={d}
              type="button"
              class="graph-ring-btn"
              aria-pressed={sel !== null && g.nodes[sel].dist === d}
              onClick={() => setTapped(ring[0])}
            >
              <span class="sr-only">distance </span>
              {d}: {fmt(ring.length)}
              {g.capped && d === g.furthest ? '+' : ''}
            </button>
          ))}
        </div>
      )}
      <div class="graph-card">
        {sel !== null && (
          <div class="graph-tapped" aria-live="polite">
            <span class="graph-eyebrow">
              You tapped · {g.nodes[sel].dist} {g.nodes[sel].dist === 1 ? 'move' : 'moves'} away
            </span>
            <span class="graph-path" data-testid="graph-path">
              {g.nodes[sel].path.join(' ') || 'solved'}
            </span>
          </div>
        )}
        <p class="graph-text">
          {g.loop
            ? `With only ${moves.join(' and ')} the cube can reach exactly ${g.nodes.length} positions, all on one loop. That closed little world is a subgroup. Add another move and watch it explode.`
            : g.capped
              ? `The search stopped at ${fmt(CAP)} positions, ${g.furthest} moves out, and there are far more: this subgroup is huge. Watch it explode.`
              : `With ${moves.join(', ')} the cube can reach exactly ${fmt(g.nodes.length)} positions. Still a closed world: a subgroup.`}
        </p>
        <div class="graph-stats">
          <div>
            <span class="graph-v" data-testid="graph-positions">
              {g.capped ? `${fmt(g.nodes.length)}+` : fmt(g.nodes.length)}
            </span>
            <span class="graph-k">positions{g.capped ? ' (stopped)' : ''}</span>
          </div>
          <div>
            <span class="graph-v" data-testid="graph-furthest">
              {g.capped ? `${g.furthest}+` : g.furthest}
            </span>
            <span class="graph-k">furthest away</span>
          </div>
          <div>
            <span class="graph-v" data-testid="graph-order">
              {order}
            </span>
            <span class="graph-k">order of {moves.join(' ')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
