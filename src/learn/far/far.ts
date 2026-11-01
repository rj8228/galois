/**
 * How many 3×3 positions lie at each face-turn distance from solved (half-turn metric), from
 * cube20.org (Rokicki, Kociemba, Davidson and Dethridge). Distances 0–15 are exact counts;
 * 16–20 are the site's estimates. Nothing lies beyond 20: God's number, proved in 2010.
 */
export type Ring = { distance: number; count: bigint; exact: boolean }

const EXACT: string[] = [
  '1',
  '18',
  '243',
  '3240',
  '43239',
  '574908',
  '7618438',
  '100803036',
  '1332343288',
  '17596479795',
  '232248063316',
  '3063288809012',
  '40374425656248',
  '531653418284628',
  '6989320578825358',
  '91365146187124313',
]

/** cube20.org's estimates for the outer rings ("~" on the site). */
const ESTIMATED: string[] = [
  '1100000000000000000',
  '12000000000000000000',
  '29000000000000000000',
  '1500000000000000000',
  '490000000',
]

export const RINGS: Ring[] = [
  ...EXACT.map((c, d) => ({ distance: d, count: BigInt(c), exact: true })),
  ...ESTIMATED.map((c, i) => ({ distance: EXACT.length + i, count: BigInt(c), exact: false })),
]

/** Every position of the 3×3: 8! · 3^7 · 12! · 2^11 / 2. */
export const TOTAL = 43252003274489856000n

export const SOURCE = 'https://cube20.org/'

const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** "574,908" for exact counts; "≈ 1.1 × 10¹⁸" or "≈ 490 million" for estimates. */
export function formatCount(r: Ring): string {
  if (r.exact) return r.count.toLocaleString('en-US')
  const s = r.count.toString()
  if (s.length <= 12) {
    const millions = Number(r.count / 1_000_000n)
    return `≈ ${millions.toLocaleString('en-US')} million`
  }
  const exp = s.length - 1
  const lead = Number(`${s[0]}.${s.slice(1, 3)}`)
  const mantissa = Number.isInteger(lead) ? String(lead) : String(Math.round(lead * 10) / 10)
  return `≈ ${mantissa} × 10${[...String(exp)].map((ch) => SUPER[Number(ch)]).join('')}`
}
