import '../common.css'
import '../rings/rings.css'
import './path.css'
import { useState } from 'preact/hooks'
import { analyse } from '../../engine/analysis.ts'
import { type OrbitName, type PieceRef, pieceName } from '../../engine/pieces.ts'
import { LensHead, LensNote, LensStat, plural, pretty, useSequence } from '../common.tsx'
import { Arrowheads, arcPath, at, CX, CY, chordPath } from '../ringDraw.tsx'
import { ringLayout } from '../rings/rings.ts'
import { defaultPiece, routeOf } from './path.ts'

const R = 118
const NODE = 20
const NOUN: Record<OrbitName, string> = { CORNERS: 'corner', EDGES: 'edge', CENTERS: 'centre' }

export function PathLens() {
  const input = useSequence()
  const [choice, setChoice] = useState<{ text: string; piece: PieceRef } | null>(null)
  if (!input.ok) return <LensNote>{input.message}</LensNote>
  const { kp, moves, text } = input
  const seq = pretty(text)
  const piece = choice?.text === text ? choice.piece : defaultPiece(kp, moves)
  if (!piece)
    return <LensNote>{`${seq} leaves every corner and edge where it is: there's no path to follow.`}</LensNote>
  const choose = (p: PieceRef) => setChoice({ text, piece: p })

  const route = routeOf(kp, moves, piece)
  const name = pieceName(piece)
  const orbit = analyse(kp, text).orbits.find((o) => o.orbit === piece.orbit)
  if (!orbit) return null
  // The tracked loop first, from the top in the order the piece travels; every other piece after it.
  const onRoute = new Set(route.slots)
  const rest = ringLayout(orbit).filter((n) => !onRoute.has(n.position))
  const order = [...route.slots, ...rest.map((n) => n.position)]
  const n = order.length
  const angleOf = (position: number) => (360 * order.indexOf(position)) / n
  const hops = route.slots.length
  const moves1 = hops > 1
  const turnedWord = piece.orbit === 'EDGES' ? 'flipped' : 'turned'
  const homeLine = route.twist ? `home, but ${turnedWord}` : 'home, straight'
  const turnedBy = piece.orbit === 'EDGES' ? 'flipped' : `turned a third${route.twist === 2 ? ' the other way' : ''}`
  const summary = !moves1
    ? route.twist
      ? `${name} never leaves its slot, but each ${seq} ${piece.orbit === 'EDGES' ? 'flips' : 'twists'} it. ${route.laps} repeats put it back straight.`
      : `${name} stays put: ${seq} never moves it. Tap a piece on the ring to follow it instead.`
    : `Follow one piece while the sequence repeats. It visits ${plural(hops, 'slot')} and lands home ${route.twist ? turnedBy : 'straight'}.` +
      (route.twist ? ` ${route.laps === 3 ? 'Three' : 'Two'} laps put it back straight.` : '')
  const label =
    `${name}'s path while ${seq} repeats: ` +
    (moves1
      ? `${route.slots.map((p) => orbit.names[p]).join(', ')}, then home ${route.twist ? turnedWord : 'straight'}.`
      : route.twist
        ? `it stays in its slot and turns.`
        : 'it never moves.')

  const switchOrbit = (o: OrbitName) => {
    if (o === piece.orbit) return
    const a = analyse(kp, text).orbits.find((x) => x.orbit === o)
    const longest = a?.cycles.reduce<number[] | null>(
      (best, c) => (!best || c.positions.length > best.length ? c.positions : best),
      null,
    )
    choose({ orbit: o, index: longest?.[0] ?? a?.twistedInPlace[0]?.position ?? 0 })
  }

  return (
    <div class="lens-see">
      <LensHead text={`${seq} ↻ repeat`} tag={`Tracking ${name}`} />
      <div class="path-switch" role="group" aria-label="Pieces to follow">
        {(['CORNERS', 'EDGES'] as const).map((o) => (
          <button
            key={o}
            type="button"
            class={o === piece.orbit ? 'lens-chip lens-chip-on' : 'lens-chip'}
            aria-pressed={o === piece.orbit}
            onClick={() => switchOrbit(o)}
          >
            {o === 'CORNERS' ? 'Corners' : 'Edges'}
          </button>
        ))}
      </div>
      <div class="path-figure">
        <svg class="lens-drawing" viewBox="0 0 340 340" role="img" aria-label={label}>
          <Arrowheads prefix="path" tones={['corner']} />
          <circle class="ring-track" cx={CX} cy={CY} r={R} />
          {moves1 &&
            route.slots.map((p, i) => {
              const next = route.slots[(i + 1) % hops]
              const closing = i === hops - 1 && hops < n
              const a1 = angleOf(p)
              const a2 = angleOf(next)
              const d = closing ? chordPath(at(R, a1), at(R, a2), NODE + 2) : arcPath(R, a1, a2, NODE + 2)
              const span = (((a2 - a1) % 360) + 360) % 360 || 360
              const badge = closing
                ? {
                    x: ((at(R, a1).x + at(R, a2).x) / 2) * 0.85 + CX * 0.15,
                    y: ((at(R, a1).y + at(R, a2).y) / 2) * 0.85 + CY * 0.15,
                  }
                : at(R + 30, a1 + span / 2)
              return (
                <g key={`hop${p}`}>
                  <path class="ring-arrow stroke-corner" d={d} marker-end="url(#path-corner)" />
                  <circle class="path-badge" cx={badge.x} cy={badge.y} r={11} />
                  <text class="path-badge-text" x={badge.x} y={badge.y}>
                    {i + 1}
                  </text>
                </g>
              )
            })}
          {order.map((p) => {
            const pt = at(R, angleOf(p))
            const state = p === piece.index ? 'alone' : onRoute.has(p) && moves1 ? 'moving stroke-corner' : 'still'
            return (
              <g key={p} class={`ring-node path-node ${state}`}>
                <circle cx={pt.x} cy={pt.y} r={NODE} />
                <text x={pt.x} y={pt.y}>
                  {orbit.names[p]}
                </text>
              </g>
            )
          })}
          <text class="path-hops" x={CX - 52} y={CY - 16}>
            {moves1 ? `${hops} hops` : 'stays put'}
          </text>
          <text class="path-home" x={CX - 52} y={CY + 10}>
            {moves1 || route.twist ? homeLine : 'never moves'}
          </text>
        </svg>
        {order.map((p) => {
          const pt = at(R, angleOf(p))
          return (
            <button
              key={p}
              type="button"
              class="path-pick"
              style={{ left: `${(pt.x / 340) * 100}%`, top: `${(pt.y / 340) * 100}%` }}
              aria-label={`Follow ${orbit.names[p]}`}
              aria-pressed={p === piece.index}
              onClick={() => choose({ orbit: piece.orbit, index: p })}
            />
          )
        })}
      </div>
      <div class="card lens-card">
        <p>{summary}</p>
        <ol class="path-chips" aria-label={`${name}'s lap`}>
          {route.slots.map((p, i) => (
            <li key={p} class="path-step">
              <span class={i === 0 ? 'path-chip path-chip-home' : 'path-chip'}>{orbit.names[p]}</span>
            </li>
          ))}
          {moves1 && (
            <li class="path-step">
              <span class="path-chip path-chip-home">{name} ↻</span>
            </li>
          )}
        </ol>
        <div class="lens-stats">
          <LensStat value={`${hops}`} label={hops === 1 ? 'slot per lap' : 'slots per lap'} tone="corner" />
          <LensStat
            value={`× ${route.laps}`}
            label={route.twist ? `laps to ${piece.orbit === 'EDGES' ? 'unflip' : 'untwist'}` : 'lap, home straight'}
            tone="alone"
          />
          <LensStat value={`${route.repeats}`} label={`repeats of ${seq}`} />
        </div>
        <p class="lens-foot">TAP A {NOUN[piece.orbit].toUpperCase()} · follow it instead</p>
      </div>
    </div>
  )
}
