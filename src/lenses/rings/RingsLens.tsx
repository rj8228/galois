import '../common.css'
import './rings.css'
import { analyse } from '../../engine/analysis.ts'
import type { OrbitName } from '../../engine/pieces.ts'
import { LensHead, LensNote, LensStat, pretty, useSequence } from '../common.tsx'
import { Arrowheads, arcPath, at, CX, CY, chordPath, loopPath } from '../ringDraw.tsx'
import { orderFormula, orderTerms, type RingNode, ringLayout } from './rings.ts'

const OUTER = 140
const INNER = 92
const NODE = 15
const TONE: Record<OrbitName, string> = { EDGES: 'edge', CORNERS: 'corner', CENTERS: 'corner' }

function Ring({ nodes, r, tone }: { nodes: RingNode[]; r: number; tone: string }) {
  const arrows: string[] = []
  const cycles = new Map<number, RingNode[]>()
  for (const n of nodes) if (n.cycle !== null) cycles.set(n.cycle, [...(cycles.get(n.cycle) ?? []), n])
  for (const loop of cycles.values()) {
    loop.forEach((n, i) => {
      const next = loop[(i + 1) % loop.length]
      const closing = i === loop.length - 1
      // A loop that fills the whole ring closes along the ring; otherwise it closes with a chord.
      arrows.push(
        closing && loop.length < nodes.length
          ? chordPath(at(r, n.angle), at(r, next.angle), NODE + 2)
          : arcPath(r, n.angle, next.angle, NODE + 2),
      )
    })
  }
  return (
    <g>
      <circle class="ring-track" cx={CX} cy={CY} r={r} />
      {arrows.map((d) => (
        <path key={d} class={`ring-arrow stroke-${tone}`} d={d} marker-end={`url(#rings-${tone})`} />
      ))}
      {nodes.map((n) => {
        const p = at(r, n.angle)
        const state = n.cycle !== null ? `moving stroke-${tone}` : n.twist ? 'alone' : 'still'
        return (
          <g key={n.name} class={`ring-node ${state}`}>
            {n.twist !== 0 && <path class="ring-loop" d={loopPath(p, n.angle, NODE)} marker-end="url(#rings-alone)" />}
            <circle cx={p.x} cy={p.y} r={NODE} />
            <text x={p.x} y={p.y}>
              {n.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function RingsLens() {
  const input = useSequence()
  if (!input.ok) return <LensNote>{input.message}</LensNote>
  const { kp, text } = input
  const a = analyse(kp, text)
  const seq = pretty(text)
  const corners = a.orbits.find((o) => o.orbit === 'CORNERS')
  const edges = a.orbits.find((o) => o.orbit === 'EDGES')
  if (!corners || !edges) return null
  const terms = orderTerms(a)
  const describe = (o: typeof corners, noun: string) =>
    o.cycles.length === 0 && o.twistedInPlace.length === 0
      ? `no ${noun} move`
      : [
          ...o.cycles.map(
            (c) => `a ${c.positions.length}-cycle of ${noun}: ${c.positions.map((p) => o.names[p]).join(', ')}`,
          ),
          ...o.twistedInPlace.map((t) => `${o.names[t.position]} turning in place`),
        ].join('; ')
  const label = `Two rings for ${seq}. Outer ring, edges: ${describe(edges, 'edges')}. Inner ring, corners: ${describe(corners, 'corners')}. Grey pieces stay put.`

  return (
    <div class="lens-see">
      <LensHead text={seq} tag={`Order ${a.order}`} />
      <svg class="lens-drawing rings-lens" viewBox="0 0 340 340" role="img" aria-label={label}>
        <Arrowheads prefix="rings" tones={['edge', 'corner', 'alone']} />
        <Ring nodes={ringLayout(edges)} r={OUTER} tone="edge" />
        <Ring nodes={ringLayout(corners)} r={INNER} tone="corner" />
      </svg>
      <div class="card lens-card">
        <p>
          {terms.length === 0
            ? `${seq} moves nothing: every piece stays put.`
            : 'Each ring is laid out in loop order, so one loop of the sequence reads as one arc. Grey pieces stay put.'}
        </p>
        {terms.length > 0 && (
          <div class="lens-stats">
            {terms.map((t) => (
              <LensStat
                key={t.label + t.text}
                value={t.text}
                label={t.label}
                tone={t.label.includes('alone') ? 'alone' : TONE[t.orbit]}
              />
            ))}
          </div>
        )}
        <p class="lens-foot">{orderFormula(a)}</p>
      </div>
    </div>
  )
}
