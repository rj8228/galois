import { route } from '../app/router.ts'
import { stepSolution, toggleSolverPlay, turnSolver, undoSolver } from '../solver/state.ts'
import { FACES, SLICES_AND_ROTATIONS } from './notation.ts'
import { step, togglePlay, turn, undo } from './state.ts'

const LETTERS = new Map<string, string>([...FACES, ...SLICES_AND_ROTATIONS].map((m) => [m.toUpperCase(), m]))
const FACE_SET = new Set<string>(FACES)

/**
 * Laptop shortcuts: a face letter turns it, Shift makes it prime, Alt/Option makes it a double.
 * Ctrl/Cmd+Z undoes, Space plays or pauses, arrow keys step. In the Solver they drive the 2×2,
 * which has no slices.
 */
export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
    const solver = route.value === 'solver'
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (solver) undoSolver()
      else undo()
      return
    }
    if (e.metaKey || e.ctrlKey) return
    if (e.key === ' ' && !target?.closest('button')) {
      e.preventDefault()
      if (solver) toggleSolverPlay()
      else togglePlay()
      return
    }
    if (e.key === 'ArrowRight') return solver ? stepSolution(1) : step(1)
    if (e.key === 'ArrowLeft') return solver ? stepSolution(-1) : step(-1)
    // e.code is layout-independent and unaffected by Option on macOS.
    const letter = e.code.startsWith('Key') ? e.code.slice(3) : ''
    const base = LETTERS.get(letter)
    if (!base || (solver && !FACE_SET.has(base))) return
    e.preventDefault()
    const move = base + (e.altKey ? '2' : e.shiftKey ? "'" : '')
    if (solver) turnSolver(move)
    else turn(move)
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
