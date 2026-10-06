import { effect, signal } from '@preact/signals'

/** Per lesson: the furthest step reached and whether the lesson was finished. Stored on the device. */
export type LessonProgress = { reached: number; complete: boolean }

const KEY = 'galois.progress.v1'

function load(): Record<string, LessonProgress> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const progress = signal<Record<string, LessonProgress>>(load())

effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress.value))
  } catch {
    // Not saved; progress lasts for this visit only.
  }
})

export function markReached(lessonId: string, step: number, complete = false) {
  const prev = progress.value[lessonId] ?? { reached: 0, complete: false }
  progress.value = {
    ...progress.value,
    [lessonId]: { reached: Math.max(prev.reached, step), complete: prev.complete || complete },
  }
}

export function resetProgress() {
  progress.value = {}
}
