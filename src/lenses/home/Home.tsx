import './home.css'
import { useEffect, useState } from 'preact/hooks'
import { locked, playSequence } from '../../cube/state.ts'
import { isSolved } from '../../solver3/cube3.ts'
import { PositionNote } from '../LensNote.tsx'
import { CORNER_LABELS, EDGE_LABELS } from '../labels.ts'
import { usePosition } from '../position.ts'
import { centreOf, TopFrame } from '../top/TopFace.tsx'
import { type Arrow, type HomeReport, homeOf, type Loop, loopsSummary, loopText } from './home.ts'

/** Where each top slot is drawn: [row from the back, column from the left]. */
const CORNER_CELL: [number, number][] = [
  [2, 2],
  [2, 0],
  [0, 0],
  [0, 2],
]
const EDGE_CELL: [number, number][] = [
  [1, 2],
  [2, 1],
  [1, 0],
  [0, 1],
]

const COLOUR = { corner: 'var(--accent)', edge: 'var(--danger)' } as const

/** The most positions the solver may look at: enough to prove most last-layer cases, still quick. */
const BUDGET = 1_500_000

const cellOf = (kind: Arrow['kind'], s: number) => (kind === 'corner' ? CORNER_CELL[s] : EDGE_CELL[s])

/** A curved arrow between two cells, pulled in from both ends so the heads stay visible. */
function curve(kind: Arrow['kind'], from: number, to: number, bend: number) {
  const a = centreOf(...cellOf(kind, from))
  const b = centreOf(...cellOf(kind, to))
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const inset = 18
  const s = { x: a.x + ux * inset, y: a.y + uy * inset }
  const e = { x: b.x - ux * inset, y: b.y - uy * inset }
  // Bend to one side, so a swap's two directions and crossing diagonals stay apart.
  const c = { x: (s.x + e.x) / 2 - uy * len * bend, y: (s.y + e.y) / 2 + ux * len * bend }
  return `M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`
}

function describe(h: HomeReport): string {
  const corners = h.loops.filter((l) => l.kind === 'corner')
  const edges = h.loops.filter((l) => l.kind === 'edge')
  const part = (name: string, loops: Loop[]) =>
    loops.length === 0 ? `${name} all home` : `${name}: ${loops.map(loopText).join(', ')}`
  return `Top layer from above, arrows from where each piece sits to where it belongs. ${part('Corners', corners)}. ${part('Edges', edges)}.`
}

function Drawing({ h }: { h: HomeReport }) {
  const paths: { d: string; kind: Arrow['kind']; both: boolean }[] = []
  for (const l of h.loops) {
    if (l.slots.length === 2 && !l.open) {
      paths.push({ d: curve(l.kind, l.slots[0], l.slots[1], 0.12), kind: l.kind, both: true })
      continue
    }
    const ring = l.open ? l.slots.slice(0, -1) : l.slots
    ring.forEach((s, i) => {
      const to = l.slots[(i + 1) % l.slots.length]
      paths.push({ d: curve(l.kind, s, to, 0.18), kind: l.kind, both: false })
    })
  }
  const cells: { r: number; c: number; name: string; home: boolean }[] = []
  CORNER_CELL.forEach(([r, c], s) => {
    cells.push({ r, c, name: CORNER_LABELS[s], home: h.homeCorners.includes(s) })
  })
  EDGE_CELL.forEach(([r, c], s) => {
    cells.push({ r, c, name: EDGE_LABELS[s], home: h.homeEdges.includes(s) })
  })
  return (
    <TopFrame label={describe(h)}>
      <defs>
        {(['corner', 'edge'] as const).map((k) => (
          <marker
            key={k}
            id={`home-head-${k}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" style={{ fill: COLOUR[k] }} />
          </marker>
        ))}
      </defs>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => {
          const cell = cells.find((x) => x.r === r && x.c === c)
          const p = centreOf(r, c)
          return (
            <rect
              key={`${r}${c}`}
              x={p.x - 29}
              y={p.y - 29}
              width="58"
              height="58"
              rx="8"
              class={cell?.home ? 'hm-cell hm-cell-home' : 'hm-cell'}
            />
          )
        }),
      )}
      {cells.map((x) => {
        const p = centreOf(x.r, x.c)
        return (
          <text
            key={x.name}
            x={p.x}
            y={x.r === 2 ? p.y + 23 : p.y - 16}
            text-anchor="middle"
            font-size="10"
            class={x.home ? 'hm-label hm-label-home' : 'hm-label'}
          >
            {x.name}
            {x.home ? ' ✓' : ''}
          </text>
        )
      })}
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke-width="3.5"
          stroke-linecap="round"
          style={{ stroke: COLOUR[p.kind] }}
          marker-end={`url(#home-head-${p.kind})`}
          marker-start={p.both ? `url(#home-head-${p.kind})` : undefined}
        />
      ))}
    </TopFrame>
  )
}

type Solution =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'done'; moves: string[]; proven: boolean }
  | { state: 'error'; message: string }

/** Solves the position with the app's 3×3 engine, in its worker, loaded only when this lens asks. */
function useSolution(moves: string[] | null, solved: boolean): Solution {
  const key = moves ? moves.join(' ') : null
  const [result, setResult] = useState<{ key: string | null; sol: Solution }>({ key: null, sol: { state: 'idle' } })
  useEffect(() => {
    if (key === null || solved) return
    let live = true
    const timer = setTimeout(() => {
      setResult({ key, sol: { state: 'working' } })
      import('../../solver3/client.ts')
        .then(({ solve3Remote }) => solve3Remote(key === '' ? [] : key.split(' '), BUDGET))
        .then((r) => {
          if (live) setResult({ key, sol: { state: 'done', moves: r.solution, proven: r.status === 'proven' } })
        })
        .catch((e: unknown) => {
          if (live) setResult({ key, sol: { state: 'error', message: e instanceof Error ? e.message : String(e) } })
        })
    }, 350)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [key, solved])
  if (key === null || solved) return { state: 'idle' }
  return result.key === key ? result.sol : { state: 'working' }
}

const pretty = (moves: string[]) => moves.join(' ').replace(/'/g, '′')

function SolutionCard({ moves, solved }: { moves: string[] | null; solved: boolean }) {
  const sol = useSolution(moves, solved)
  if (solved) return null
  if (moves === null)
    return (
      <div class="solve-card">
        <p class="solve-text solve-muted">
          A solution needs a position made of face turns only (no slices or rotations).
        </p>
      </div>
    )
  return (
    <div class="solve-card solve-card-accent" aria-live="polite">
      {sol.state === 'done' ? (
        <>
          <div class="hm-sol-head">
            <span class="solve-eyebrow hm-accent">{sol.proven ? 'Shortest, proven' : 'A solution'}</span>
            <span class="solve-eyebrow" data-testid="home-length">
              {sol.moves.length} {sol.moves.length === 1 ? 'move' : 'moves'}
            </span>
          </div>
          <span class="hm-moves" data-testid="home-solution">
            {pretty(sol.moves)}
          </span>
          <button
            type="button"
            class="solve-btn solve-btn-primary"
            disabled={locked.value}
            onClick={() => playSequence(sol.moves)}
          >
            Play it on the cube
          </button>
        </>
      ) : sol.state === 'error' ? (
        <p class="solve-text solve-muted">The solver could not finish: {sol.message}</p>
      ) : (
        <p class="solve-text solve-muted">Finding a short solution…</p>
      )}
    </div>
  )
}

/** Where each top-layer piece belongs, and a short solution of the whole position. */
export function HomeLens() {
  const pos = usePosition()
  if (!pos?.centresHome) return <PositionNote pos={pos} />
  const h = homeOf(pos.cube)
  const corners = h.loops.filter((l) => l.kind === 'corner')
  const edges = h.loops.filter((l) => l.kind === 'edge')
  const homeNames = [...h.homeCorners.map((s) => CORNER_LABELS[s]), ...h.homeEdges.map((s) => EDGE_LABELS[s])]
  const solved = isSolved(pos.cube)
  return (
    <div class="solve-lens">
      <div class="solve-banner">
        <span>Arrow = from where it sits to where it belongs</span>
      </div>
      {!h.lowerSolved && (
        <p class="solve-text solve-muted" data-testid="home-lower">
          Home works on the last layer: the two lower layers are not solved yet
          {h.below > 0 ? `, and ${h.below} top ${h.below === 1 ? 'piece is' : 'pieces are'} still down there` : ''}.
          Here is the top layer anyway.
        </p>
      )}
      <Drawing h={h} />
      <div class="solve-card">
        <div class="hm-line">
          <span class="hm-swatch hm-swatch-corner" />
          <span data-testid="home-corners">
            Corners: {loopsSummary(corners)}
            {corners.length > 0 && (
              <>
                , <span class="solve-mono">{corners.map(loopText).join(' and ')}</span>
              </>
            )}
          </span>
        </div>
        <div class="hm-line">
          <span class="hm-swatch hm-swatch-edge" />
          <span data-testid="home-edges">
            Edges: {loopsSummary(edges)}
            {edges.length > 0 && (
              <>
                , <span class="solve-mono">{edges.map(loopText).join(' and ')}</span>
              </>
            )}
          </span>
        </div>
        <div class="hm-line">
          <span class="hm-swatch hm-swatch-home" />
          <span>
            Already home:{' '}
            {homeNames.length > 0 ? <span class="solve-mono">{homeNames.join(' ')}</span> : 'no top piece'}
            {h.lowerSolved ? ' and both lower layers' : ''}
          </span>
        </div>
        <p class="solve-text solve-muted">Solving is undoing loops. Short loops, few loops: you are close.</p>
      </div>
      <SolutionCard moves={pos.faceMoves} solved={solved} />
    </div>
  )
}
