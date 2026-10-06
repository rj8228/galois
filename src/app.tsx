import type { TwistyPlayer } from 'cubing/twisty'
import { useRef, useState } from 'preact/hooks'
import { Cube } from './cube/Cube.tsx'

const FACES = ['R', 'L', 'U', 'D', 'F', 'B']
const MOVES = ['', "'", '2'].flatMap((suffix) => FACES.map((face) => face + suffix))

export function App() {
  const player = useRef<TwistyPlayer>()
  const [ready, setReady] = useState(false)
  const [moves, setMoves] = useState<string[]>([])
  const [status, setStatus] = useState('')

  const turn = (move: string) => {
    player.current?.experimentalAddMove(move, { cancel: false })
    setMoves((m) => [...m, move])
  }

  const reset = () => {
    if (!player.current) return
    player.current.experimentalSetupAlg = ''
    player.current.alg = ''
    setMoves([])
    setStatus('')
  }

  const scramble = async () => {
    if (!player.current) return
    setStatus('Generating a random-state scramble…')
    // Runs cubing.js's solver in a Web Worker; this is the Phase 0 worker check.
    const { randomScrambleForEvent } = await import('cubing/scramble')
    const alg = await randomScrambleForEvent('333')
    player.current.experimentalSetupAlg = alg
    player.current.alg = ''
    setMoves([])
    setStatus(`Scramble: ${alg.toString()}`)
  }

  return (
    <div class="app">
      <header class="top">
        <h1 class="wordmark">Galois</h1>
        <span class="tagline">Group theory you can turn</span>
      </header>

      <main>
        <section class="stage" aria-label="Cube">
          <Cube
            onReady={(p) => {
              player.current = p
              setReady(true)
            }}
          />
          <span class="hint">{ready ? 'Drag to rotate the view' : 'Loading cube…'}</span>
        </section>

        <section class="controls" aria-label="Moves">
          <div class="pad">
            {MOVES.map((m) => (
              <button type="button" key={m} onClick={() => turn(m)} disabled={!ready}>
                {m}
              </button>
            ))}
          </div>
          <div class="row">
            <button type="button" class="btn primary" onClick={scramble} disabled={!ready}>
              Scramble
            </button>
            <button type="button" class="btn" onClick={reset} disabled={!ready}>
              Reset
            </button>
          </div>
          <p class="readout" aria-live="polite">
            {status && (
              <span>
                {status}
                <br />
              </span>
            )}
            Your moves ({moves.length}): <b>{moves.join(' ') || 'none yet'}</b>
          </p>
        </section>
      </main>

      <footer class="tribute">
        Named for{' '}
        <a href="https://en.wikipedia.org/wiki/%C3%89variste_Galois" target="_blank" rel="noreferrer">
          Évariste Galois
        </a>{' '}
        (1811–1832), who gave us groups. Phase 0 preview.
      </footer>
    </div>
  )
}
