import { useEffect, useState } from 'preact/hooks'
import { href } from '../app/router.ts'
import { parseMoves } from '../solver/cube2.ts'
import { FLOORS, type FloorName, type SolveReport } from '../solver/engine.ts'
import { Rings } from '../solver/Rings.tsx'
import { EXAMPLE, EXHAUSTIVE, FLOOR_WORK, RING_COUNTS, TOTAL_POSITIONS } from '../solver/report.ts'
import {
  buildMs,
  chooseFloor,
  chooseMode,
  chooseSpeed,
  compareNow,
  comparing,
  comparison,
  error,
  floor,
  hardestPosition,
  initTables,
  liveNodes,
  mode,
  pauseSolution,
  phase,
  played,
  playing,
  playSolution,
  position,
  positionLabel,
  randomPosition,
  report,
  resumeSolution,
  scramblePosition,
  shownRounds,
  solveNow,
  speed,
  stepSolution,
  strongMs,
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
    size: '1.2 million entries, built the first time you use it',
    text: 'Also two views that each track five corners, slot and twist.',
  },
}

const fmt = (n: number) => n.toLocaleString('en-US')
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`
/** "a 9-move" or "an 11-move": eight and eleven start with a vowel sound. */
const aMove = (n: number) => `${n === 8 || n === 11 || n === 18 ? 'an' : 'a'} ${n}-move`
const pct = (n: number) => `${((n / TOTAL_POSITIONS) * 100).toFixed(n / TOTAL_POSITIONS < 0.01 ? 2 : 0)}%`

/** Starts the search and brings it into view, so you can watch it without scrolling. */
function startSolve() {
  solveNow()
  requestAnimationFrame(() => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('solver-search')?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  })
}

export function Solver() {
  useEffect(() => {
    initTables()
  }, [])
  return (
    <div class="stack solver-page">
      <div class="seg mode-switch" role="group" aria-label="Solver mode">
        <button type="button" aria-pressed={mode.value === 'one'} onClick={() => chooseMode('one')}>
          Solve one
        </button>
        <button type="button" aria-pressed={mode.value === 'all'} onClick={() => chooseMode('all')}>
          The whole cube
        </button>
      </div>
      {mode.value === 'one' ? <SolveOne /> : <WholeCube />}
    </div>
  )
}

// ---------------- Solve one: the playground ----------------

function SolveOne() {
  const busy = phase.value === 'searching'
  const ready = phase.value !== 'loading' && phase.value !== 'error'
  return (
    <>
      <div class="card">
        <span class="eyebrow">Solver · 2×2</span>
        <h2>Watch an optimal solve</h2>
        <p>
          Pick a position. The solver searches that one position, raising a <b>floor</b> (a number of moves it certainly
          needs) until it finds a solution that short. That proves nothing shorter exists. Then it plays the solution in
          slow motion.
        </p>
      </div>
      <PositionCard off={!ready || busy} />
      <FloorCard busy={busy} />
      <button type="button" class="btn primary solve-btn" onClick={startSolve} disabled={!ready || busy}>
        {phase.value === 'error' ? 'Solver unavailable' : !ready ? 'Getting ready…' : busy ? 'Searching…' : 'Solve it'}
      </button>
      {phase.value === 'error' && <p class="field-error">The solver stopped: {error.value}</p>}
      <SearchCard />
      {phase.value === 'proven' && report.value && <SolutionCard r={report.value} />}
      {phase.value === 'proven' && report.value && <CompareCard r={report.value} />}
      <p class="small muted">
        Only your position is searched. The solver starts from small floor tables, built on this device in{' '}
        {buildMs.value < 1 ? 'under 1' : Math.round(buildMs.value)} ms
        {strongMs.value > 0 && ` (the strong floor took another ${Math.round(strongMs.value)} ms)`}.{' '}
        <button type="button" class="link-btn inline" onClick={() => chooseMode('all')}>
          See the whole cube
        </button>
      </p>
    </>
  )
}

function PositionCard({ off }: { off: boolean }) {
  const [text, setText] = useState('')
  const parsed = parseMoves(text)
  const invalid = text.trim() !== '' && parsed === null
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
        <button type="button" class="btn small" onClick={hardestPosition} disabled={off}>
          Hardest (11 moves)
        </button>
      </div>
      <div class="field">
        <span class="small muted">Or scramble with random moves, and let the solver find how far it really is</span>
        <div class="seg small" role="group" aria-label="Scramble length">
          {[5, 10, 20].map((n) => (
            <button type="button" key={n} onClick={() => scramblePosition(n)} disabled={off}>
              {n} moves
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

function SearchCard() {
  const r = report.value
  const searching = phase.value === 'searching'
  const proven = phase.value === 'proven'
  const rounds = r?.rounds ?? []
  const done = Math.min(shownRounds.value, rounds.length)
  const live = searching && r && done < rounds.length ? rounds[done] : null
  const floorRing = searching ? live?.bound : proven ? r?.distance : undefined
  const posRing = proven && r ? r.distance - played.value : undefined
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
            {RING_COUNTS.map((count, d) => (
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
          <span class="big-number">{r.distance}</span>
          <span>
            {r.distance === 1 ? 'move' : 'moves'}, <b>proven shortest</b>
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
        {playing.value ? (
          <button type="button" class="btn small" onClick={pauseSolution}>
            Pause
          </button>
        ) : (
          <button type="button" class="btn small" onClick={resumeSolution} disabled={!r.solution.length}>
            {played.value >= r.solution.length ? 'Play again' : played.value ? 'Resume' : 'Play'}
          </button>
        )}
        <button type="button" class="btn small" onClick={() => stepSolution(-1)} aria-label="Step back one move">
          ← Step
        </button>
        <button type="button" class="btn small" onClick={() => stepSolution(1)} aria-label="Step forward one move">
          Step →
        </button>
        <button type="button" class="link-btn" onClick={playSolution}>
          From the start
        </button>
      </div>
      <div class="seg small" role="group" aria-label="Playback speed">
        <button type="button" aria-pressed={speed.value === 'slow'} onClick={() => chooseSpeed('slow')}>
          Slow motion
        </button>
        <button type="button" aria-pressed={speed.value === 'normal'} onClick={() => chooseSpeed('normal')}>
          Normal
        </button>
      </div>
      <p class="small muted">Each move drops the dot one ring closer to solved: no move is wasted.</p>
    </div>
  )
}

function CompareCard({ r }: { r: SolveReport }) {
  const c = comparison.value
  if (!c) {
    return (
      <div class="card">
        <h3>Floors compared</h3>
        <p class="small">See how much work the other floors would need for this same position.</p>
        <button type="button" class="btn small" onClick={compareNow} disabled={comparing.value}>
          {comparing.value ? 'Comparing…' : 'Compare all three floors'}
        </button>
      </div>
    )
  }
  const most = Math.log10(Math.max(10, ...FLOORS.map((f) => c[f].nodes)))
  return (
    <div class="card">
      <h3>Floors compared, same position</h3>
      <ul class="compare">
        {FLOORS.map((f) => (
          <li key={f} class={f === r.floor ? 'compare-on' : undefined}>
            <span class="compare-name">{FLOOR_INFO[f].name}</span>
            <span class="compare-bar" style={{ width: `${Math.max(4, (Math.log10(c[f].nodes + 1) / most) * 100)}%` }} />
            <span class="compare-text">
              starts at {c[f].floorAtStart}, {plural(c[f].rounds, 'round')}, {plural(c[f].nodes, 'position')}
            </span>
          </li>
        ))}
      </ul>
      <p class="small muted">
        A stronger floor starts closer to the answer, so there is less to rule out. Each extra move of floor cuts the
        work by about five times.
      </p>
    </div>
  )
}

// ---------------- The whole cube: what the framework does, from the lab's results ----------------

function WholeCube() {
  const exampleTotal = EXAMPLE.rounds.reduce((a, b) => a + b.nodes, 0)
  const most = Math.log10(FLOOR_WORK[0].nodes)
  return (
    <>
      <div class="card">
        <span class="eyebrow">Solver · the whole cube</span>
        <h2>All {fmt(TOTAL_POSITIONS)} positions</h2>
        <p>
          Every way a 2×2 can be scrambled, sorted onto rings by how many moves it needs. On the stage, each dot is
          1,000 positions. Nothing here is recomputed: these are results from the Galois lab, which solved every
          position once.
        </p>
      </div>

      <div class="card">
        <h3>How big that is</h3>
        <ul class="facts">
          <li>
            <b>{pct(RING_COUNTS[9] + RING_COUNTS[10])}</b> of positions are 9 or 10 moves out. A random scramble is
            almost always near the edge.
          </li>
          <li>
            Only <b>{fmt(RING_COUNTS[11])}</b> need all 11 moves, the most any position needs: God's number for the 2×2.
          </li>
          <li>
            Within 4 moves of solved there are just <b>{fmt(RING_COUNTS.slice(0, 5).reduce((a, b) => a + b, 0))}</b>{' '}
            positions: about two dots, near the centre.
          </li>
          <li>
            A 3×3 has about <b>43 quintillion</b> positions, roughly 12 trillion times more. At 1,000 positions a dot,
            its picture would need 43 quadrillion dots.
          </li>
        </ul>
      </div>

      <div class="card">
        <h3>How the solver finds the shortest path</h3>
        <ol class="steps-explained">
          <li>
            <b>Floor.</b> Look at the cube through a smaller puzzle, such as the twists alone. Any solution of the real
            cube also solves the smaller one, so its distance is never too high: the position needs at least that many
            moves.
          </li>
          <li>
            <b>Round.</b> Try every sequence of moves up to that length, skipping any branch whose floor says it can no
            longer finish in time.
          </li>
          <li>
            <b>Raise.</b> Nothing solves it? Then it needs at least one more move. Raise the bound by one and search
            again.
          </li>
          <li>
            <b>Proof.</b> The first round that finds a solution has proved it is the shortest, because every shorter
            length was ruled out completely.
          </li>
        </ol>
        <p class="small">
          <span class="muted">Example, one of the hardest positions: </span>
          <span class="mono">{EXAMPLE.scramble}</span>
        </p>
        <ol class="round-log">
          {EXAMPLE.rounds.map((round, i) => {
            const found = i === EXAMPLE.rounds.length - 1
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
        </ol>
        <p class="small muted">
          With the medium floor it starts at {EXAMPLE.floorAtStart} and checks {fmt(exampleTotal)} positions in total.
          The weak floor starts at {EXAMPLE.weak.floorAtStart} and needs {fmt(EXAMPLE.weak.nodes)}; the strong one
          starts at {EXAMPLE.strong.floorAtStart} and needs just {fmt(EXAMPLE.strong.nodes)}.
        </p>
      </div>

      <div class="card">
        <h3>Every position, solved</h3>
        <p>
          The lab ran the solver on all {fmt(EXHAUSTIVE.positions)} positions and replayed every solution. Every one
          solved its position in the proven-shortest number of moves: <b>{EXHAUSTIVE.mismatches} mismatches</b>.
        </p>
        <dl class="stat-grid">
          <div>
            <dt>Positions checked, in total</dt>
            <dd>{fmt(EXHAUSTIVE.nodes)}</dd>
          </div>
          <div>
            <dt>Per solve, on average</dt>
            <dd>{fmt(EXHAUSTIVE.meanNodes)}</dd>
          </div>
          <div>
            <dt>Most for one solve</dt>
            <dd>{fmt(EXHAUSTIVE.maxNodes)}</dd>
          </div>
          <div>
            <dt>Time, on {EXHAUSTIVE.cores} cores</dt>
            <dd>{EXHAUSTIVE.seconds} s</dd>
          </div>
        </dl>
      </div>

      <div class="card">
        <h3>Why the floor matters</h3>
        <ul class="work">
          {FLOOR_WORK.map((f) => (
            <li key={`${f.name} ${f.size}`}>
              <span>
                <b>{f.name}</b> <span class="muted">· {f.size}</span>
              </span>
              <span class="work-num">{fmt(f.nodes)}</span>
              <span class="work-bar" style={{ width: `${Math.max(2, (Math.log10(f.nodes) / most) * 100)}%` }} />
              {f.note && <span class="work-note">{f.note}</span>}
            </li>
          ))}
        </ul>
        <p class="small muted">
          Positions checked per solve, averaged over the same 1,000 random positions; bars are on a log scale. Each
          extra move of floor cuts the work about five times, close to the six choices the solver has at every step.
        </p>
      </div>

      <div class="card">
        <h3>Why not just store every answer?</h3>
        <p class="small">
          For the 2×2 you could: one number per position is about 1.8 MB, and that table is how the lab checked the
          solver. For a 3×3 it would be 43 quintillion numbers. So the solver works from small floors and a search,
          which is the part that carries over to bigger cubes.
        </p>
        <div class="row">
          <button type="button" class="btn small" onClick={() => chooseMode('one')}>
            Try one yourself
          </button>
          <a class="small" href={href('paper')}>
            Read the whole method as a paper
          </a>
        </div>
      </div>
    </>
  )
}
