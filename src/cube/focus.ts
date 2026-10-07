import { kpuzzle } from '../analysis/kpuzzle.ts'
import { affectedPieces, analyse, highlightMask } from '../engine/analysis.ts'
import { highlight, playSequence, reset } from './state.ts'

/** Play a sequence from solved, dimming every piece it leaves alone. */
export function playWithFocus(sequence: string) {
  reset()
  const kp = kpuzzle.value
  if (kp) highlight.value = highlightMask(affectedPieces(analyse(kp, sequence)))
  playSequence(sequence.split(' '))
}
