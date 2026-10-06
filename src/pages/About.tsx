import { APP_VERSION, BUILD } from '../app/serviceWorker.ts'

export function About() {
  return (
    <div class="stack">
      <article class="card prose">
        <span class="eyebrow">Why this app is called Galois</span>
        <h2>Évariste Galois, 1811–1832</h2>
        <p>
          Galois was a French teenager who asked a question mathematicians had chased for centuries: which equations can
          be solved with a formula? To answer it, he looked not at the equations themselves but at the ways their
          solutions could be shuffled. Those shuffles, and the rules for combining them, are what we now call a{' '}
          <b>group</b>.
        </p>
        <p>
          He was twice refused by the École Polytechnique, expelled from the École Normale, and jailed for his politics.
          On the night of 29 May 1832, expecting to die in a duel the next morning, he wrote a long letter to his friend
          Auguste Chevalier summarising his ideas. He died two days later, aged 20.
        </p>
        <p>
          Joseph Liouville finally published his work in 1846, fourteen years later. Today group theory runs through
          physics, chemistry, cryptography and, as this app shows, a plastic puzzle from 1974. Every Rubik's cube
          position can be solved in 20 moves or fewer, the same number as the years Galois lived.
        </p>
        <p class="muted">The 1832 look in Settings is a small tribute to that last letter.</p>
      </article>
      <div class="card">
        <h3>Credits</h3>
        <ul class="plain">
          <li>
            <a href="https://js.cubing.net/cubing/" target="_blank" rel="noreferrer">
              cubing.js
            </a>{' '}
            by Lucas Garron and contributors: the cube, notation, scrambles and puzzle maths.
          </li>
          <li>Fonts from Google Fonts via Fontsource, under the SIL Open Font License.</li>
          <li>
            Source code on{' '}
            <a href="https://github.com/rj8228/galois" target="_blank" rel="noreferrer">
              GitHub
            </a>{' '}
            (MIT licence).
          </li>
          <li>
            Version {APP_VERSION} ({BUILD}).
          </li>
        </ul>
      </div>
    </div>
  )
}
