import { effect, signal } from '@preact/signals'
import { kpuzzle } from '../analysis/kpuzzle.ts'
import { history, loadPosition, locked, scramble } from '../cube/state.ts'
import { award } from './badges.ts'
import { recordFor, SPEED_ATTEMPTS, updateDay } from './store.ts'

export const INSPECTION_MS = 15_000

/**
 * A Speed attempt: inspect for up to 15 s, then the timer runs from your first turn
 * (or when inspection runs out) until the cube is solved.
 */
export type Session =
  | { phase: 'idle' }
  | { phase: 'inspecting'; day: string; scramble: string; startedAt: number; ranked: boolean }
  | { phase: 'solving'; day: string; scramble: string; startedAt: number; ranked: boolean }
  | { phase: 'done'; day: string; ms: number | null; ranked: boolean }

export const session = signal<Session>({ phase: 'idle' })
/** Ticks while a session is live so the timer redraws. */
export const now = signal(Date.now())

let ticker: number | undefined
function tick() {
  now.value = Date.now()
  const s = session.value
  if (s.phase === 'inspecting' && now.value - s.startedAt >= INSPECTION_MS) {
    session.value = { ...s, phase: 'solving', startedAt: s.startedAt + INSPECTION_MS }
  }
  if (s.phase === 'inspecting' || s.phase === 'solving') ticker = requestAnimationFrame(tick)
}

export function startAttempt(day: string, scrambleAlg: string) {
  const ranked = recordFor(day).speed.length < SPEED_ATTEMPTS
  loadPosition(scrambleAlg)
  locked.value = true
  session.value = { phase: 'inspecting', day, scramble: scrambleAlg, startedAt: Date.now(), ranked }
  cancelAnimationFrame(ticker ?? 0)
  ticker = requestAnimationFrame(tick)
}

function finish(ms: number | null) {
  const s = session.value
  if (s.phase !== 'inspecting' && s.phase !== 'solving') return
  locked.value = false
  cancelAnimationFrame(ticker ?? 0)
  session.value = { phase: 'done', day: s.day, ms, ranked: s.ranked }
  if (!s.ranked) return
  updateDay(s.day, (r) => ({ ...r, speed: [...r.speed, { ms, at: new Date().toISOString() }] }))
  if (ms !== null) {
    award('first-solve', s.day)
    if (ms < 60_000) award('sub-60', s.day)
    if (ms < 30_000) award('sub-30', s.day)
  }
}

export const giveUp = () => finish(null)

export function closeSession() {
  if (session.value.phase === 'done') session.value = { phase: 'idle' }
}

// The first turn during inspection starts the clock; a solved cube stops it.
let lastLength = 0
effect(() => {
  const moves = history.value
  const s = session.value
  if (s.phase === 'idle' || s.phase === 'done') {
    lastLength = moves.length
    return
  }
  if (moves.length === lastLength) return
  lastLength = moves.length
  if (s.phase === 'inspecting') session.value = { ...s, phase: 'solving', startedAt: Date.now() }
  const kp = kpuzzle.value
  if (!kp) return
  const solved = kp.defaultPattern()
  const position = solved.applyAlg([scramble.value, ...moves].join(' '))
  if (position.isIdentical(solved)) {
    const current = session.value
    if (current.phase === 'solving') finish(Date.now() - current.startedAt)
  }
})
