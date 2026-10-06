/** Days are counted in India Standard Time: a new puzzle drops at 00:00 IST for everyone. */
export const LAUNCH_DAY = '2026-10-07'
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** The IST calendar day ('YYYY-MM-DD') at a moment. */
export function istDay(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/** Puzzle #1 is launch day. */
export const puzzleNumber = (day: string) => daysBetween(LAUNCH_DAY, day) + 1

/** Milliseconds until the next 00:00 IST. */
export function msUntilNextPuzzle(now: Date = new Date()): number {
  const istNow = now.getTime() + IST_OFFSET_MS
  return DAY_MS - (istNow % DAY_MS)
}

export function formatCountdown(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** 41320 → "41.32", 83150 → "1:23.15". */
export function formatTime(ms: number): string {
  const centis = Math.floor(ms / 10)
  const minutes = Math.floor(centis / 6000)
  const seconds = Math.floor((centis % 6000) / 100)
  const cs = String(centis % 100).padStart(2, '0')
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}.${cs}` : `${seconds}.${cs}`
}
