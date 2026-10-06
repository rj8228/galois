import { useEffect, useLayoutEffect, useMemo, useState } from 'preact/hooks'
import { AnalysisPanel } from '../analysis/AnalysisPanel.tsx'
import { kpuzzle, loadKPuzzle } from '../analysis/kpuzzle.ts'
import { href } from '../app/router.ts'
import { parseSequence } from '../cube/notation.ts'
import { sequenceText } from '../cube/SequenceBar.tsx'
import { highlight, history, reset, scramble } from '../cube/state.ts'
import { analyse } from '../engine/analysis.ts'
import { HelpHeading } from '../help/Help.tsx'
import { LESSONS } from './lessons.tsx'
import { markReached, progress } from './progress.ts'
import type { Lesson, StepContext } from './types.ts'

const KIND_LABEL = { do: 'Do', notice: 'Notice', name: 'Name', explore: 'Explore', prove: 'Prove' } as const

export function LessonView({ lesson }: { lesson: Lesson }) {
  const saved = progress.value[lesson.id]
  const [index, setIndex] = useState(() =>
    saved && !saved.complete ? Math.min(saved.reached, lesson.steps.length - 1) : 0,
  )
  const [finished, setFinished] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [actions, setActions] = useState<Set<string>>(new Set())
  const [showHint, setShowHint] = useState(false)
  const [startLength, setStartLength] = useState(0)
  const step = lesson.steps[index]

  useEffect(() => {
    loadKPuzzle()
  }, [])

  // Prepare the cube and the sequence box before the step is drawn, so nothing typed is overwritten.
  useLayoutEffect(() => {
    highlight.value = null
    if (step.fromSolved) reset()
    if (step.load !== undefined) sequenceText.value = step.load
    setStartLength(step.fromSolved ? 0 : history.value.length)
    setPicked(null)
    setActions(new Set())
    setShowHint(false)
    markReached(lesson.id, index)
  }, [lesson.id, index])
  useEffect(
    () => () => {
      highlight.value = null
    },
    [],
  )

  const kp = kpuzzle.value
  const parsed = parseSequence(sequenceText.value)
  const stepHistory = history.value.slice(startLength)
  const solved = useMemo(() => {
    if (!kp) return false
    const solvedPattern = kp.defaultPattern()
    return solvedPattern.applyAlg([scramble.value, ...history.value].join(' ')).isIdentical(solvedPattern)
  }, [kp, scramble.value, history.value])
  const ctx: StepContext = {
    history: stepHistory,
    solved,
    sequence: parsed,
    analysis: kp && parsed.ok ? analyse(kp, parsed.alg) : null,
    actions,
    analyse: (text) => {
      const p = parseSequence(text)
      return kp && p.ok ? analyse(kp, p.alg) : null
    },
  }

  const choiceDone = step.choices ? picked !== null && step.choices[picked].correct : true
  const checkDone = step.done ? step.done(ctx) : true
  const done = choiceDone && checkDone
  const last = index === lesson.steps.length - 1
  const next = LESSONS.find((l) => l.number === lesson.number + 1)

  const goNext = () => {
    if (last) {
      markReached(lesson.id, index, true)
      setFinished(true)
    } else setIndex(index + 1)
  }

  if (finished) {
    return (
      <div class="stack">
        <div class="card">
          <span class="eyebrow">Lesson {lesson.number} complete</span>
          <h2>{lesson.concept}</h2>
          <p>{lesson.summary}</p>
          <div class="row">
            {next ? (
              <a class="btn primary" href={href('learn', next.id)}>
                Next: {next.title}
              </a>
            ) : (
              <a class="btn primary" href={href('learn')}>
                All lessons
              </a>
            )}
            <button
              type="button"
              class="btn"
              onClick={() => {
                setFinished(false)
                setIndex(0)
              }}
            >
              Go through it again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div class="stack">
      <div class="card lesson">
        <a class="back-link" href={href('learn')}>
          ← All lessons
        </a>
        <HelpHeading topic="lesson" label="lessons">{`Lesson ${lesson.number} · ${lesson.title}`}</HelpHeading>
        <ol class="steps" aria-label="Steps">
          {lesson.steps.map((s, i) => {
            const reachable = i <= Math.max(index, progress.value[lesson.id]?.reached ?? 0)
            return (
              <li key={s.kind}>
                <button
                  type="button"
                  class={i === index ? 'now' : i < index ? 'done' : ''}
                  aria-current={i === index ? 'step' : undefined}
                  disabled={!reachable}
                  onClick={() => setIndex(i)}
                >
                  {i + 1} {KIND_LABEL[s.kind]}
                </button>
              </li>
            )
          })}
        </ol>
        <h2>{step.title}</h2>
        <div class="lesson-body">{step.body}</div>

        {step.choices && (
          <div class="choices" role="group" aria-label="Answers">
            {step.choices.map((c, i) => (
              <button
                type="button"
                key={c.text}
                class={`choice ${picked === i ? (c.correct ? 'right' : 'wrong') : ''}`}
                aria-pressed={picked === i}
                onClick={() => setPicked(i)}
              >
                {c.text}
              </button>
            ))}
            {picked !== null && (
              <p class={step.choices[picked].correct ? 'ok' : 'bad'}>{step.choices[picked].feedback}</p>
            )}
          </div>
        )}

        {step.actions && (
          <div class="row">
            {step.actions.map((a) => (
              <button
                type="button"
                key={a.label}
                class="btn"
                disabled={!kp && a.label.includes('focus')}
                onClick={() => {
                  a.run()
                  setActions(new Set([...actions, a.label]))
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {step.task && (
          <p class={`task ${checkDone ? 'task-done' : ''}`} aria-live="polite">
            <span aria-hidden="true">{checkDone ? '✓' : '○'}</span>{' '}
            {checkDone && step.success ? step.success : step.task}
          </p>
        )}

        {step.hint && !checkDone && (
          <div>
            {showHint ? (
              <p class="hint">{step.hint}</p>
            ) : (
              <button type="button" class="link-btn" onClick={() => setShowHint(true)}>
                Show a hint
              </button>
            )}
          </div>
        )}

        {step.formal && (
          <details class="formal">
            <summary>Go deeper: the formal version</summary>
            {step.formal}
          </details>
        )}

        <div class="lesson-nav">
          <button type="button" class="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Back
          </button>
          {!done && (
            <button type="button" class="link-btn" onClick={goNext}>
              Skip
            </button>
          )}
          <button type="button" class="btn primary" disabled={!done} onClick={goNext}>
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
      {step.analysis && <AnalysisPanel />}
    </div>
  )
}
