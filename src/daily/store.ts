import { effect, signal } from '@preact/signals'

/** A Speed attempt: time in ms, or null for a DNF (did not finish). */
export type SpeedAttempt = { ms: number | null; at: string }

export type DayRecord = {
  speed: SpeedAttempt[]
  optimal?: { solution: string; moves: number; at: string }
  /** Unsubmitted Optimal solution, kept while you work on it. */
  draft?: string
}

export const SPEED_ATTEMPTS = 3

const KEY = 'galois.daily.v1'

function load(): Record<string, DayRecord> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const records = signal<Record<string, DayRecord>>(load())

effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.value))
  } catch {
    // Not saved; results last for this visit only.
  }
})

export const recordFor = (day: string): DayRecord => records.value[day] ?? { speed: [] }

export function updateDay(day: string, change: (r: DayRecord) => DayRecord) {
  records.value = { ...records.value, [day]: change(recordFor(day)) }
}

export const bestSpeed = (r: DayRecord): number | null => {
  const times = r.speed.map((a) => a.ms).filter((ms): ms is number => ms !== null)
  return times.length ? Math.min(...times) : null
}

/** A day counts towards the streak once you finish a Speed solve or submit an Optimal solution. */
export const playedDays = (): Set<string> =>
  new Set(
    Object.entries(records.value)
      .filter(([, r]) => r.optimal || r.speed.some((a) => a.ms !== null))
      .map(([day]) => day),
  )
