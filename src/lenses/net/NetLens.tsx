import '../common.css'
import './net.css'
import { orderOf } from '../../engine/order.ts'
import { LensHead, LensNote, LensStat, plural, pretty, useSequence } from '../common.tsx'
import { type Face, type Facelet, facelets, movedCount, NET_FACES } from './facelets.ts'

/** Where each face sits on the net, in 3×3 blocks: U on top, L F R B across, D below. */
const FACE_AT: Record<Face, [number, number]> = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] }

const PITCH = 26
const SIZE = 23
const PAD = 6
const W = 12 * PITCH + 2 * PAD
const H = 9 * PITCH + 2 * PAD

type Box = { x: number; y: number; w: number; h: number }

const cellX = (f: Facelet) => PAD + (FACE_AT[f.face][0] * 3 + f.col) * PITCH
const cellY = (f: Facelet) => PAD + (FACE_AT[f.face][1] * 3 + f.row) * PITCH

/**
 * Outlines for the stickers that changed colour: a whole row or column of a face as one strip
 * where it can, single stickers otherwise.
 */
export function outlines(cells: Facelet[], changed: boolean[]): Box[] {
  const boxes: Box[] = []
  const covered = new Set<number>()
  for (const face of NET_FACES) {
    const base = NET_FACES.indexOf(face) * 9
    const lines = [0, 1, 2].flatMap((k) => [
      [0, 1, 2].map((c) => base + k * 3 + c),
      [0, 1, 2].map((r) => base + r * 3 + k),
    ])
    for (const line of lines) {
      if (!line.every((i) => changed[i] && !covered.has(i))) continue
      for (const i of line) covered.add(i)
      const first = cells[line[0]]
      const last = cells[line[2]]
      boxes.push({ x: cellX(first), y: cellY(first), w: cellX(last) - cellX(first), h: cellY(last) - cellY(first) })
    }
  }
  cells.forEach((f, i) => {
    if (changed[i] && !covered.has(i)) boxes.push({ x: cellX(f), y: cellY(f), w: 0, h: 0 })
  })
  return boxes
}

export function NetLens() {
  const input = useSequence()
  if (!input.ok) return <LensNote>{input.message}</LensNote>
  const { kp, moves, text } = input
  const cells = facelets(kp.defaultPattern().applyAlg(text))
  const changed = cells.map((f) => f.color !== f.face)
  const moved = movedCount(cells)
  const recoloured = changed.filter(Boolean).length
  const order = orderOf(kp, text)
  const seq = pretty(text)
  const one = moves.length === 1 ? `One ${seq}` : seq
  const label =
    moved === 0
      ? `The cube unfolded flat after ${seq}: every sticker is back where it started.`
      : `The cube unfolded flat after ${seq}, applied to a solved cube. ${plural(recoloured, 'sticker')} changed colour and are outlined.`

  return (
    <div class="lens-see">
      <LensHead text={seq} tag={`Order ${order}`} />
      <svg class="lens-drawing net" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {cells.map((f) => (
          <rect
            key={`${f.face}${f.row}${f.col}`}
            class={`net-sticker face-${f.color}`}
            x={cellX(f) + (PITCH - SIZE) / 2}
            y={cellY(f) + (PITCH - SIZE) / 2}
            width={SIZE}
            height={SIZE}
            rx={4}
          />
        ))}
        {NET_FACES.map((face) => {
          const x = PAD + (FACE_AT[face][0] * 3 + 1.5) * PITCH
          const y = PAD + (FACE_AT[face][1] * 3 + 1.5) * PITCH
          return (
            <g key={face}>
              <circle class="net-letter-disc" cx={x} cy={y} r={7.5} />
              <text class="net-letter" x={x} y={y}>
                {face}
              </text>
            </g>
          )
        })}
        {outlines(cells, changed).map((b) => (
          <rect
            key={`${b.x},${b.y},${b.w},${b.h}`}
            class="net-outline"
            x={b.x + 0.5}
            y={b.y + 0.5}
            width={b.w + PITCH - 1}
            height={b.h + PITCH - 1}
            rx={5}
          />
        ))}
      </svg>
      <div class="card lens-card">
        <p>
          Unfold the cube flat and nothing is hidden.{' '}
          {moved === 0
            ? `${seq} puts every sticker back where it started.`
            : `${one} moves ${plural(moved, 'sticker')}. The outlined ones show a new colour` +
              (moved > recoloured
                ? `; the other ${moved - recoloured} moved but kept their colour, turning within their own face.`
                : '.')}
        </p>
        <div class="lens-stats">
          <LensStat value={`${moved}`} label="stickers move" tone="alone" />
          <LensStat value={`${54 - moved}`} label="stay where they are" />
          <LensStat value={`${order}`} label={order === 1 ? 'turn to come back' : 'turns to come back'} />
        </div>
        <p class="lens-foot">BEST FOR · seeing every face at once</p>
      </div>
    </div>
  )
}
