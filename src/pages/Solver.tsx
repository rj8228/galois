import { useEffect, useState } from 'preact/hooks'
import { parseMoves } from '../solver/cube2.ts'
import { FLOORS, type FloorName, type SolveReport } from '../solver/engine.ts'
import { Rings } from '../solver/Rings.tsx'
import {
  buildMs,
  chooseFloor,
  error,
  floor,
  initTables,
  liveNodes,
  phase,
  played,
  playSolution,
  position,
  positionLabel,
  randomPosition,
  report,
  rings,
  shownRounds,
  solveNow,
  stepSolution,
  usePosition,
} from '../solver/state.ts'

const FLOOR_INFO: Record<FloorName, { name: string; size: string; text: string }> = {
  weak: {
    name: 'Weak',
    size: '729 entries',
    text: 'How many moves it takes to untwist every corner, ignoring where they are.',
  },
  medium: {
    name: 'Medium',
    size: '5,769 entries',
    text: 'The higher of two smaller puzzles: twists alone, or places alone.',
  },
  strong: {
    name: 'Strong',
    size: '1.2 million entries',
    text: 'Also two views that each track five corners, slot and twist.',
  },
}

const fmt = (n: number) => n.toLocaleString('en-US')
/** "a 9-move" or "an 11-move": eight and eleven start with a vowel sound. */
const aMove = (n: number) => `${n === 8 || n === 11 || n === 18 ? 'an' : 'a'} ${n}-move`

/** Starts the search and brings it into view, so you can watch it without scrolling. */
function startSolve() {
  solveNow()
  requestAnimationFrame(() => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('solver-search')?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  })
}
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`

export function Solver() {
  useEffect(() => {
    initTables()
  }, [])
  const busy = phase.value === 'searching'
  const ready = rings.value.length > 0
  return (
    <div class="stack">
      <div class="card">
        <span class="eyebrow">Solver · 2×2</span>
        <h2>Watch an optimal solve</h2>
        <p>
          Pick any position. The solver raises a <b>floor</b>, a number of moves the position certainly needs, until it
          finds a solution that short. That proves nothing shorter exists. Then it plays the solution.
        </p>
      </div>
      <PositionCard busy={busy} ready={ready} />
      <FloorCard busy={busy} />
      <button type="button" class="btn primary solve-btn" onClick={startSolve} disabled={!ready || busy}>
        {phase.value === 'error'
          ? 'Solver unavailable'
          : !ready
            ? 'Building tables…'
            : busy
              ? 'Searching…'
              : 'Solve it'}
      </button>
      {phase.value === 'error' && <p class="field-error">The solver stopped: {error.value}</p>}
      <SearchCard ready={ready} />
      {phase.value === 'proven' && report.value && <SolutionCard r={report.value} />}
      {phase.value === 'proven' && report.value && <CompareCard r={report.value} />}
      <div class="card">
        <h3>How it proves it</h3>
        <p class="small">
          A floor comes from a smaller puzzle that ignores part of the cube. Any solution of the real cube also solves
          the smaller one, so the floor is never too high. Each round rules out every solution shorter than the floor;
          the first round that finds one has proved it is the shortest.
        </p>
        {ready && (
          <p class="small muted">
            The rings are labelled from a table of all {fmt(rings.value.reduce((a, b) => a + b, 0))} positions, built on
            this device in {(buildMs.value / 1000).toFixed(1)} s. The solver never looks at it.
          </p>
        )}
      </div>
    </div>
  )
}

function PositionCard({ busy, ready }: { busy: boolean; ready: boolean }) {
  const [text, setText] = useState('')
  const parsed = parseMoves(text)
  const invalid = text.trim() !== '' && parsed === null
  const off = !ready || busy
  const moves = position.value
  return (
    <div class="card">
      <h3>Position</h3>
      <p class="small">
        <span class="muted">{positionLabel.value}: </span>
        <span class="mono scramble-text">{moves.length ? moves.join(' ') : 'solved'}</span>
      </p>
      <div class="row">
        <button type="button" class="btn small" onClick={() => randomPosition()} disabled={off}>
          Random position
        </button>
        <button type="button" class="btn small" onClick={() => randomPosition(11)} disabled={off}>
          Hardest (11 moves)
        </button>
      </div>
      <div class="field">
        <span class="small muted">Or pick how far from solved</span>
        <div class="seg small ring-pick" role="group" aria-label="Moves from solved">
          {Array.from({ length: 11 }, (_, i) => i + 1).map((d) => (
            <button type="button" key={d} onClick={() => randomPosition(d)} disabled={off}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <form
        class="seq-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (parsed && !off) {
            usePosition(parsed)
            setText('')
          }
        }}
      >
        <label class="sr-only" for="solver-moves">
          Moves from solved
        </label>
        <input
          id="solver-moves"
          type="text"
          value={text}
          placeholder="Or type moves: R U2 F'"
          autocomplete="off"
          spellcheck={false}
          aria-invalid={invalid}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="btn small" disabled={!parsed || parsed.length === 0 || off}>
          Use
        </button>
      </form>
      {invalid && <p class="field-error">Use face turns only: U D L R F B, with ′ or 2.</p>}
      <p class="small muted">Or turn the cube yourself with the move pad.</p>
    </div>
  )
}

function FloorCard({ busy }: { busy: boolean }) {
  const info = FLOOR_INFO[floor.value]
  return (
    <div class="card">
      <h3>Floor</h3>
      <div class="seg" role="group" aria-label="Floor strength">
        {FLOORS.map((f) => (
          <button type="button" key={f} aria-pressed={floor.value === f} onClick={() => chooseFloor(f)} disabled={busy}>
            {FLOOR_INFO[f].name}
          </button>
        ))}
      </div>
      <p class="small">
        {info.text} <span class="muted">({info.size})</span>
      </p>
    </div>
  )
}

function SearchCard({ ready }: { ready: boolean }) {
  const r = report.value
  const searching = phase.value === 'searching'
  const proven = phase.value === 'proven'
  const rounds = r?.rounds ?? []
  const done = Math.min(shownRounds.value, rounds.length)
  const live = searching && r && done < rounds.length ? rounds[done] : null
  const floorRing = searching ? live?.bound : proven ? r?.trueDistance : undefined
  const posRing = proven && r ? r.trueDistance - played.value : undefined
  return (
    <div class="card search-card" id="solver-search">
      <h3>The search</h3>
      <div class="search-view">
        <Rings />
        <table class="ring-table">
          <caption class="sr-only">Positions at each distance from solved</caption>
          <thead>
            <tr>
              <th scope="col">Moves</th>
              <th scope="col">Positions</th>
            </tr>
          </thead>
          <tbody>
            {(ready ? rings.value : []).map((count, d) => (
              <tr key={d} class={d === posRing ? 'ring-here' : d === floorRing ? 'ring-floor-row' : undefined}>
                <td>{d}</td>
                <td>{fmt(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!r && !searching && <p class="small muted">Press Solve it to start. The dashed ring will be the floor.</p>}
      {searching && !r && <p class="small muted">Searching…</p>}
      {r && (
        <ol class="round-log">
          {rounds.slice(0, done).map((round, i) => {
            const found = i === rounds.length - 1
            return (
              <li key={round.bound} class={found ? 'round-found' : undefined}>
                <span class="mono">At least {round.bound}</span>
                <span>
                  {plural(round.nodes, 'position')} checked,{' '}
                  {found ? <b>found {aMove(round.bound)} solution</b> : 'none that short'}
                </span>
              </li>
            )
          })}
          {live && (
            <li class="round-live" aria-live="polite">
              <span class="mono">At least {live.bound}</span>
              <span>{fmt(liveNodes.value)} checked…</span>
            </li>
          )}
        </ol>
      )}
      {proven && r && (
        <div class="result">
          <span class="big-number">{r.trueDistance}</span>
          <span>
            {r.trueDistance === 1 ? 'move' : 'moves'}, <b>proven shortest</b>
            <span class="small muted result-note">
              The real search checked {plural(r.nodes, 'position')} in {r.ms < 1 ? 'under 1' : Math.round(r.ms)} ms; it
              is replayed slowly so you can watch.
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

function SolutionCard({ r }: { r: SolveReport }) {
  return (
    <div class="card">
      <h3>The solution, as you hold the cube</h3>
      {r.solution.length === 0 ? (
        <p>Already solved: nothing to do.</p>
      ) : (
        <ol class="solution-moves" aria-label="Solution moves">
          {r.solution.map((m, i) => (
            <li key={`${i}${m}`} class={i < played.value ? 'done' : i === played.value ? 'next' : undefined}>
              {m}
            </li>
          ))}
        </ol>
      )}
      <div class="row">
        <button type="button" class="btn small" onClick={playSolution} disabled={!r.solution.length}>
          Play again
        </button>
        <button type="button" class="btn small" onClick={() => stepSolution(-1)} aria-label="Step back one move">
          ← Step
        </button>
        <button type="button" class="btn small" onClick={() => stepSolution(1)} aria-label="Step forward one move">
          Step →
        </button>
      </div>
      <p class="small muted">Each move drops the dot one ring closer to solved: no move is wasted.</p>
    </div>
  )
}

function CompareCard({ r }: { r: SolveReport }) {
  const most = Math.log10(Math.max(10, ...FLOORS.map((f) => r.compare[f].nodes)))
  return (
    <div class="card">
      <h3>Floors compared, same position</h3>
      <ul class="compare">
        {FLOORS.map((f) => {
          const c = r.compare[f]
          return (
            <li key={f} class={f === r.floor ? 'compare-on' : undefined}>
              <span class="compare-name">{FLOOR_INFO[f].name}</span>
              <span class="compare-bar" style={{ width: `${Math.max(4, (Math.log10(c.nodes + 1) / most) * 100)}%` }} />
              <span class="compare-text">
                starts at {c.floorAtStart}, {plural(c.rounds, 'round')}, {plural(c.nodes, 'position')}
              </span>
            </li>
          )
        })}
      </ul>
      <p class="small muted">
        A stronger floor starts closer to the answer, so there is less to rule out. Each extra move of floor cuts the
        work by about five times.
      </p>
    </div>
  )
}
