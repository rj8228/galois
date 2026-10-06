import { href } from '../app/router.ts'

type Props = { title: string; phase: number; text: string }

export function ComingSoon({ title, phase, text }: Props) {
  return (
    <div class="stack">
      <div class="card">
        <span class="eyebrow">Arrives in Phase {phase}</span>
        <h2>{title}</h2>
        <p>{text}</p>
        <p>
          Meanwhile, the cube is all yours: try <a href={href('play')}>Play</a>.
        </p>
      </div>
    </div>
  )
}
