import { describe, expect, it } from 'vitest'
import { FLOOR_TABLE, NETWORKS, OVERESTIMATES, REFERENCES } from '../../src/paper/data'
import { share } from '../../src/paper/figures'
import { EXAMPLE, FLOOR_WORK, RING_COUNTS, TOTAL_POSITIONS } from '../../src/solver/report'

/** Move sequences of at most n moves that never turn the same face twice in a row (9 moves, then 6 choices). */
const sequencesUpTo = (n: number) => {
  let total = 1
  for (let k = 1; k <= n; k++) total += 9 * 6 ** (k - 1)
  return total
}

describe('numbers quoted in the Paper', () => {
  it('counts positions and sequences as the text says', () => {
    expect(5040 * 729).toBe(TOTAL_POSITIONS)
    expect(RING_COUNTS.reduce((a, b) => a + b, 0)).toBe(TOTAL_POSITIONS)
    expect(sequencesUpTo(9)).toBe(18_139_852)
    // Too few sequences of 8 moves or fewer to reach every position: God's number is at least 9.
    expect(sequencesUpTo(8)).toBe(3_023_308)
    expect(sequencesUpTo(8)).toBeLessThan(TOTAL_POSITIONS)
    expect(Math.round(((RING_COUNTS[9] + RING_COUNTS[10]) / TOTAL_POSITIONS) * 100)).toBe(68)
    expect(RING_COUNTS.slice(0, 5).reduce((a, b) => a + b, 0)).toBe(2_232)
  })

  it('agrees with the Solver about the floors and the worked example', () => {
    for (const row of FLOOR_TABLE) {
      const work = FLOOR_WORK.find((f) => f.name === row.name && f.size === row.memory)
      if (work) expect(row.nodes).toBe(work.nodes)
    }
    expect(FLOOR_TABLE.filter((r) => r.plot)).toHaveLength(6)
    const total = EXAMPLE.rounds.reduce((a, r) => a + r.nodes, 0)
    expect(total).toBe(285_477)
    expect(Math.round(EXAMPLE.weak.nodes / total)).toBe(15)
    expect(Math.round(EXAMPLE.weak.nodes / EXAMPLE.strong.nodes / 100) * 100).toBe(6_500)
  })

  it('formats shares with enough digits for the small rings', () => {
    expect(share(RING_COUNTS[9])).toBe('51.4%')
    expect(share(RING_COUNTS[11])).toBe('0.07%')
    expect(share(RING_COUNTS[0])).toBe('under 0.01%')
  })

  it('has complete tables and references', () => {
    expect(NETWORKS.map((n) => n.name)).toEqual(['A', 'B', 'C', 'D', 'E'])
    for (const o of OVERESTIMATES) {
      const sum = [o.optimal, o.tooLong, o.gaveUp].reduce((a, p) => a + Number.parseFloat(p), 0)
      expect(sum).toBeCloseTo(100, 0)
    }
    for (const r of REFERENCES) if (r.url) expect(r.url).toMatch(/^https:\/\//)
  })
})
