import './top.css'
import { PositionNote } from '../LensNote.tsx'
import { usePosition } from '../position.ts'
import { activeLens } from '../state.ts'
import { CELL, cellAt, GAP, STRIP, TopFrame, X0, Y0 } from './TopFace.tsx'
import { topCase, topView, twists } from './top.ts'

const ON = 'var(--ink)'
const OFF = 'var(--line)'

const fill = (on: boolean) => (on ? ON : OFF)

function describe(grid: boolean[][], sides: boolean[]): string {
  const up = grid.flat().filter(Boolean).length
  const side = sides.filter(Boolean).length
  if (up === 9) return 'Top layer from above with only the top colour shown: the whole top is one colour.'
  return `Top layer from above with only the top colour shown: ${up} of 9 top stickers show it, and ${side} side ${side === 1 ? 'sticker shows' : 'stickers show'} it instead.`
}

const signed = (t: number) => (t === 0 ? '0' : `+${t}`)

/** The top layer from above, with only the top colour shown, and the corner twists. */
export function TopLens() {
  const pos = usePosition()
  if (!pos?.centresHome) return <PositionNote pos={pos} />
  const v = topView(pos.cube)
  const t = twists(pos.cube)
  const named = topCase(pos.cube)
  const span = CELL * 3 + GAP * 2
  const strips = [
    ...v.back.map((on, i) => ({ on, x: cellAt(0, i).x, y: Y0 - STRIP - 7, w: CELL, h: STRIP })),
    ...v.front.map((on, i) => ({ on, x: cellAt(0, i).x, y: Y0 + span + 7, w: CELL, h: STRIP })),
    ...v.left.map((on, i) => ({ on, x: X0 - STRIP - 7, y: cellAt(i, 0).y, w: STRIP, h: CELL })),
    ...v.right.map((on, i) => ({ on, x: X0 + span + 7, y: cellAt(i, 0).y, w: STRIP, h: CELL })),
  ]
  return (
    <div class="solve-lens">
      <div class="solve-banner">
        <span>Only the top colour is shown</span>
        {named && (
          <span class="solve-tag" data-testid="top-case">
            Case · {named.name}
            {` (${named.nick})`}
          </span>
        )}
      </div>
      <TopFrame label={describe(v.grid, [...v.back, ...v.front, ...v.left, ...v.right])}>
        {v.grid.map((row, r) =>
          row.map((on, c) => {
            const p = cellAt(r, c)
            return (
              <rect key={`${r}${c}`} x={p.x} y={p.y} width={CELL} height={CELL} rx="8" style={{ fill: fill(on) }} />
            )
          }),
        )}
        {strips.map((s, i) => (
          <rect key={`s${i}`} x={s.x} y={s.y} width={s.w} height={s.h} rx="4" style={{ fill: fill(s.on) }} />
        ))}
      </TopFrame>
      <div class="solve-card">
        <div class="solve-eyebrow">Corner twists</div>
        <div class="tp-twists" data-testid="top-twists">
          {t.top.map((x) => (
            <div class="tp-tw" key={x.slot}>
              <b class={x.twist === 0 ? 'tp-zero' : 'tp-on'}>{signed(x.twist)}</b>
              <span>{x.slot}</span>
            </div>
          ))}
          {t.rest !== 0 && (
            <div class="tp-tw">
              <b class="tp-on">{signed(t.rest)}</b>
              <span>bottom</span>
            </div>
          )}
          <div class="tp-tw tp-sum">
            <b data-testid="top-sum">= {t.sum}</b>
            <span>÷ 3 ✓</span>
          </div>
        </div>
        <p class="solve-text">
          Hide every colour but one and the job becomes a single picture: make the top square one colour. Twists always
          add up to a multiple of 3, so one lone twisted corner can never happen.
        </p>
        <button
          type="button"
          class="solve-btn"
          onClick={() => {
            activeLens.value = 'home'
          }}
        >
          Where does each piece belong?
        </button>
      </div>
    </div>
  )
}
