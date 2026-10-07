import { useLayoutEffect } from 'preact/hooks'
import { AnalysisPanel } from '../analysis/AnalysisPanel.tsx'
import { href, routeParam } from '../app/router.ts'
import { playWithFocus } from '../cube/focus.ts'
import { sequenceText } from '../cube/SequenceBar.tsx'
import { algOf, BREAKDOWNS, type Breakdown, breakdownById } from '../decode/breakdowns.ts'
import { HelpHeading } from '../help/Help.tsx'
import { lessonById } from '../learn/lessons.tsx'

function BreakdownView({ b }: { b: Breakdown }) {
  const alg = algOf(b)
  useLayoutEffect(() => {
    sequenceText.value = alg
  }, [b.id])

  return (
    <div class="stack">
      <div class="card lesson">
        <a class="back-link" href={href('decode')}>
          ← All algorithms
        </a>
        <HelpHeading topic="decode">{b.name}</HelpHeading>
        <p class="muted">{b.use}</p>
        <ol class="timeline" aria-label="Parts">
          {b.parts.map((p, i) => (
            <li key={p.moves + p.label}>
              <button
                type="button"
                class={`part role-${p.role}`}
                onClick={() => playWithFocus(algOf({ ...b, parts: b.parts.slice(0, i + 1) }))}
                aria-label={`Play up to the end of ${p.label}: ${p.moves}`}
              >
                <span class="part-label">{p.label}</span>
                <span class="mono">{p.moves}</span>
              </button>
            </li>
          ))}
        </ol>
        <div class="row">
          <button type="button" class="btn primary" onClick={() => playWithFocus(alg)}>
            Play it with focus
          </button>
        </div>
        {b.story.map((para) => (
          <p key={para}>{para}</p>
        ))}
        <p class="related">
          Explained in{' '}
          {b.lessons.map((id, i) => {
            const l = lessonById(id)
            return (
              l && (
                <span key={id}>
                  {i > 0 && ' and '}
                  <a href={href('learn', id)}>
                    lesson {l.number}, {l.concept}
                  </a>
                </span>
              )
            )
          })}
          .
        </p>
      </div>
      <AnalysisPanel />
    </div>
  )
}

export function Decode() {
  const b = breakdownById(routeParam.value)
  if (b) return <BreakdownView key={b.id} b={b} />
  return (
    <div class="stack">
      <div class="card">
        <span class="eyebrow">Decode</span>
        <HelpHeading topic="decode">Famous algorithms, taken apart</HelpHeading>
        <p>
          Speedcubers learn algorithms by heart. Here you see what they're made of: commutators, conjugates and the
          lessons that explain them.
        </p>
      </div>
      <ul class="lesson-list">
        {BREAKDOWNS.map((x) => (
          <li key={x.id}>
            <a class="tile" href={href('decode', x.id)}>
              <span class="tile-name">{x.name}</span>
              <span class="tile-text mono">{algOf(x)}</span>
              <span class="tile-text">{x.use}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
