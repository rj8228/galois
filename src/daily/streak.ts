import { addDays, daysBetween } from './date.ts'

export type Streak = {
  current: number
  best: number
  /** Streak freezes in hand: one is earned for every 7 days in a row, holding at most 2. */
  freezes: number
  /** Missed days that a freeze covered. */
  frozenDays: string[]
}

export const MAX_FREEZES = 2

/**
 * Walks every day from the first one played up to today. A played day extends the streak; a missed
 * day uses a freeze if one is held, otherwise the streak resets. Today doesn't count as missed yet.
 */
export function computeStreak(played: Set<string>, today: string): Streak {
  const days = [...played].filter((d) => d <= today).sort()
  if (days.length === 0) return { current: 0, best: 0, freezes: 0, frozenDays: [] }
  let current = 0
  let best = 0
  let freezes = 0
  let frozenDays: string[] = []
  const span = daysBetween(days[0], today)
  for (let i = 0; i <= span; i++) {
    const day = addDays(days[0], i)
    if (played.has(day)) {
      current++
      best = Math.max(best, current)
      if (current % 7 === 0) freezes = Math.min(MAX_FREEZES, freezes + 1)
    } else if (day === today) {
      // Still time to play today.
    } else if (freezes > 0) {
      freezes--
      frozenDays = [...frozenDays, day]
    } else {
      current = 0
      frozenDays = []
    }
  }
  return { current, best, freezes, frozenDays }
}
