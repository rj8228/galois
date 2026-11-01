import './far.css'
import { useState } from 'preact/hooks'
import { href } from '../../app/router.ts'
import { formatCount, RINGS, SOURCE } from './far.ts'

const SIZE = 358
const C = SIZE / 2
const STEP = 8.1
const FIRST = 5

/** Lesson 12: every position, sorted into rings by its distance from solved. */
export function FarWidget() {
  const [all, setAll] = useState(false)
  const shown = RINGS.filter((r) => r.distance >= 1 && (all || r.distance <= FIRST))
  const edge = RINGS[20]
  return (
    <div class="far-widget">
      <svg
        class="far-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Twenty rings around the solved position, one for each distance. Rings 1 to 15 are drawn solid: their counts are exact. Rings 16 to 20 are dashed: their counts are estimates. Ring 20 is the outer edge."
      >
        {RINGS.slice(1).map((r) => {
          const early = r.distance <= FIRST
          const last = r.distance === 20
          return (
            <circle
              key={r.distance}
              cx={C}
              cy={C}
              r={8 + r.distance * STEP}
              fill="none"
              stroke-width={last ? 2.4 : early ? 1.6 : 1}
              stroke-dasharray={r.exact ? undefined : '3 3'}
              class={last ? 'far-ring-edge' : early ? 'far-ring-early' : 'far-ring'}
            />
          )
        })}
        <circle cx={C} cy={C} r="6" class="far-centre" />
        <text x={C + 92} y={30} text-anchor="middle" font-size="12" font-weight="600" class="far-label-edge">
          20
        </text>
        <text x={C + 24} y={C - 40} text-anchor="middle" font-size="10" class="far-label">
          5
        </text>
        <text x={C} y={C - 8 - 15.5 * STEP} text-anchor="middle" font-size="9" class="far-label-muted">
          15
        </text>
      </svg>
      <div class="far-card">
        <p class="far-text">
          Every position, sorted by how many face turns it needs. Each early ring holds about 13 times the one inside
          it, yet nothing lies past ring 20.
        </p>
        <table class="far-table">
          <caption class="sr-only">Positions at each distance from solved</caption>
          <tbody>
            {shown.map((r) => (
              <tr key={r.distance}>
                <th scope="row">ring {r.distance}</th>
                <td>
                  {formatCount(r)}
                  {!r.exact && <span class="far-est"> estimate</span>}
                </td>
              </tr>
            ))}
            {!all && (
              <tr>
                <th scope="row" class="far-edge">
                  ring 20
                </th>
                <td class="far-edge">
                  the edge · proved 2010
                  <span class="far-est far-est-block">{formatCount(edge)} positions (estimate)</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p class="far-note">
          Rings 1–15 are exact counts; 16–20 are estimates. Counts from{' '}
          <a href={SOURCE} target="_blank" rel="noopener noreferrer">
            cube20.org
          </a>
          .
        </p>
        <button type="button" class="far-btn" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Show fewer rings' : 'Show all 20 rings'}
        </button>
        <a class="far-btn far-btn-link" href={href('solver')}>
          Watch a solver search inward
        </a>
      </div>
    </div>
  )
}
