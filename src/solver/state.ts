import { effect, signal } from '@preact/signals'
import type { TwistyPlayer } from 'cubing/twisty'
import { RENDERINGS } from '../settings/rendering.ts'
import { settings } from '../settings/settings.ts'
import { compareRemote, initSolver, solveRemote } from './client.ts'
import { parseMoves } from './cube2.ts'
import type { Comparison, FloorName, SolveReport } from './engine.ts'
import { HARDEST } from './hardest.ts'

export type Phase = 'loading' | 'ready' | 'searching' | 'proven' | 'error'
export type Speed = 'slow' | 'normal'
/** 'one': solve a position you pick. 'all': the whole cube and how the solver works, from the lab's results. */
export type Mode = 'one' | 'all'

export const mode = signal<Mode>('one')

/** The 2×2 on the stage while the Solver is open (the 3×3 stays put underneath). */
export const solverPlayer = signal<TwistyPlayer | null>(null)
export const phase = signal<Phase>('loading')
export const error = signal('')
/** Time to build the move tables and small floors, and the strong floor when first used. */
export const buildMs = signal(0)
export const strongMs = signal(0)
/** The position: the moves that make it from solved, as you hold the cube. */
export const position = signal<string[]>([])
export const positionLabel = signal('Solved')
export const floor = signal<FloorName>('medium')
export const report = signal<SolveReport | null>(null)
/** The search is replayed at a watchable pace: rounds finished so far, and the live count of the current one. */
export const shownRounds = signal(0)
export const liveNodes = signal(0)
/** Moves of the solution played on the cube so far, and whether the slow-motion playback is running. */
export const played = signal(0)
export const playing = signal(false)
export const speed = signal<Speed>('slow')
export const comparison = signal<Comparison | null>(null)
export const comparing = signal(false)

const TEMPO: Record<Speed, number> = { slow: 0.55, normal: 1.6 }
const PAUSE: Record<Speed, number> = { slow: 700, normal: 120 }

let creating: Promise<TwistyPlayer> | null = null

export function createSolverPlayer(): Promise<TwistyPlayer> {
  creating ??= import('cubing/twisty').then(({ TwistyPlayer }) => {
    const p = new TwistyPlayer({ puzzle: '2x2x2', background: 'none', controlPanel: 'none', colorScheme: 'light' })
    p.experimentalSetupAlg = position.value.join(' ')
    p.experimentalModel.currentLeavesSimplified.addFreshListener((leaves) => {
      if (report.value) played.value = leaves.patternIndex
    })
    solverPlayer.value = p
    return p
  })
  return creating
}

// The 2×2 follows the rendering settings of the main cube; its speed is the Solver's own.
effect(() => {
  const p = solverPlayer.value
  if (!p) return
  const s = settings.value
  const render = RENDERINGS.find((r) => r.id === s.render) ?? RENDERINGS[0]
  p.visualization = render.props.visualization === 'experimental-2D-LL' ? '3D' : render.props.visualization
  p.hintFacelets = render.props.hintFacelets
  p.backView = s.mirror
  p.tempoScale = TEMPO[speed.value]
})

export async function initTables() {
  if (phase.value !== 'loading') return
  try {
    buildMs.value = await initSolver()
    if (phase.value === 'loading') phase.value = 'ready'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    phase.value = 'error'
  }
}

/** Bumped whenever something new starts, so an older replay or playback stops. */
let token = 0

/**
 * Shows a new position and forgets any earlier result. With `from`, the cube starts at `from` and
 * animates the one move that remains, so a turn by hand looks like a turn.
 */
function setPosition(moves: string[], label: string, from?: string[]) {
  token++
  playing.value = false
  position.value = moves
  positionLabel.value = label
  report.value = null
  comparison.value = null
  played.value = 0
  shownRounds.value = 0
  liveNodes.value = 0
  if (phase.value !== 'error' && phase.value !== 'loading') phase.value = 'ready'
  const p = solverPlayer.value
  if (!p) return
  p.pause()
  p.experimentalSetupAlg = (from ?? moves).join(' ')
  p.alg = ''
  if (from) p.experimentalAddMove(moves[moves.length - 1], { cancel: false })
}

/** What the cube shows right now, including any part of a solution already played. */
function shown(): string[] {
  const r = report.value
  return r ? [...position.value, ...r.solution.slice(0, played.value)] : position.value
}

/** A random-state scramble, the kind used in competitions (made by cubing.js). */
export async function randomPosition() {
  const { randomScrambleForEvent } = await import('cubing/scramble')
  const alg = (await randomScrambleForEvent('222')).toString()
  setPosition(parseMoves(alg) ?? [], 'A random position')
}

/** n random face turns, never the same face twice in a row. The solver then finds the real distance. */
export function scramblePosition(n: number) {
  const faces = ['U', 'D', 'L', 'R', 'F', 'B']
  const moves: string[] = []
  let last = ''
  while (moves.length < n) {
    const f = faces[Math.floor(Math.random() * faces.length)]
    if (f === last) continue
    last = f
    moves.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)])
  }
  setPosition(moves, `${n} random moves`)
}

export function hardestPosition() {
  const alg = HARDEST[Math.floor(Math.random() * HARDEST.length)]
  setPosition(parseMoves(alg) ?? [], 'One of the 2,644 hardest positions')
}

export const usePosition = (moves: string[]) => setPosition(moves, 'Your moves')

/** Sets up the Solver on a position and floor from elsewhere, such as the Paper's worked example. */
export function openInSolver(moves: string[], label: string, f: FloorName) {
  mode.value = 'one'
  floor.value = f
  setPosition(moves, label)
}

/** Turns the 2×2 by hand, carrying on from whatever the cube shows. */
export function turnSolver(move: string) {
  const base = shown()
  setPosition([...base, move], 'Your moves', base)
}

export function undoSolver() {
  const base = shown()
  if (base.length) setPosition(base.slice(0, -1), base.length > 1 ? 'Your moves' : 'Solved')
}

export const resetSolver = () => setPosition([], 'Solved')

export function chooseFloor(f: FloorName) {
  floor.value = f
  if (report.value) setPosition(position.value, positionLabel.value)
}

export function chooseSpeed(s: Speed) {
  speed.value = s
}

export function chooseMode(m: Mode) {
  if (m === 'all') pauseSolution()
  mode.value = m
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function countUp(target: number, ms: number, mine: number): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const frame = (now: number) => {
      if (mine !== token) return resolve()
      const x = ms ? Math.min(1, (now - t0) / ms) : 1
      liveNodes.value = Math.round(target * (1 - (1 - x) ** 3))
      if (x < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

/**
 * Searches this one position (a few milliseconds in the worker), replays the search round by
 * round so you can watch it, then plays the proven solution in slow motion.
 */
export async function solveNow() {
  if (phase.value === 'loading' || phase.value === 'searching') return
  const mine = ++token
  playing.value = false
  report.value = null
  comparison.value = null
  played.value = 0
  shownRounds.value = 0
  liveNodes.value = 0
  phase.value = 'searching'
  const p = solverPlayer.value
  if (p) {
    p.pause()
    p.experimentalSetupAlg = position.value.join(' ')
    p.alg = ''
  }
  let r: SolveReport
  try {
    const res = await solveRemote(position.value, floor.value)
    r = res.report
    if (res.buildMs) strongMs.value = res.buildMs
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    phase.value = 'error'
    return
  }
  if (mine !== token) return
  report.value = r
  for (let i = 0; i < r.rounds.length; i++) {
    const n = r.rounds[i].nodes
    await countUp(n, calm() ? 0 : Math.min(1500, 500 + 160 * Math.log10(n + 1)), mine)
    if (mine !== token) return
    shownRounds.value = i + 1
    if (!calm()) await wait(300)
  }
  if (mine !== token) return
  phase.value = 'proven'
  await wait(calm() ? 0 : 500)
  if (mine === token) playSolution()
}

/** Waits until a move has finished animating (or a safety timeout passes). */
async function moveDone(target: number, mine: number) {
  const until = performance.now() + 4000
  while (played.value < target && mine === token && performance.now() < until) await wait(40)
}

/** Steps through the solution from move `from`, pausing after each move so you can follow it. */
async function runFrom(from: number, mine: number) {
  const p = solverPlayer.value
  const r = report.value
  if (!p || !r) return
  playing.value = true
  for (let i = from; i < r.solution.length; i++) {
    if (mine !== token) return
    p.tempoScale = TEMPO[speed.value]
    p.controller.animationController.play({ direction: 1 as never, untilBoundary: 'move' as never })
    await moveDone(i + 1, mine)
    if (mine !== token) return
    played.value = i + 1
    await wait(calm() ? 0 : PAUSE[speed.value])
  }
  if (mine === token) playing.value = false
}

/** Plays the proven solution from the start, in slow motion unless you chose Normal. */
export async function playSolution() {
  const p = solverPlayer.value
  const r = report.value
  if (!p || !r) return
  const mine = ++token
  p.pause()
  p.experimentalSetupAlg = position.value.join(' ')
  p.alg = r.solution.join(' ')
  p.jumpToStart()
  played.value = 0
  playing.value = r.solution.length > 0
  await wait(calm() ? 0 : 400)
  if (mine === token) await runFrom(0, mine)
}

/** Pauses the playback where it is. */
export function pauseSolution() {
  token++
  playing.value = false
  solverPlayer.value?.pause()
}

/** Carries on playing from the current move (or from the start, if it had finished). */
export function resumeSolution() {
  const r = report.value
  if (!r) return
  if (played.value >= r.solution.length) return playSolution()
  return runFrom(played.value, ++token)
}

export function stepSolution(direction: 1 | -1) {
  const p = solverPlayer.value
  if (!p || !report.value) return
  pauseSolution()
  p.controller.animationController.play({ direction: direction as never, untilBoundary: 'move' as never })
}

export function toggleSolverPlay() {
  if (playing.value) pauseSolution()
  else if (report.value) resumeSolution()
}

export async function compareNow() {
  if (!report.value || comparing.value) return
  comparing.value = true
  try {
    comparison.value = await compareRemote(position.value)
  } finally {
    comparing.value = false
  }
}
