import { effect, signal } from '@preact/signals'
import type { TwistyPlayer } from 'cubing/twisty'
import { RENDERINGS } from '../settings/rendering.ts'
import { settings } from '../settings/settings.ts'

/** The one cube shown on the stage on every screen. */
export const player = signal<TwistyPlayer | null>(null)
/** The starting position (a scramble), or '' for solved. */
export const scramble = signal('')
/** Every move made since the scramble, in order. */
export const history = signal<string[]>([])
export const playing = signal(false)
export const looping = signal(false)
export const notice = signal('')
/** A cubing.js stickering mask that overrides the Settings stickering (focus mode, piece tracker). */
export const highlight = signal<string | null>(null)

let creating: Promise<TwistyPlayer> | null = null

export function createPlayer(): Promise<TwistyPlayer> {
  creating ??= import('cubing/twisty').then(({ TwistyPlayer }) => {
    // colorScheme 'light' keeps the player transparent; its 'dark' scheme paints its own grey backdrop.
    const p = new TwistyPlayer({ puzzle: '3x3x3', background: 'none', controlPanel: 'none', colorScheme: 'light' })
    p.experimentalModel.playingInfo.addFreshListener((info) => {
      playing.value = info.playing
    })
    player.value = p
    return p
  })
  return creating
}

// Keep the player in step with Settings.
effect(() => {
  const p = player.value
  if (!p) return
  const s = settings.value
  const render = RENDERINGS.find((r) => r.id === s.render) ?? RENDERINGS[0]
  p.visualization = render.props.visualization
  p.hintFacelets = render.props.hintFacelets
  p.backView = s.mirror
  // A highlight (focus mode or the piece tracker) wins over the stickering chosen in Settings.
  p.experimentalStickering = s.stickering
  p.experimentalStickeringMaskOrbits = (highlight.value ?? null) as never
  p.tempoScale = s.speed
})

/** Shows the scramble plus history, at rest. */
function sync() {
  const p = player.value
  if (!p) return
  looping.value = false
  p.experimentalSetupAlg = scramble.value
  p.alg = history.value.join(' ')
  p.jumpToEnd()
}

export function turn(move: string) {
  const p = player.value
  if (!p) return
  if (looping.value) sync()
  p.experimentalAddMove(move, { cancel: false })
  history.value = [...history.value, move]
}

export function undo() {
  if (history.value.length === 0) return
  history.value = history.value.slice(0, -1)
  sync()
}

export function reset() {
  scramble.value = ''
  history.value = []
  notice.value = ''
  sync()
}

export async function newScramble() {
  if (!player.value) return
  notice.value = 'Making a random-state scramble…'
  const { randomScrambleForEvent } = await import('cubing/scramble')
  const alg = await randomScrambleForEvent('333')
  scramble.value = alg.toString()
  history.value = []
  notice.value = ''
  sync()
}

/** Animates a sequence from the current position and adds it to the history. */
export function playSequence(moves: string[]) {
  const p = player.value
  if (!p) return
  looping.value = false
  p.experimentalSetupAlg = [scramble.value, ...history.value].join(' ')
  p.alg = moves.join(' ')
  p.jumpToStart()
  p.controller.animationController.play({ untilBoundary: 'entire-timeline' as never })
  history.value = [...history.value, ...moves]
}

/** Repeats a sequence forever as a demonstration; the history is left unchanged. */
export function loopSequence(moves: string[]) {
  const p = player.value
  if (!p) return
  p.experimentalSetupAlg = [scramble.value, ...history.value].join(' ')
  p.alg = moves.join(' ')
  p.jumpToStart()
  looping.value = true
  p.controller.animationController.play({ untilBoundary: 'entire-timeline' as never, loop: true })
}

export function stopLoop() {
  if (looping.value) sync()
}

export function togglePlay() {
  player.value?.togglePlay()
}

/** Steps one move through the timeline on the stage without changing the history. */
export function step(direction: 1 | -1) {
  const p = player.value
  if (!p) return
  p.pause()
  p.controller.animationController.play({ direction: direction as never, untilBoundary: 'move' as never })
}
