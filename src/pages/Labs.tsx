import { useEffect, useLayoutEffect, useMemo, useState } from 'preact/hooks'
import { AnalysisPanel } from '../analysis/AnalysisPanel.tsx'
import { kpuzzle, loadKPuzzle } from '../analysis/kpuzzle.ts'
import { href, routeParam } from '../app/router.ts'
import { parseSequence } from '../cube/notation.ts'
import { sequenceText } from '../cube/SequenceBar.tsx'
import { analyse } from '../engine/analysis.ts'
import { HelpHeading } from '../help/Help.tsx'
import { LABS, type Lab, labById, markSolved, solvedLabs } from '../labs/labs.ts'
import { lessonById } from '../learn/lessons.tsx'

function LabView({ lab }: { lab: Lab }) {
  const [hints, setHints] = useState(0)
  useEffect(() => {
    loadKPuzzle()
  }, [])
  useLayoutEffect(() => {
    sequenceText.value = ''
  }, [lab.id])

  const kp = kpuzzle.value
  const text = sequenceText.value
  const done = useMemo(() => {
    const parsed = parseSequence(text)
    return !!kp && parsed.ok && lab.done({ moves: parsed.moves, analysis: analyse(kp, parsed.alg) })
  }, [kp, text, lab.id])
  useEffect(() => {
    if (done) markSolved(lab.id)
  }, [done, lab.id])

  const lesson = lessonById(lab.lesson)
  const index = LABS.indexOf(lab)
  const next = LABS[index + 1]
  return (
    <div class="stack">
      <div class="card lesson">
        <a class="back-link" href={href('labs')}>
          ← All labs
        </a>
        <HelpHeading topic="labs" label="labs">{`Lab ${index + 1} · ${lab.title}`}</HelpHeading>
        <p>{lab.body}</p>
        <p class={`task ${done ? 'task-done' : ''}`} aria-live="polite">
          <span aria-hidden="true">{done ? '✓' : '○'}</span> {done ? lab.success : lab.task}
        </p>
        {!done && (
          <div class="hints">
            {lab.hints.slice(0, hints).map((h, i) => (
              <p class="hint" key={h}>
                {i === lab.hints.length - 1 ? (
                  <>
                    <b>Answer.</b> <code>{h}</code>
                  </>
                ) : (
                  <>
                    <b>Hint {i + 1}.</b> {h}
                  </>
                )}
              </p>
            ))}
            {hints < lab.hints.length && (
              <button type="button" class="link-btn" onClick={() => setHints(hints + 1)}>
                {hints === 0 ? 'Show a hint' : hints === lab.hints.length - 1 ? 'Show the answer' : 'Another hint'}
              </button>
            )}
          </div>
        )}
        <div class="lesson-nav">
          {lesson ? (
            <a class="btn" href={href('learn', lesson.id)}>
              Lesson {lesson.number}: {lesson.concept}
            </a>
          ) : (
            <span />
          )}
          {next && (
            <a class={`btn ${done ? 'primary' : ''}`} href={href('labs', next.id)}>
              Next lab
            </a>
          )}
        </div>
      </div>
      <AnalysisPanel />
    </div>
  )
}

export function Labs() {
  const lab = labById(routeParam.value)
  if (lab) return <LabView key={lab.id} lab={lab} />
  return (
    <div class="stack">
      <div class="card">
        <span class="eyebrow">Labs</span>
        <HelpHeading topic="labs">Challenges with no single answer</HelpHeading>
        <p>
          Each lab asks for a sequence with some property. Type your attempts in the sequence box; the analysis engine
          checks them as you go.
        </p>
      </div>
      <ol class="lesson-list">
        {LABS.map((l, i) => {
          const solved = solvedLabs.value.includes(l.id)
          const lesson = lessonById(l.lesson)
          return (
            <li key={l.id}>
              <a class="tile" href={href('labs', l.id)}>
                <span class="eyebrow">
                  Lab {i + 1}
                  {lesson ? ` · after lesson ${lesson.number}` : ''}
                </span>
                <span class="tile-name">{l.title}</span>
                <span class="tile-text">{l.task}</span>
                <span class={`chip ${solved ? 'chip-on' : ''}`}>{solved ? 'Solved' : 'Open'}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
