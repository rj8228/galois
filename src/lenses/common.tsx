import type { KPuzzle } from 'cubing/kpuzzle'
import type { ComponentChildren } from 'preact'
import { useEffect } from 'preact/hooks'
import { kpuzzle, loadKPuzzle } from '../analysis/kpuzzle.ts'
import { parseSequence } from '../cube/notation.ts'
import { sequenceText } from '../cube/SequenceBar.tsx'

export type LensInput = { ok: true; kp: KPuzzle; moves: string[]; text: string } | { ok: false; message: string }

/** The sequence box, parsed, with the 3×3 model loaded: what every "See" lens starts from. */
export function useSequence(): LensInput {
  useEffect(() => {
    loadKPuzzle()
  }, [])
  const kp = kpuzzle.value
  const text = sequenceText.value.trim()
  if (!kp) return { ok: false, message: 'Loading the cube…' }
  if (!text) return { ok: false, message: 'Type a sequence in the box below to see it here.' }
  const parsed = parseSequence(text)
  if (!parsed.ok) return { ok: false, message: 'Fix the sequence below to see it here.' }
  return { ok: true, kp, moves: parsed.moves, text: parsed.moves.join(' ') }
}

/** The line a lens shows instead of its drawing while there's nothing to draw. */
export function LensNote({ children }: { children: ComponentChildren }) {
  return <p class="lens-note">{children}</p>
}

/** The sequence and a tag (its order, or the tracked piece) above a lens's drawing. */
export function LensHead({ text, tag }: { text: string; tag: string }) {
  return (
    <div class="lens-head">
      <span class="lens-seq mono">{text}</span>
      <span class="lens-tag mono">{tag}</span>
    </div>
  )
}

/** One of a lens card's big numbers, with what it counts. */
export function LensStat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div class="lens-stat">
      <span class={tone ? `lens-stat-value tone-${tone}` : 'lens-stat-value'}>{value}</span>
      <span class="lens-stat-label">{label}</span>
    </div>
  )
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
export const lcm = (a: number, b: number) => (a * b) / gcd(a, b)
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Notation with typographic primes, as the rest of the app prints it. */
export const pretty = (moves: string) => moves.replaceAll("'", '′')
