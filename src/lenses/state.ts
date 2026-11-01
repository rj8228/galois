import { effect, signal } from '@preact/signals'

const KEY = 'galois.lens'

function load(): string {
  try {
    return localStorage.getItem(KEY) ?? 'cube'
  } catch {
    return 'cube'
  }
}

/** The lens shown on the Play stage. Remembered per device; an unknown id falls back to the cube. */
export const activeLens = signal(load())

effect(() => {
  const id = activeLens.value
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Storage can be unavailable (private windows); the choice then lasts for the visit.
  }
})
