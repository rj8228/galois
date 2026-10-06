import { href } from '../app/router.ts'
import { sequenceText } from '../cube/SequenceBar.tsx'

const SECTIONS = [
  { to: 'play', name: 'Play', text: 'Turn the cube freely, play sequences, step through them.', status: 'Open' },
  { to: 'learn', name: 'Learn', text: 'Group theory, one thing you do on the cube at a time.', status: 'Open' },
  {
    to: 'daily',
    name: 'Solve of the Day',
    text: 'One scramble for everyone. Speed and fewest moves.',
    status: 'Open',
  },
  { to: 'decode', name: 'Decode', text: 'Famous algorithms taken apart, piece by piece.', status: 'Phase 6' },
] as const

export function Home() {
  return (
    <div class="stack">
      <div class="card">
        <h2>Turn first, name it later</h2>
        <p>
          Every idea in Galois starts with something you do on the cube. Try this: type <code>R</code> in the sequence
          box and press Play four times. The cube comes back. That number, 4, is called the <b>order</b> of R.
        </p>
        <div class="row">
          <button type="button" class="btn small" onClick={() => (sequenceText.value = 'R')}>
            Load R
          </button>
          <button type="button" class="btn small" onClick={() => (sequenceText.value = 'R U')}>
            Load R U (guess its order)
          </button>
        </div>
      </div>
      <ul class="tiles">
        {SECTIONS.map((s) => (
          <li key={s.to}>
            <a class="tile" href={href(s.to)}>
              <span class="tile-name">{s.name}</span>
              <span class="tile-text">{s.text}</span>
              <span class={`chip ${s.status === 'Open' ? 'chip-on' : ''}`}>{s.status}</span>
            </a>
          </li>
        ))}
      </ul>
      <p class="muted small">
        Named for Évariste Galois, who gave us groups. <a href={href('about')}>Why Galois?</a>
      </p>
    </div>
  )
}
