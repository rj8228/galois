import { effect, signal } from '@preact/signals'
import type { TwistyPlayer } from 'cubing/twisty'
import { RENDERINGS } from '../settings/rendering.ts'
import { settings } from '../settings/settings.ts'
import { initSolver, randomRemote, solveRemote } from './client.ts'
import type { FloorName, SolveReport } from './engine.ts'

export type Phase = 'loading' | 'ready' | 'searching' | 'proven' | 'error'

/** The 2×2 on the stage while the Solver is open (the 3×3 stays put underneath). */
export const solverPlayer = signal<TwistyPlayer | null>(null)
export const phase = signal<Phase>('loading')
export const error = signal('')
/** Positions on each ring, 0 to 11 moves from solved. */
export const rings = signal<number[]>([])
export const buildMs = signal(0)
/** The position: the moves that make it from solved, as you hold the cube. */
export const position = signal<string[]>([])
export const positionLabel = signal('Solved')
export const floor = signal<FloorName>('medium')
export const report = signal<SolveReport | null>(null)
/** The search is replayed at a watchable pace: rounds finished so far, and the live count of the current one. */
export const shownRounds = signal(0)
export const liveNodes = signal(0)
/** Moves of the solution played on the cube so far. */
export const played = signal(0)

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

// The 2×2 follows the same rendering and speed settings as the main cube.
effect(() => {
  const p = solverPlayer.value
  if (!p) return
  const s = settings.value
  const render = RENDERINGS.find((r) => r.id === s.render) ?? RENDERINGS[0]
  p.visualization = render.props.visualization === 'experimental-2D-LL' ? '3D' : render.props.visualization
  p.hintFacelets = render.props.hintFacelets
  p.backView = s.mirror
  p.tempoScale = s.speed
})

export async function initTables() {
  if (rings.value.length || phase.value === 'error') return
  try {
    const r = await initSolver()
    rings.value = r.rings
    buildMs.value = r.ms
    if (phase.value === 'loading') phase.value = 'ready'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    phase.value = 'error'
  }
}

let replayToken = 0

/**
 * Shows a new position and forgets any earlier result. With `from`, the cube starts at `from` and
 * animates the one move that remains, so a turn by hand looks like a turn.
 */
function setPosition(moves: string[], label: string, from?: string[]) {
  replayToken++
  position.value = moves
  positionLabel.value = label
  report.value = null
  played.value = 0
  shownRounds.value = 0
  liveNodes.value = 0
  if (phase.value !== 'error') phase.value = rings.value.length ? 'ready' : 'loading'
  const p = solverPlayer.value
  if (!p) return
  p.experimentalSetupAlg = (from ?? moves).join(' ')
  p.alg = ''
  if (from) p.experimentalAddMove(moves[moves.length - 1], { cancel: false })
}

/** What the cube shows right now, including any part of a solution already played. */
function shown(): string[] {
  const r = report.value
  return r ? [...position.value, ...r.solution.slice(0, played.value)] : position.value
}

export async function randomPosition(ring?: number) {
  const moves = await randomRemote(ring)
  const label =
    ring === undefined
      ? 'A random position'
      : ring === 11
        ? 'One of the 2,644 hardest positions'
        : `A random position ${ring} move${ring === 1 ? '' : 's'} out`
  setPosition(moves, label)
}

export const usePosition = (moves: string[]) => setPosition(moves, 'Your moves')

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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function countUp(target: number, ms: number, token: number): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const frame = (now: number) => {
      if (token !== replayToken) return resolve()
      const x = Math.min(1, (now - t0) / ms)
      liveNodes.value = Math.round(target * (1 - (1 - x) ** 3))
      if (x < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

/** Solves in the worker (a few milliseconds), then replays the search round by round so you can watch it. */
export async function solveNow() {
  if (!rings.value.length || phase.value === 'searching') return
  const token = ++replayToken
  report.value = null
  played.value = 0
  shownRounds.value = 0
  liveNodes.value = 0
  phase.value = 'searching'
  const p = solverPlayer.value
  if (p) {
    p.experimentalSetupAlg = position.value.join(' ')
    p.alg = ''
  }
  let r: SolveReport
  try {
    r = await solveRemote(position.value, floor.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    phase.value = 'error'
    return
  }
  if (token !== replayToken) return
  report.value = r
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  for (let i = 0; i < r.rounds.length; i++) {
    const n = r.rounds[i].nodes
    await countUp(n, calm ? 0 : Math.min(1500, 500 + 160 * Math.log10(n + 1)), token)
    if (token !== replayToken) return
    shownRounds.value = i + 1
    if (!calm) await wait(300)
  }
  if (token !== replayToken) return
  phase.value = 'proven'
  playSolution()
}

/** Plays the proven solution on the cube from the start. */
export function playSolution() {
  const p = solverPlayer.value
  const r = report.value
  if (!p || !r) return
  p.experimentalSetupAlg = position.value.join(' ')
  p.alg = r.solution.join(' ')
  p.jumpToStart()
  played.value = 0
  if (r.solution.length) p.play()
}

export function stepSolution(direction: 1 | -1) {
  const p = solverPlayer.value
  if (!p || !report.value) return
  p.pause()
  p.controller.animationController.play({ direction: direction as never, untilBoundary: 'move' as never })
}

export const toggleSolverPlay = () => solverPlayer.value?.togglePlay()
