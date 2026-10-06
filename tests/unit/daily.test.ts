import { describe, expect, it } from 'vitest'
import { addDays, formatTime, istDay, msUntilNextPuzzle, puzzleNumber } from '../../src/daily/date'
import { randomPositionData, seededRandom, seedFor } from '../../src/daily/scramble'
import { computeStreak } from '../../src/daily/streak'

describe('IST days', () => {
  it('switches to the new day at 00:00 IST (18:30 UTC)', () => {
    expect(istDay(new Date('2026-10-07T18:29:59Z'))).toBe('2026-10-07')
    expect(istDay(new Date('2026-10-07T18:30:00Z'))).toBe('2026-10-08')
  })
  it('counts down to the next puzzle', () => {
    expect(msUntilNextPuzzle(new Date('2026-10-07T18:00:00Z'))).toBe(30 * 60 * 1000)
  })
  it('numbers puzzles from launch day', () => {
    expect(puzzleNumber('2026-10-07')).toBe(1)
    expect(puzzleNumber(addDays('2026-10-07', 41))).toBe(42)
  })
  it('formats times', () => {
    expect(formatTime(41320)).toBe('41.32')
    expect(formatTime(83150)).toBe('1:23.15')
    expect(formatTime(5009)).toBe('5.00')
  })
})

describe('daily position', () => {
  it('is the same for the same day and different on another day', () => {
    const a = randomPositionData(seededRandom(seedFor('2026-10-07')))
    const b = randomPositionData(seededRandom(seedFor('2026-10-07')))
    const c = randomPositionData(seededRandom(seedFor('2026-10-08')))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })
  it('is always a legal position', () => {
    const parity = (p: number[]) => {
      const seen = new Set<number>()
      let s = 0
      for (let i = 0; i < p.length; i++) {
        let len = 0
        for (let j = i; !seen.has(j); j = p[j]) {
          seen.add(j)
          len++
        }
        if (len) s += len - 1
      }
      return s % 2
    }
    for (let d = 0; d < 200; d++) {
      const p = randomPositionData(seededRandom(seedFor(addDays('2026-10-07', d))))
      expect(parity(p.edges)).toBe(parity(p.corners))
      expect(p.edgeOrientation.reduce((a, b) => a + b, 0) % 2).toBe(0)
      expect(p.cornerOrientation.reduce((a, b) => a + b, 0) % 3).toBe(0)
    }
  })
})

describe('computeStreak', () => {
  const days = (start: string, n: number) => Array.from({ length: n }, (_, i) => addDays(start, i))

  it('counts consecutive days, and today does not break it yet', () => {
    const s = computeStreak(new Set(days('2026-10-01', 5)), '2026-10-06')
    expect(s.current).toBe(5)
  })
  it('resets after a missed day with no freeze', () => {
    const played = new Set([...days('2026-10-01', 3), ...days('2026-10-05', 2)])
    const s = computeStreak(played, '2026-10-06')
    expect(s.current).toBe(2)
    expect(s.best).toBe(3)
  })
  it('earns a freeze every 7 days and spends it on a missed day', () => {
    const played = new Set([...days('2026-10-01', 7), ...days('2026-10-09', 2)])
    const s = computeStreak(played, '2026-10-10')
    expect(s.current).toBe(9)
    expect(s.frozenDays).toEqual(['2026-10-08'])
    expect(s.freezes).toBe(0)
  })
  it('holds at most two freezes', () => {
    const s = computeStreak(new Set(days('2026-10-01', 28)), '2026-10-28')
    expect(s.freezes).toBe(2)
  })
})
