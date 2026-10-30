import { useState } from 'preact/hooks'
import { EXAMPLE, RING_COUNTS, TOTAL_POSITIONS } from '../solver/report.ts'
import { FLOOR_TABLE } from './data.ts'

const fmt = (n: number) => n.toLocaleString('en-US')

/** Share of all positions, with enough digits to say something about the small rings. */
export function share(n: number) {
  const p = (n / TOTAL_POSITIONS) * 100
  return p >= 1 ? `${p.toFixed(1)}%` : p >= 0.01 ? `${p.toFixed(2)}%` : 'under 0.01%'
}

// ---------------- Hover and focus readout ----------------

type Tip = { key: string; x: number; y: number; value: string; label: string }

/** Hovering a mark or focusing it with the keyboard shows the same readout. */
function useTip() {
  const [tip, setTip] = useState<Tip | null>(null)
  const bind = (t: Tip) => ({
    onPointerEnter: () => setTip(t),
    onPointerLeave: () => setTip(null),
    onFocus: () => setTip(t),
    onBlur: () => setTip(null),
  })
  return { tip, bind }
}

/** The readout, placed over the chart in viewBox units: value first, then what it is. */
function ChartTip({ tip, width, height }: { tip: Tip | null; width: number; height: number }) {
  if (!tip) return null
  const side = tip.x < width * 0.22 ? 'start' : tip.x > width * 0.78 ? 'end' : 'middle'
  return (
    <div
      class={`chart-tip ${side}`}
      style={{ left: `${(tip.x / width) * 100}%`, top: `${(tip.y / height) * 100}%` }}
      aria-hidden="true"
    >
      <b>{tip.value}</b>
      <span>{tip.label}</span>
    </div>
  )
}

function Arrowhead({ id }: { id: string }) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path class="dia-head" d="M0 0L10 5L0 10z" />
      </marker>
    </defs>
  )
}

// ---------------- Figure 1: positions at each distance ----------------

const DW = 420
const DH = 250
const DM = { l: 46, r: 8, t: 22, b: 38 }
const D_MAX = 2_000_000
const D_TICKS = [0, 500_000, 1_000_000, 1_500_000, 2_000_000]
const compact = (n: number) => (n === 0 ? '0' : n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1_000}K`)

/** A column with a rounded data end and a square base. */
function column(x: number, w: number, top: number, base: number) {
  const h = base - top
  if (h < 0.05) return ''
  const r = Math.min(4, h, w / 2)
  return `M${x} ${base}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + w - r}Q${x + w} ${top} ${x + w} ${top + r}V${base}Z`
}

export function DistanceChart() {
  const { tip, bind } = useTip()
  const plotW = DW - DM.l - DM.r
  const plotH = DH - DM.t - DM.b
  const base = DM.t + plotH
  const band = plotW / RING_COUNTS.length
  const barW = Math.min(22, band - 4)
  const y = (v: number) => DM.t + plotH * (1 - v / D_MAX)
  return (
    <div class="chart-box">
      <svg viewBox={`0 0 ${DW} ${DH}`}>
        <title>Positions at each distance from solved, 0 to 11 moves</title>
        {D_TICKS.map((t) => (
          <g key={t}>
            <line class="chart-grid" x1={DM.l} x2={DW - DM.r} y1={y(t)} y2={y(t)} />
            <text class="chart-tick" x={DM.l - 6} y={y(t) + 4} text-anchor="end">
              {compact(t)}
            </text>
          </g>
        ))}
        <line class="chart-axis" x1={DM.l} x2={DW - DM.r} y1={base} y2={base} />
        {RING_COUNTS.map((count, d) => {
          const cx = DM.l + band * (d + 0.5)
          const top = y(count)
          const t: Tip = {
            key: String(d),
            x: cx,
            y: Math.min(top, base - 2) - (d >= 9 ? 12 : 0),
            value: `${fmt(count)} positions`,
            label: `${d} ${d === 1 ? 'move' : 'moves'} from solved · ${share(count)}`,
          }
          return (
            <g key={d}>
              <path
                class={d === 9 || d === 10 ? 'chart-bar rim' : 'chart-bar'}
                d={column(cx - barW / 2, barW, top, base)}
              />
              {d >= 9 && (
                <text class="chart-value" x={cx} y={Math.min(top, base) - 6} text-anchor="middle">
                  {fmt(count)}
                </text>
              )}
              <text class="chart-tick" x={cx} y={base + 16} text-anchor="middle">
                {d}
              </text>
              <rect
                class={tip?.key === t.key ? 'chart-hit on' : 'chart-hit'}
                x={cx - band / 2}
                y={DM.t}
                width={band}
                height={plotH}
                tabIndex={0}
                aria-label={`${d} moves: ${fmt(count)} positions, ${share(count)}`}
                {...bind(t)}
              />
            </g>
          )
        })}
        <text class="chart-title" x={DM.l + plotW / 2} y={DH - 4} text-anchor="middle">
          Moves from solved
        </text>
      </svg>
      <ChartTip tip={tip} width={DW} height={DH} />
    </div>
  )
}

export function DistanceTable() {
  return (
    <details class="table-twin">
      <summary>Show the counts as a table</summary>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Moves</th>
              <th scope="col" class="num">
                Positions
              </th>
              <th scope="col" class="num">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {RING_COUNTS.map((count, d) => (
              <tr key={d}>
                <td>{d}</td>
                <td class="num">{fmt(count)}</td>
                <td class="num">{share(count)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>All</td>
              <td class="num">{fmt(TOTAL_POSITIONS)}</td>
              <td class="num">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  )
}

// ---------------- Figure 2: floor, ceiling and the gap ----------------

const FW = 420
const FH = 214
const fx = (moves: number) => 20 + moves * (380 / 14)

function Track({ y, floor, ceiling }: { y: number; floor: number; ceiling: number }) {
  const c = fx(ceiling)
  return (
    <g>
      <rect class="dia-track" x={fx(0)} y={y} width={fx(14) - fx(0)} height={12} rx={6} />
      {ceiling > floor && <rect class="dia-gap" x={fx(floor)} y={y} width={c - fx(floor)} height={12} />}
      <path
        class="dia-floor"
        d={`M${fx(0) + 6} ${y}H${fx(floor)}V${y + 12}H${fx(0) + 6}A6 6 0 0 1 ${fx(0) + 6} ${y}Z`}
      />
      <line class="dia-mark" x1={c} x2={c} y1={y - 6} y2={y + 18} />
      <path class="dia-head" d={`M${c - 6} ${y - 14}H${c + 6}L${c} ${y - 6}Z`} />
    </g>
  )
}

export function FrameworkFigure() {
  return (
    <svg
      class="dia"
      viewBox={`0 0 ${FW} ${FH}`}
      role="img"
      aria-label="Two number lines. While searching, the floor is at 7 moves and a solution of 12 moves is in hand, so the shortest solution is somewhere from 7 to 12. When the floor reaches 11 and an 11-move solution is in hand, the shortest solution is proven to have 11 moves."
    >
      <text class="dia-text strong" x={20} y={16}>
        While searching
      </text>
      <text class="dia-note" x={(fx(7) + fx(12)) / 2 - 8} y={34} text-anchor="middle">
        the answer is in here
      </text>
      <Track y={44} floor={7} ceiling={12} />
      <text class="dia-text" x={fx(7)} y={76} text-anchor="middle">
        floor 7
      </text>
      <text class="dia-text" x={fx(12)} y={76} text-anchor="middle">
        ceiling 12
      </text>

      <text class="dia-text strong" x={20} y={112}>
        Proven
      </text>
      <Track y={130} floor={11} ceiling={11} />
      <text class="dia-text" x={fx(11)} y={162} text-anchor="middle">
        floor = ceiling = 11
      </text>
      <line class="chart-axis" x1={fx(0)} x2={fx(14)} y1={178} y2={178} />
      {[0, 2, 4, 6, 8, 10, 12, 14].map((m) => (
        <g key={m}>
          <line class="chart-axis" x1={fx(m)} x2={fx(m)} y1={178} y2={182} />
          <text class="chart-tick" x={fx(m)} y={195} text-anchor="middle">
            {m}
          </text>
        </g>
      ))}
      <text class="chart-title" x={fx(7)} y={211} text-anchor="middle">
        Moves
      </text>
    </svg>
  )
}

// ---------------- Figure 3: a solution casts a shadow ----------------

const SX = [44, 128, 212, 300, 384]

/** Move labels m1, m2, …, mk, with the index as a subscript. */
const EDGE_LABELS = [
  ['m', '1'],
  ['m', '2'],
  ['…', ''],
  ['m', 'k'],
]

function Row({ y, first, edgeY, marker }: { y: number; first: string; edgeY: number; marker: string }) {
  return (
    <g>
      {SX.slice(0, -1).map((x, i) => (
        <g key={x}>
          <line
            class={i === 2 ? 'dia-edge faint' : 'dia-edge'}
            x1={x + (i === 0 ? 17 : 7)}
            x2={SX[i + 1] - (i === 3 ? 19 : 9)}
            y1={y}
            y2={y}
            marker-end={i === 2 ? undefined : `url(#${marker})`}
          />
          <text class="dia-text math" x={(x + SX[i + 1]) / 2} y={edgeY} text-anchor="middle">
            {EDGE_LABELS[i][0]}
            {EDGE_LABELS[i][1] && (
              <tspan class="dia-sub" dy={3}>
                {EDGE_LABELS[i][1]}
              </tspan>
            )}
          </text>
        </g>
      ))}
      <circle class="dia-node" cx={SX[0]} cy={y} r={16} />
      <text class="dia-text math" x={SX[0]} y={y + 4} text-anchor="middle">
        {first}
      </text>
      {SX.slice(1, -1).map((x) => (
        <circle key={x} class="dia-dot" cx={x} cy={y} r={4} />
      ))}
      <circle class="dia-node goal" cx={SX[4]} cy={y} r={12} />
    </g>
  )
}

export function ShadowFigure() {
  return (
    <svg
      class="dia"
      viewBox="0 0 420 200"
      role="img"
      aria-label="Top row: the cube goes from position x to solved in k moves. Bottom row: its shadow in the twist puzzle goes from the shadow of x to solved with the same k moves. Arrows down from each end show the filter that keeps only the twists."
    >
      <Arrowhead id="paper-arrow-shadow" />
      <text class="dia-text strong" x={20} y={18}>
        The cube: a solution with k moves
      </text>
      <text class="dia-note" x={SX[4]} y={34} text-anchor="middle">
        solved
      </text>
      <Row y={58} first="x" edgeY={50} marker="paper-arrow-shadow" />
      {[SX[0], SX[4]].map((x) => (
        <line
          key={x}
          class="dia-map"
          x1={x}
          x2={x}
          y1={x === SX[0] ? 76 : 72}
          y2={x === SX[0] ? 130 : 134}
          marker-end="url(#paper-arrow-shadow)"
        />
      ))}
      <text class="dia-note" x={212} y={100} text-anchor="middle">
        φ: forget where corners are,
      </text>
      <text class="dia-note" x={212} y={114} text-anchor="middle">
        keep only their twists
      </text>
      <Row y={150} first="φ(x)" edgeY={142} marker="paper-arrow-shadow" />
      <text class="dia-note" x={SX[4]} y={178} text-anchor="middle">
        solved
      </text>
      <text class="dia-text strong" x={20} y={192}>
        Its shadow: the same k moves solve it
      </text>
    </svg>
  )
}

// ---------------- Figure 4: work against floor strength ----------------

const SW = 420
const SH = 300
const SM = { l: 50, r: 12, t: 30, b: 42 }
const X0 = 4
const X1 = 8.5
const LOG0 = 2
const LOG1 = 6
const Y_TICKS = [100, 1_000, 10_000, 100_000, 1_000_000]
const yTick = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1_000 ? `${n / 1_000}K` : String(n))
/** Where each point's name sits: right of it, or up and right where the dashed line runs below. */
const PLACE: Record<string, { dx: number; dy: number }> = {
  'Twists only': { dx: 8, dy: 4 },
  'Places only': { dx: 8, dy: 4 },
}

export function WorkScatter() {
  const { tip, bind } = useTip()
  const plotW = SW - SM.l - SM.r
  const plotH = SH - SM.t - SM.b
  const sx = (v: number) => SM.l + ((v - X0) / (X1 - X0)) * plotW
  const sy = (n: number) => SM.t + ((LOG1 - Math.log10(n)) / (LOG1 - LOG0)) * plotH
  const points = FLOOR_TABLE.flatMap((f) =>
    f.plot && f.mean !== null && f.nodes !== null ? [{ ...f, plot: f.plot, mean: f.mean, nodes: f.nodes }] : [],
  )
  // Reference line: five times less work per extra move of floor, through the strongest tables.
  const anchor = points[points.length - 1]
  const ref = (x: number) => anchor.nodes * 5 ** (anchor.mean - x)
  const xEnd = anchor.mean + Math.log(anchor.nodes / 10 ** LOG0) / Math.log(5)
  const legendX = SW - SM.r - 150
  return (
    <div class="chart-box">
      <svg viewBox={`0 0 ${SW} ${SH}`}>
        <title>Positions checked per solve against the average floor, for six floors</title>
        <text class="chart-title" x={0} y={12}>
          Positions checked per solve (log scale)
        </text>
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line class="chart-grid" x1={SM.l} x2={SW - SM.r} y1={sy(t)} y2={sy(t)} />
            <text class="chart-tick" x={SM.l - 6} y={sy(t) + 4} text-anchor="end">
              {yTick(t)}
            </text>
          </g>
        ))}
        <line class="chart-axis" x1={SM.l} x2={SW - SM.r} y1={SM.t + plotH} y2={SM.t + plotH} />
        {[4, 5, 6, 7, 8].map((v) => (
          <text key={v} class="chart-tick" x={sx(v)} y={SM.t + plotH + 16} text-anchor="middle">
            {v}
          </text>
        ))}
        <text class="chart-title" x={SM.l + plotW / 2} y={SH - 6} text-anchor="middle">
          Average floor (moves)
        </text>
        <line class="chart-ref" x1={sx(X0)} y1={sy(ref(X0))} x2={sx(xEnd)} y2={sy(10 ** LOG0)} />
        <line class="chart-ref" x1={legendX} x2={legendX + 22} y1={SM.t + 10} y2={SM.t + 10} />
        <text class="chart-note" x={legendX + 28} y={SM.t + 14}>
          5× less work per move
        </text>
        {points.map((p) => {
          const x = sx(p.mean)
          const y = sy(p.nodes)
          const at = PLACE[p.plot] ?? { dx: 7, dy: -9 }
          const t: Tip = {
            key: p.plot,
            x,
            y,
            value: `${fmt(p.nodes)} positions per solve`,
            label: `${p.name}, ${p.memory} · average floor ${p.mean}`,
          }
          return (
            <g key={p.plot}>
              <circle class="chart-dot" cx={x} cy={y} r={4.5} />
              <text class="chart-value" x={x + at.dx} y={y + at.dy}>
                {p.plot}
              </text>
              <circle
                class={tip?.key === t.key ? 'chart-hit on' : 'chart-hit'}
                cx={x}
                cy={y}
                r={12}
                tabIndex={0}
                aria-label={`${p.name}, ${p.memory}: average floor ${p.mean}, ${fmt(p.nodes)} positions per solve`}
                {...bind(t)}
              />
            </g>
          )
        })}
      </svg>
      <ChartTip tip={tip} width={SW} height={SH} />
    </div>
  )
}

// ---------------- Figure 5: one position, three floors ----------------

const EXAMPLE_FLOORS = [
  { name: 'Weak', start: EXAMPLE.weak.floorAtStart, nodes: EXAMPLE.weak.nodes },
  { name: 'Medium', start: EXAMPLE.floorAtStart, nodes: EXAMPLE.rounds.reduce((a, r) => a + r.nodes, 0) },
  { name: 'Strong', start: EXAMPLE.strong.floorAtStart, nodes: EXAMPLE.strong.nodes },
]

export function ExampleFloors() {
  const most = Math.log10(Math.max(...EXAMPLE_FLOORS.map((f) => f.nodes)))
  return (
    <ul class="work">
      {EXAMPLE_FLOORS.map((f) => (
        <li key={f.name}>
          <span>
            <b>{f.name} floor</b> <span class="muted">· starts at {f.start}</span>
          </span>
          <span class="work-num">{fmt(f.nodes)}</span>
          <span class="work-bar" style={{ width: `${(Math.log10(f.nodes) / most) * 100}%` }} />
        </li>
      ))}
    </ul>
  )
}

// ---------------- Figure 6: two landscapes ----------------

const curve = (x0: number, height: (u: number) => number) =>
  Array.from({ length: 61 }, (_, i) => {
    const u = i / 60
    return `${i ? 'L' : 'M'}${(x0 + u * 182).toFixed(1)} ${height(u).toFixed(1)}`
  }).join('')

const funnel = (u: number) => 36 + 110 * (1 - (2 * u - 1) ** 2)
const bumpy = (u: number) =>
  36 + 110 * (0.5 * Math.exp(-(((u - 0.28) / 0.09) ** 2)) + Math.exp(-(((u - 0.72) / 0.11) ** 2)))

export function LandscapeFigure() {
  const L = 14
  const R = 226
  const at = (x0: number, u: number) => x0 + u * 182
  const roll = Array.from({ length: 11 }, (_, i) => {
    const u = 0.24 + (i / 10) * 0.2
    return `${i ? 'L' : 'M'}${at(L, u).toFixed(1)} ${(funnel(u) - 14).toFixed(1)}`
  }).join('')
  return (
    <svg
      class="dia"
      viewBox="0 0 420 180"
      role="img"
      aria-label="Left: the true distance is a smooth funnel with one bottom, and a ball rolls down to solved. Right: an estimate has a false valley part of the way down, where the ball stops; the real bottom, solved, is elsewhere."
    >
      <Arrowhead id="paper-arrow-roll" />
      <text class="dia-text strong" x={L} y={16}>
        True distance
      </text>
      <path class="dia-curve" d={curve(L, funnel)} />
      <circle class="dia-ball" cx={at(L, 0.18)} cy={funnel(0.18) - 8} r={7} />
      <path class="dia-edge" d={roll} marker-end="url(#paper-arrow-roll)" />
      <circle class="dia-node goal" cx={at(L, 0.5)} cy={funnel(0.5)} r={5} />
      <text class="dia-note" x={at(L, 0.5)} y={166} text-anchor="middle">
        solved
      </text>

      <text class="dia-text strong" x={R} y={16}>
        An estimate
      </text>
      <path class="dia-curve" d={curve(R, bumpy)} />
      <circle class="dia-ball" cx={at(R, 0.28)} cy={bumpy(0.28) - 8} r={7} />
      <text class="dia-note" x={at(R, 0.28)} y={112} text-anchor="middle">
        stuck: no way down
      </text>
      <circle class="dia-node goal" cx={at(R, 0.72)} cy={bumpy(0.72)} r={5} />
      <text class="dia-note" x={at(R, 0.72)} y={166} text-anchor="middle">
        solved
      </text>
    </svg>
  )
}
