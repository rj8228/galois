import { href, routeParam } from '../app/router.ts'
import { LessonView } from '../learn/LessonView.tsx'
import { LESSONS, lessonById } from '../learn/lessons.tsx'
import { progress } from '../learn/progress.ts'

export function Learn() {
  const lesson = lessonById(routeParam.value)
  if (lesson) return <LessonView key={lesson.id} lesson={lesson} />

  return (
    <div class="stack">
      <div class="card">
        <span class="eyebrow">Lessons</span>
        <h2>Learn group theory by turning</h2>
        <p>
          Each lesson starts with something you do on the cube, then names the idea behind it. Open "Go deeper" in any
          lesson for the formal version.
        </p>
      </div>
      <ol class="lesson-list">
        {LESSONS.map((l) => {
          const p = progress.value[l.id]
          const status = p?.complete ? 'Done' : p ? `Step ${p.reached + 1} of ${l.steps.length}` : 'Not started'
          return (
            <li key={l.id}>
              <a class="tile" href={href('learn', l.id)}>
                <span class="eyebrow">
                  Lesson {l.number} · {l.concept}
                </span>
                <span class="tile-name">{l.title}</span>
                <span class="tile-text">{l.summary}</span>
                <span class={`chip ${p?.complete ? 'chip-on' : ''}`}>{status}</span>
              </a>
            </li>
          )
        })}
      </ol>
      <a class="tile" href={href('labs')}>
        <span class="eyebrow">Labs</span>
        <span class="tile-name">Put the lessons to work</span>
        <span class="tile-text">
          Open challenges checked live: order 1260, flipping two edges, the T-perm and more.
        </span>
      </a>
    </div>
  )
}
