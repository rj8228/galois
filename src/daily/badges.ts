import { effect, signal } from '@preact/signals'

export type BadgeId = 'first-solve' | 'sub-60' | 'sub-30' | 'twenty' | 'beat-machine' | 'week' | 'galois' | 'order-1260'

/** Badges are named after the maths where they can be. */
export const BADGES: { id: BadgeId; name: string; how: string }[] = [
  { id: 'first-solve', name: 'Identity', how: 'Finish your first Solve of the Day.' },
  { id: 'sub-60', name: 'Under a minute', how: 'A Speed solve under 60 seconds.' },
  { id: 'sub-30', name: 'Under 30', how: 'A Speed solve under 30 seconds.' },
  { id: 'twenty', name: 'Twenty', how: "An Optimal solution of 20 moves or fewer, God's number." },
  { id: 'beat-machine', name: 'Beat the machine', how: "An Optimal solution shorter than Galois's solver found." },
  { id: 'week', name: 'Cyclic group of order 7', how: 'A 7-day streak.' },
  { id: 'galois', name: 'Galois', how: 'A 30-day streak.' },
  { id: 'order-1260', name: 'Order 1260', how: 'Find a sequence of the largest possible order, 1260, in Play.' },
]

const KEY = 'galois.badges.v1'

function load(): Partial<Record<BadgeId, string>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** Earned badges and the day each was earned. */
export const earned = signal<Partial<Record<BadgeId, string>>>(load())
/** The most recently earned badge, for a short celebration. */
export const justEarned = signal<BadgeId | null>(null)

effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(earned.value))
  } catch {
    // Not saved.
  }
})

export function award(id: BadgeId, day: string) {
  if (earned.value[id]) return
  earned.value = { ...earned.value, [id]: day }
  justEarned.value = id
}
