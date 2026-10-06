import { signal } from '@preact/signals'
import { useEffect, useRef, useState } from 'preact/hooks'
import { kpuzzle, loadKPuzzle } from '../analysis/kpuzzle.ts'
import { NotationKeypad } from '../cube/NotationKeypad.tsx'
import { applyKey, parseSequence } from '../cube/notation.ts'
import { history, loadPosition, playSequence } from '../cube/state.ts'
import { HelpHeading } from '../help/Help.tsx'
import { settings } from '../settings/settings.ts'
import { award, BADGES, earned } from './badges.ts'
import { addDays, formatCountdown, formatTime, istDay, msUntilNextPuzzle, puzzleNumber } from './date.ts'
import { type DailyPuzzle, dailyPuzzle } from './scramble.ts'
import { session, startAttempt } from './session.ts'
import { bestSpeed, playedDays, recordFor, SPEED_ATTEMPTS, updateDay } from './store.ts'
import { computeStreak } from './streak.ts'

/** Today's IST date, refreshed every minute so the page rolls over at midnight IST. */
const today = signal(istDay())
const clock = signal(Date.now())
setInterval(() => {
  clock.value = Date.now()
  today.value = istDay()
}, 30_000)

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

function SpeedCard({ puzzle }: { puzzle: DailyPuzzle }) {
  const record = recordFor(puzzle.day)
  const best = bestSpeed(record)
  const live = session.value.phase === 'inspecting' || session.value.phase === 'solving'
  const used = record.speed.length
  return (
    <div class="card">
      <HelpHeading topic="speed">Speed · best of {SPEED_ATTEMPTS}</HelpHeading>
      <ol class="attempts">
        {Array.from({ length: SPEED_ATTEMPTS }, (_, i) => {
          const a = record.speed[i]
          return (
            <li key={i} class={a && a.ms !== null && a.ms === best ? 'best' : ''}>
              <span class="muted">Attempt {i + 1}</span>
              <span class="mono">{a ? (a.ms === null ? 'DNF' : formatTime(a.ms)) : '–'}</span>
            </li>
          )
        })}
      </ol>
      <p>
        Best today: <b class="mono">{best === null ? '–' : `${formatTime(best)} s`}</b>
      </p>
      <button
        type="button"
        class="btn primary"
        disabled={live || !kpuzzle.value}
        onClick={() => startAttempt(puzzle.day, puzzle.scramble)}
      >
        {live
          ? 'Attempt running: see the timer on the cube'
          : used < SPEED_ATTEMPTS
            ? `Start attempt ${used + 1} of ${SPEED_ATTEMPTS}`
            : 'Practise (not counted)'}
      </button>
    </div>
  )
}

function OptimalCard({ puzzle }: { puzzle: DailyPuzzle }) {
  const record = recordFor(puzzle.day)
  const [text, setText] = useState(record.draft ?? '')
  const [confirming, setConfirming] = useState(false)
  const [keypad, setKeypad] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const kp = kpuzzle.value
  const useKeypad = settings.value.keypad === 'on' || (settings.value.keypad === 'auto' && coarse)

  const save = (value: string) => {
    setText(value)
    updateDay(puzzle.day, (r) => ({ ...r, draft: value }))
  }
  const parsed = parseSequence(text)
  const faceOnly = parsed.ok && parsed.moves.every((m) => /^[RLUDFB]/.test(m))
  const solves =
    parsed.ok && faceOnly && kp
      ? kp
          .defaultPattern()
          .applyAlg(`${puzzle.scramble} ${parsed.moves.join(' ')}`)
          .isIdentical(kp.defaultPattern())
      : false
  const moves = parsed.ok ? parsed.moves.length : 0

  if (record.optimal) {
    const mine = record.optimal.moves
    const verdict =
      mine < puzzle.solverLength
        ? 'You beat the machine!'
        : mine === puzzle.solverLength
          ? 'You matched the machine.'
          : `${mine - puzzle.solverLength} more than the machine.`
    return (
      <div class="card">
        <HelpHeading topic="optimal">Optimal · fewest moves</HelpHeading>
        <p class="big-number">{mine}</p>
        <p>
          moves submitted. Galois's solver found <b>{puzzle.solverLength}</b>. {verdict}
        </p>
        <p class="small">
          <span class="muted">Your solution: </span>
          <span class="mono">{record.optimal.solution}</span>
        </p>
        <details class="formal">
          <summary>Show the solver's solution</summary>
          <p class="mono">{solverSolution(puzzle.scramble)}</p>
          <p class="muted small">
            Galois uses a two-phase solver, which is fast but not always optimal. Every position can be solved in 20
            moves or fewer.
          </p>
        </details>
      </div>
    )
  }

  const insert = (key: string) => {
    const el = box.current
    if (!el) return
    const r = applyKey(text, el.selectionStart ?? text.length, el.selectionEnd ?? text.length, key)
    save(r.text)
    requestAnimationFrame(() => el.setSelectionRange(r.caret, r.caret))
  }

  return (
    <div class="card">
      <HelpHeading topic="optimal">Optimal · fewest moves</HelpHeading>
      <div class="row">
        <button type="button" class="btn small" onClick={() => loadPosition(puzzle.scramble)}>
          Back to the scramble
        </button>
        <button
          type="button"
          class="btn small"
          onClick={() => save(history.value.join(' '))}
          disabled={history.value.length === 0}
        >
          Use my moves
        </button>
      </div>
      <label class="field" for="solution">
        <span>Your solution (face turns only)</span>
      </label>
      <textarea
        id="solution"
        ref={box}
        rows={3}
        value={text}
        inputMode={useKeypad ? 'none' : 'text'}
        spellcheck={false}
        autoComplete="off"
        autoCapitalize="off"
        onFocus={() => useKeypad && setKeypad(true)}
        onInput={(e) => save(e.currentTarget.value)}
      />
      {useKeypad && keypad && <NotationKeypad onKey={insert} onDone={() => setKeypad(false)} />}
      <p class={`task ${solves ? 'task-done' : ''}`} aria-live="polite">
        <span aria-hidden="true">{solves ? '✓' : '○'}</span>{' '}
        {!text.trim()
          ? 'Write a solution, or solve on the cube and press Use my moves.'
          : !parsed.ok
            ? parsed.error
            : !faceOnly
              ? 'Use face turns only (R L U D F B), no slices or rotations.'
              : solves
                ? `Solves the cube in ${moves} moves.`
                : `${moves} moves so far, but the cube isn't solved yet.`}
      </p>
      <div class="row">
        <button
          type="button"
          class="btn"
          disabled={!parsed.ok || !faceOnly}
          onClick={() => {
            loadPosition(puzzle.scramble)
            if (parsed.ok) playSequence(parsed.moves)
          }}
        >
          Show on the cube
        </button>
        {!confirming ? (
          <button type="button" class="btn primary" disabled={!solves} onClick={() => setConfirming(true)}>
            Submit
          </button>
        ) : (
          <span class="confirm">
            One submission a day. Submit {moves} moves?
            <button
              type="button"
              class="btn small primary"
              onClick={() => {
                const solution = parsed.ok ? parsed.moves.join(' ') : ''
                updateDay(puzzle.day, (r) => ({ ...r, optimal: { solution, moves, at: new Date().toISOString() } }))
                award('first-solve', puzzle.day)
                if (moves <= 20) award('twenty', puzzle.day)
                if (moves < puzzle.solverLength) award('beat-machine', puzzle.day)
                setConfirming(false)
              }}
            >
              Yes, submit
            </button>
            <button type="button" class="btn small" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

/** The solver's solution is the scramble reversed. */
function solverSolution(scramble: string) {
  const parsed = parseSequence(scramble)
  return parsed.ok ? parsed.alg.invert().toString() : ''
}

function StreakCard() {
  const played = playedDays()
  const streak = computeStreak(played, today.value)
  const frozen = new Set(streak.frozenDays)
  if (streak.current >= 7) award('week', today.value)
  if (streak.current >= 30) award('galois', today.value)
  // The last 12 weeks, oldest first, in columns of 7 days.
  const cells = Array.from({ length: 84 }, (_, i) => addDays(today.value, i - 83))
  return (
    <div class="card">
      <HelpHeading topic="streak">Streak</HelpHeading>
      <div class="stats">
        <span>
          <b class="big-inline">{streak.current}</b> day{streak.current === 1 ? '' : 's'} now
        </span>
        <span>
          <b>{streak.best}</b> best
        </span>
        <span>
          <b>{streak.freezes}</b> freeze{streak.freezes === 1 ? '' : 's'} held
        </span>
      </div>
      <div
        class="heatmap"
        role="img"
        aria-label={`Days played in the last 12 weeks: ${cells.filter((d) => played.has(d)).length}`}
      >
        {cells.map((d) => (
          <span
            key={d}
            title={d}
            class={`${played.has(d) ? 'on' : frozen.has(d) ? 'frozen' : ''} ${d === today.value ? 'today' : ''}`}
          />
        ))}
      </div>
      <p class="muted small">Last 12 weeks. Filled: played. Striped: covered by a freeze.</p>
    </div>
  )
}

function BadgesCard() {
  return (
    <div class="card">
      <HelpHeading topic="badges">Badges</HelpHeading>
      <ul class="badges">
        {BADGES.map((b) => {
          const day = earned.value[b.id]
          return (
            <li key={b.id} class={day ? 'earned' : ''}>
              <span class="badge-name">{b.name}</span>
              <span class="muted small">{day ? `Earned ${day}` : b.how}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ShareCard({ puzzle }: { puzzle: DailyPuzzle }) {
  const [copied, setCopied] = useState(false)
  const record = recordFor(puzzle.day)
  const best = bestSpeed(record)
  const streak = computeStreak(playedDays(), today.value)
  const lines = [
    `Galois #${puzzleNumber(puzzle.day)} · ${puzzle.day}`,
    best !== null ? `Speed ${formatTime(best)} s (best of ${SPEED_ATTEMPTS})` : 'Speed –',
    record.optimal ? `Optimal ${record.optimal.moves} moves (solver ${puzzle.solverLength})` : 'Optimal –',
    `Streak ${streak.current}`,
    'rj8228.github.io/galois',
  ]
  const text = lines.join('\n')
  return (
    <div class="card">
      <HelpHeading topic="share">Share</HelpHeading>
      <pre class="share">{text}</pre>
      <div class="row">
        <button
          type="button"
          class="btn small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        {'share' in navigator && (
          <button type="button" class="btn small" onClick={() => navigator.share({ text }).catch(() => undefined)}>
            Share…
          </button>
        )}
      </div>
    </div>
  )
}

export function Daily() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null)
  const [error, setError] = useState('')
  const [segment, setSegment] = useState<'speed' | 'optimal'>('speed')
  const day = today.value

  useEffect(() => {
    let cancelled = false
    setPuzzle(null)
    loadKPuzzle()
      .then((kp) => dailyPuzzle(kp, day))
      .then((p) => {
        if (!cancelled) setPuzzle(p)
      })
      .catch(() => setError("Today's scramble couldn't be prepared. Reload to try again."))
    return () => {
      cancelled = true
    }
  }, [day])

  return (
    <div class="stack">
      <div class="card">
        <HelpHeading topic="daily" level="h2">
          {`Solve of the Day #${puzzleNumber(day)}`}
        </HelpHeading>
        <p class="muted small">
          {day} · next puzzle in {formatCountdown(msUntilNextPuzzle(new Date(clock.value)))} (midnight IST)
        </p>
        {error && <p class="field-error">{error}</p>}
        {puzzle ? (
          <>
            <p class="mono scramble-text">{puzzle.scramble}</p>
            <button type="button" class="btn small" onClick={() => loadPosition(puzzle.scramble)}>
              Put the scramble on the cube
            </button>
          </>
        ) : (
          !error && <p class="muted">Preparing today's scramble…</p>
        )}
        <div class="seg" role="group" aria-label="Segment">
          <button type="button" aria-pressed={segment === 'speed'} onClick={() => setSegment('speed')}>
            Speed
          </button>
          <button type="button" aria-pressed={segment === 'optimal'} onClick={() => setSegment('optimal')}>
            Optimal
          </button>
        </div>
      </div>
      {puzzle &&
        (segment === 'speed' ? <SpeedCard puzzle={puzzle} /> : <OptimalCard key={puzzle.day} puzzle={puzzle} />)}
      <StreakCard />
      {puzzle && <ShareCard puzzle={puzzle} />}
      <BadgesCard />
    </div>
  )
}
