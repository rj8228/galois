import { useEffect, useMemo, useState } from 'preact/hooks'
import { href } from '../app/router.ts'
import { parseSequence } from '../cube/notation.ts'
import { sequenceText } from '../cube/SequenceBar.tsx'
import { highlight } from '../cube/state.ts'
import { award } from '../daily/badges.ts'
import { istDay } from '../daily/date.ts'
import { affectedPieces, analyse, highlightMask, type OrbitAnalysis, tracePiece } from '../engine/analysis.ts'
import { ORBITS, type OrbitName } from '../engine/pieces.ts'
import { shapeOf, shapeText } from '../engine/structure.ts'
import { HelpHeading } from '../help/Help.tsx'
import { kpuzzle, loadKPuzzle } from './kpuzzle.ts'

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const say = (n: number) => NUMBER_WORDS[n] ?? String(n)

// Direction is left out on purpose: cubing.js's orientation numbers don't map cleanly to "clockwise".
const twistLabel = (orbit: OrbitName) => (orbit === 'EDGES' ? 'flipped' : 'twisted')

function OrbitCycles({ o }: { o: OrbitAnalysis }) {
  if (o.cycles.length === 0 && o.twistedInPlace.length === 0) return null
  return (
    <div class="orbit">
      <h4>{o.label}</h4>
      <ul class="cycles">
        {o.cycles.map((c) => (
          <li key={c.positions.join()}>
            <span class="mono">{c.positions.map((p) => o.names[p]).join(' → ')} ↺</span>
            <span class="muted">
              {' '}
              {c.positions.length}-cycle{c.twist ? `, comes back ${twistLabel(o.orbit)}` : ''}
            </span>
          </li>
        ))}
        {o.twistedInPlace.map((p) => (
          <li key={p.position}>
            <span class="mono">{o.names[p.position]}</span>
            <span class="muted"> stays put, {twistLabel(o.orbit)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function stickerSummary(lengths: number[]) {
  if (lengths.length === 0) return 'No stickers move.'
  const counts = new Map<number, number>()
  for (const l of lengths) counts.set(l, (counts.get(l) ?? 0) + 1)
  const parts = [...counts.entries()].map(([len, count]) => `${say(count)} ${len}-cycle${count > 1 ? 's' : ''}`)
  const total = lengths.reduce((a, b) => a + b, 0)
  return `${total} stickers move, in ${parts.join(', ')}.`
}

/** Names the sequence's structure as written: a commutator, a conjugate, or neither. */
function ShapeCard({ moves }: { moves: string[] }) {
  const shape = shapeOf(moves)
  return (
    <div class="card">
      <HelpHeading topic="structure">Shape</HelpHeading>
      {shape.kind === 'moves' ? (
        <p class="muted">No commutator or conjugate shape in these moves as written.</p>
      ) : (
        <>
          <p class="mono shape">{shapeText(shape)}</p>
          <p>
            {shape.kind === 'commutator' ? (
              <>
                A <a href={href('learn', 'commutators')}>commutator</a>: it can only change pieces where its two parts
                overlap.
              </>
            ) : (
              <>
                A <a href={href('learn', 'conjugates')}>conjugate</a>: set up, do the middle, undo the setup.
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}

export function AnalysisPanel() {
  const [view, setView] = useState<'pieces' | 'stickers'>('pieces')
  const [focus, setFocus] = useState(false)
  const [tracked, setTracked] = useState('')
  useEffect(() => {
    loadKPuzzle()
  }, [])

  const text = sequenceText.value
  const parsed = parseSequence(text)
  const kp = kpuzzle.value
  const analysis = useMemo(() => (kp && parsed.ok ? analyse(kp, parsed.alg) : null), [kp, text])
  const trackedPiece = tracked
    ? { orbit: tracked.split(':')[0] as OrbitName, index: Number(tracked.split(':')[1]) }
    : null
  const path = useMemo(
    () =>
      kp && parsed.ok && trackedPiece ? tracePiece(kp, parsed.moves, trackedPiece.orbit, trackedPiece.index) : null,
    [kp, text, tracked],
  )

  useEffect(() => {
    if (analysis?.order === 1260) award('order-1260', istDay())
  }, [analysis?.order])

  // Drive the cube's highlight from focus mode or the tracker; clear it when leaving.
  useEffect(() => {
    if (trackedPiece) highlight.value = highlightMask({ [trackedPiece.orbit]: [trackedPiece.index] })
    else if (focus && analysis) highlight.value = highlightMask(affectedPieces(analysis))
    else highlight.value = null
  }, [focus, tracked, analysis])
  useEffect(
    () => () => {
      highlight.value = null
    },
    [],
  )

  if (!parsed.ok) {
    return (
      <div class="card">
        <h3>Analysis</h3>
        <p class="muted">Type a valid sequence in the sequence box to analyse it.</p>
      </div>
    )
  }
  if (!analysis) {
    return (
      <div class="card">
        <h3>Analysis</h3>
        <p class="muted">Loading the cube's maths…</p>
      </div>
    )
  }

  const [corners, edges, centres] = analysis.orbits
  const moved = analysis.orbits.filter((o) => o.affected > 0)
  const orbitDef = (name: OrbitName) => ORBITS.find((o) => o.name === name)
  const trackedOrbit = trackedPiece ? orbitDef(trackedPiece.orbit) : null

  return (
    <div class="stack" aria-live="polite">
      <div class="card">
        <HelpHeading topic="order">Order</HelpHeading>
        <p class="big-number">{analysis.order}</p>
        <p>
          {analysis.order === 1
            ? 'This sequence does nothing overall: it is the identity.'
            : `Repeat it ${analysis.order} times and the cube is back where it started.`}
        </p>
        <div class="stats">
          <span>
            <b>{corners.affected}</b>/8 corners
          </span>
          <span>
            <b>{edges.affected}</b>/12 edges
          </span>
          {centres.affected > 0 && (
            <span>
              <b>{centres.affected}</b>/6 centres
            </span>
          )}
          <span class="muted">moved or turned</span>
        </div>
        <label class="check">
          <input
            type="checkbox"
            checked={focus}
            onChange={(e) => setFocus(e.currentTarget.checked)}
            disabled={!!tracked}
          />
          Focus: dim every piece this sequence leaves alone
        </label>
        {focus && (
          <p class="muted small">Focus works from a solved cube. Press Reset first if you've been turning it.</p>
        )}
      </div>

      <div class="card">
        <div class="card-head">
          <HelpHeading topic="cycles">Cycles</HelpHeading>
          <div class="seg small" role="group" aria-label="Cycle view">
            <button type="button" aria-pressed={view === 'pieces'} onClick={() => setView('pieces')}>
              Pieces
            </button>
            <button type="button" aria-pressed={view === 'stickers'} onClick={() => setView('stickers')}>
              Stickers
            </button>
          </div>
        </div>
        {moved.length === 0 ? (
          <p class="muted">Nothing moves.</p>
        ) : view === 'pieces' ? (
          <>
            {analysis.orbits.map((o) => (
              <OrbitCycles key={o.orbit} o={o} />
            ))}
            <p class="muted small">
              Order = least common multiple of the cycle lengths, ×3 or ×2 when pieces come back turned.
            </p>
          </>
        ) : (
          <p>{stickerSummary(analysis.orbits.flatMap((o) => o.stickerCycleLengths))}</p>
        )}
      </div>

      <ShapeCard moves={parsed.moves} />

      <div class="card">
        <HelpHeading topic="invariants">Invariants</HelpHeading>
        <ul class="invariants">
          <li>
            <span>
              Corner swaps: <b>{corners.parity}</b>, edge swaps: <b>{edges.parity}</b>
              {centres.affected > 0 && (
                <>
                  , centre swaps: <b>{centres.parity}</b>
                </>
              )}
            </span>
            <span class={analysis.parityMatches ? 'ok' : 'bad'}>
              {analysis.parityMatches ? 'always balanced' : 'impossible!'}
            </span>
          </li>
          <li>
            <span>
              Total corner twist: <b>{corners.twistSum}</b> (mod 3)
            </span>
            <span class="ok">always 0</span>
          </li>
          <li>
            <span>
              Total edge flip: <b>{edges.twistSum}</b> (mod 2)
            </span>
            <span class="ok">always 0</span>
          </li>
        </ul>
        <p class="muted small">
          These never change, whatever you do. That's why you can't swap just two pieces or twist a single corner.
        </p>
      </div>

      <div class="card">
        <HelpHeading topic="tracker">Track a piece</HelpHeading>
        <label class="field">
          <span>Follow one piece through the sequence, starting from solved</span>
          <select value={tracked} onChange={(e) => setTracked(e.currentTarget.value)}>
            <option value="">Choose a piece…</option>
            {ORBITS.filter((o) => o.name !== 'CENTERS').map((o) => (
              <optgroup key={o.name} label={o.label}>
                {o.names.map((name, i) => (
                  <option key={name} value={`${o.name}:${i}`}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {path && trackedOrbit && (
          <ol class="path">
            <li>
              <span class="mono">start</span> {trackedOrbit.names[path[0]]}
            </li>
            {parsed.moves.map((m, i) => (
              <li key={`${i}-${m}`} class={path[i + 1] === path[i] ? 'muted' : ''}>
                <span class="mono">{m}</span> {trackedOrbit.names[path[i + 1]]}
                {path[i + 1] === path[i] ? ' (stays)' : ''}
              </li>
            ))}
          </ol>
        )}
        {tracked && <p class="muted small">The cube dims every other piece. Reset, then Play to watch it travel.</p>}
      </div>
    </div>
  )
}
