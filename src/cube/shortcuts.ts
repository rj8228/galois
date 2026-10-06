import { FACES, SLICES_AND_ROTATIONS } from './notation.ts'
import { step, togglePlay, turn, undo } from './state.ts'

const LETTERS = new Map<string, string>([...FACES, ...SLICES_AND_ROTATIONS].map((m) => [m.toUpperCase(), m]))

/**
 * Laptop shortcuts: a face letter turns it, Shift makes it prime, Alt/Option makes it a double.
 * Ctrl/Cmd+Z undoes, Space plays or pauses, arrow keys step.
 */
export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      undo()
      return
    }
    if (e.metaKey || e.ctrlKey) return
    if (e.key === ' ' && !target?.closest('button')) {
      e.preventDefault()
      togglePlay()
      return
    }
    if (e.key === 'ArrowRight') return step(1)
    if (e.key === 'ArrowLeft') return step(-1)
    // e.code is layout-independent and unaffected by Option on macOS.
    const letter = e.code.startsWith('Key') ? e.code.slice(3) : ''
    const base = LETTERS.get(letter)
    if (!base) return
    e.preventDefault()
    turn(base + (e.altKey ? '2' : e.shiftKey ? "'" : ''))
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
