import './progress.css'
import { PositionNote } from '../LensNote.tsx'
import { usePosition } from '../position.ts'
import { activeLens } from '../state.ts'
import { type PieceReport, progressOf } from './progress.ts'

const STATE_TEXT = { home: 'home', turned: 'home but turned', away: 'in the wrong slot' } as const

function Piece({ p }: { p: PieceReport }) {
  return (
    <span class={`pg-piece pg-${p.kind} pg-${p.state}`} role="img" aria-label={`${p.name} ${STATE_TEXT[p.state]}`} />
  )
}

/** How solved the position is, layer by layer. */
export function ProgressLens() {
  const pos = usePosition()
  if (!pos?.centresHome) return <PositionNote pos={pos} />
  const p = progressOf(pos.cube)
  const pct = Math.round((p.home / 20) * 100)
  return (
    <div class="solve-lens pg">
      <div class="pg-head">
        <div class="pg-score">
          <span class="pg-k">pieces home and straight</span>
          <span class="pg-big" data-testid="progress-home">
            {p.home}
            <span class="pg-of"> / 20</span>
          </span>
        </div>
        <div class="pg-bar" role="img" aria-label={`${pct}% of the pieces home`}>
          <div class="pg-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div class="solve-card pg-layers">
        {p.layers.map((l) => (
          <div class="pg-row" key={l.name}>
            <span class="pg-name">{l.name}</span>
            <div class="pg-dots">
              {l.pieces.map((x) => (
                <Piece key={x.name} p={x} />
              ))}
            </div>
            <span
              class={l.home === l.pieces.length ? 'pg-count pg-count-done' : 'pg-count'}
              data-testid={`progress-${l.name.toLowerCase()}`}
            >
              {l.home}/{l.pieces.length}
            </span>
          </div>
        ))}
        <div class="pg-legend" aria-hidden="true">
          <span>
            <i class="pg-piece pg-key pg-home" />
            home
          </span>
          <span>
            <i class="pg-piece pg-key pg-turned" />
            home but turned
          </span>
          <span>
            <i class="pg-piece pg-key pg-away" />
            wrong slot
          </span>
        </div>
      </div>
      <ul class="pg-steps" aria-label="Checklist">
        {p.steps.map((s) => (
          <li
            key={s.name}
            class={s.done ? 'pg-step pg-step-done' : s.name === p.next ? 'pg-step pg-step-next' : 'pg-step'}
          >
            {s.done ? '✓ ' : ''}
            {s.name}
            <span class="sr-only">{s.done ? ': done' : s.name === p.next ? ': next' : ': not yet'}</span>
          </li>
        ))}
      </ul>
      <div class="solve-card">
        <p class="solve-text" data-testid="progress-advice">
          {p.advice}
        </p>
        {p.next !== null && (
          <button
            type="button"
            class="solve-btn solve-btn-primary"
            onClick={() => {
              activeLens.value = 'top'
            }}
          >
            Open the Top lens
          </button>
        )}
      </div>
    </div>
  )
}
