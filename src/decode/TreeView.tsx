import './tree.css'
import { useEffect, useState } from 'preact/hooks'
import { kpuzzle, loadKPuzzle } from '../analysis/kpuzzle.ts'
import { playWithFocus } from '../cube/focus.ts'
import { analyse } from '../engine/analysis.ts'
import { type Shape, shapeText } from '../engine/structure.ts'
import { algOf, type Breakdown } from './breakdowns.ts'
import { expand, tokens } from './tree.ts'

type Role = 'X' | 'Y' | 'A' | 'B'
const ROLE_NAME: Record<Role, string> = { X: 'X', Y: 'Y', A: 'A · set up', B: 'B · do' }
const KIND_NAME = { commutator: 'Commutator', conjugate: 'Conjugate' } as const

const pretty = (s: string) => s.replaceAll("'", '′')

/** The top-level parts as runs of moves: X, Y, X undone, Y undone; or A, B, A undone. */
function segments(s: Shape): { label: string; length: number; half: string; undone: boolean }[] {
  if (s.kind === 'commutator') {
    const x = expand(s.x).length
    const y = expand(s.y).length
    return [
      { label: 'X', length: x, half: 'x', undone: false },
      { label: 'Y', length: y, half: 'y', undone: false },
      { label: 'X undone', length: x, half: 'x', undone: true },
      { label: 'Y undone', length: y, half: 'y', undone: true },
    ]
  }
  if (s.kind === 'conjugate') {
    const a = expand(s.a).length
    return [
      { label: 'A', length: a, half: 'a', undone: false },
      { label: 'B', length: expand(s.b).length, half: 'b', undone: false },
      { label: 'A undone', length: a, half: 'a', undone: true },
    ]
  }
  return []
}

function Box({
  shape,
  part: role,
  onPlay,
}: {
  shape: Shape
  part: Role | null
  onPlay: (s: Shape, part: Role | null) => void
}) {
  const text = pretty(shapeText(shape))
  const tone = role ? `tree-${role.toLowerCase()}` : 'tree-top'
  if (shape.kind === 'moves') {
    const name = role ? ROLE_NAME[role] : 'moves'
    return (
      <button
        type="button"
        class={`tree-box tree-leaf ${tone}`}
        aria-label={`Play ${name}: ${text}`}
        onClick={() => onPlay(shape, role)}
      >
        <span class="tree-label">{name}</span>
        <span class="tree-moves">{text}</span>
      </button>
    )
  }
  const kind = KIND_NAME[shape.kind]
  const title = role ? `${role} · ${kind}` : kind
  const [first, second] = shape.kind === 'commutator' ? [shape.x, shape.y] : [shape.a, shape.b]
  const roles: [Role, Role] = shape.kind === 'commutator' ? ['X', 'Y'] : ['A', 'B']
  return (
    <div class={`tree-box tree-node ${tone}`}>
      <button type="button" class="tree-head" aria-label={`Play ${title}: ${text}`} onClick={() => onPlay(shape, role)}>
        <span class="tree-label">{title}</span>
        <span class="tree-text">{text}</span>
      </button>
      <div class="tree-kids">
        <Box shape={first} part={roles[0]} onPlay={onPlay} />
        <Box shape={second} part={roles[1]} onPlay={onPlay} />
      </div>
    </div>
  )
}

/** Decode's Tree: an algorithm's commutator and conjugate structure as nested boxes you can play one by one. */
export function TreeView({ b }: { b: Breakdown }) {
  const [playing, setPlaying] = useState('')
  useEffect(() => {
    loadKPuzzle()
  }, [])
  const tree = b.tree
  if (!tree) return null
  const row = tokens(tree)
  const kp = kpuzzle.value
  const analysis = kp ? analyse(kp, algOf(b)) : null
  const corners = analysis?.orbits.find((o) => o.orbit === 'CORNERS')
  const cycle = corners?.cycles.length === 1 ? corners.cycles[0].positions.map((p) => corners.names[p]) : null
  const play = (s: Shape, part: Role | null) => {
    const moves = expand(s).join(' ')
    playWithFocus(moves)
    setPlaying(`${part ? `${part} = ` : ''}${pretty(moves)}`)
  }

  return (
    <section class="card tree" aria-labelledby="tree-title">
      <div class="card-head">
        <h3 id="tree-title">Tree</h3>
        {analysis && <span class="lens-tag mono">Order {analysis.order}</span>}
      </div>
      <ol
        class="tree-row"
        style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
        aria-label={`The moves, by part: ${row.map((t) => `${pretty(t.move)} ${t.part}${t.undone ? ' undone' : ''}`).join(', ')}`}
      >
        {row.map((t, i) => (
          <li key={`${i}${t.move}`} class={`tree-tile tree-half-${t.half ?? 'top'}${t.undone ? ' tree-undone' : ''}`}>
            <span class="tree-tile-move">{pretty(t.move)}</span>
            <span class="tree-tile-part">{t.undone ? `${t.part}′` : t.part}</span>
          </li>
        ))}
        {segments(tree).map((s) => (
          <li
            key={s.label}
            aria-hidden="true"
            class={`tree-seg tree-half-${s.half}${s.undone ? ' tree-undone' : ''}`}
            style={{ gridColumn: `span ${s.length}` }}
          >
            {s.label}
          </li>
        ))}
      </ol>
      <Box shape={tree} part={null} onPlay={play} />
      {cycle && (
        <ol class="tree-cycle" aria-label={`Corners cycled: ${cycle.join(', ')}, and back`}>
          {cycle.map((n) => (
            <li key={n}>
              <span class="tree-chip">{n}</span>
            </li>
          ))}
          <li class="muted">back</li>
        </ol>
      )}
      <p class="lens-foot" aria-live="polite">
        {playing ? `PLAYING · ${playing}` : 'TAP A BOX · the cube plays just that part'}
      </p>
    </section>
  )
}
