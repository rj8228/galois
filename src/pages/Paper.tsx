import type { ComponentChildren } from 'preact'
import { href } from '../app/router.ts'
import { TeX } from '../learn/TeX.tsx'
import { FLOOR_TABLE, FRAMEWORK, GRAVITY, NETWORKS, OVERESTIMATES, REFERENCES } from '../paper/data.ts'
import {
  DistanceChart,
  DistanceTable,
  ExampleFloors,
  FrameworkFigure,
  LandscapeFigure,
  ShadowFigure,
  WorkScatter,
} from '../paper/figures.tsx'
import { parseMoves } from '../solver/cube2.ts'
import { EXAMPLE, EXHAUSTIVE, RING_COUNTS, TOTAL_POSITIONS } from '../solver/report.ts'
import { openInSolver } from '../solver/state.ts'
import '../paper/paper.css'

const fmt = (n: number) => n.toLocaleString('en-US')

const CONTENTS = [
  ['paper-intro', 'Introduction'],
  ['paper-model', 'The 2×2 as a puzzle of numbers'],
  ['paper-framework', 'The framework'],
  ['paper-floors', 'Floors from smaller puzzles'],
  ['paper-prover', 'The prover'],
  ['paper-example', 'A worked example'],
  ['paper-experiments', 'Experiments'],
  ['paper-discussion', 'What AI can and cannot do here'],
  ['paper-3x3', 'Toward the 3×3'],
  ['paper-limits', 'Limitations and next steps'],
  ['paper-refs', 'References'],
] as const

/** Scrolls to a section and moves focus to its heading. (Hash links would change the route.) */
function goTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

function Section({ id, n, title, children }: { id: string; n?: number; title: string; children: ComponentChildren }) {
  return (
    <section class="paper-section" aria-labelledby={id}>
      <h3 id={id} class="paper-h" tabIndex={-1}>
        {n !== undefined && <span class="paper-n">{n}</span>}
        {title}
      </h3>
      {children}
    </section>
  )
}

function Figure({ n, caption, children }: { n: number; caption: ComponentChildren; children: ComponentChildren }) {
  return (
    <figure class="paper-figure">
      {children}
      <figcaption>
        <b>Figure {n}.</b> {caption}
      </figcaption>
    </figure>
  )
}

function Table({ n, caption, children }: { n: number; caption: ComponentChildren; children: ComponentChildren }) {
  return (
    <figure class="paper-table">
      <figcaption>
        <b>Table {n}.</b> {caption}
      </figcaption>
      <div class="table-wrap">
        <table>{children}</table>
      </div>
    </figure>
  )
}

function Equation({ children }: { children: string }) {
  return (
    <div class="paper-eq">
      <TeX block>{children}</TeX>
    </div>
  )
}

function Theorem({
  n,
  name,
  statement,
  proof,
}: {
  n: number
  name: string
  statement: ComponentChildren
  proof: ComponentChildren
}) {
  return (
    <div class="theorem">
      <p>
        <b>Theorem {n}</b> <i>({name}).</i> {statement}
      </p>
      <p class="proof">
        <i>Proof.</i> {proof} <span aria-hidden="true">∎</span>
      </p>
    </div>
  )
}

const exampleTotal = EXAMPLE.rounds.reduce((a, r) => a + r.nodes, 0)
const nearSolved = RING_COUNTS.slice(0, 5).reduce((a, b) => a + b, 0)

function watchExample() {
  openInSolver(parseMoves(EXAMPLE.scramble) ?? [], "The Paper's worked example", EXAMPLE.floor)
  location.hash = href('solver')
}

export function Paper() {
  return (
    <article class="paper" aria-labelledby="paper-title">
      <header class="paper-head">
        <span class="eyebrow">Galois lab · Research note · October 2026</span>
        <h2 id="paper-title" class="paper-title">
          Proving the shortest solve: floors, ceilings and search on the 2×2 cube
        </h2>
        <p class="paper-byline">
          The Galois project. Written for this app and not peer reviewed. Every number was measured on the 2×2 and
          checked against an exact table of all its positions.
        </p>
      </header>

      <section class="paper-abstract" aria-labelledby="paper-abstract">
        <h3 id="paper-abstract">Abstract</h3>
        <p>
          Finding a solution to a scrambled cube is easy; proving that no shorter one exists is hard, because a proof
          has to rule out every shorter sequence of moves. We describe a framework that splits the two jobs. A{' '}
          <em>ceiling</em> is any solution, found by any method, including a neural network. A <em>floor</em> is a
          number of moves the position certainly needs, read from smaller puzzles hidden inside the cube, and it is
          never higher than the truth. A <em>prover</em>, iterative-deepening search, raises the floor until it meets a
          ceiling, and at that point the solution is certified shortest. We work through every step on the 2×2×2 cube,
          whose {fmt(TOTAL_POSITIONS)} positions are few enough to check everything against an exact table. Run on all
          of them, the prover returned a proven-shortest solution every time, with {EXHAUSTIVE.mismatches} mismatches,
          checking {EXHAUSTIVE.meanNodes} positions per solve on average. We also tested ideas from machine learning and
          physics: neural floors were exact only with a correction table and lost to group-theory floors per byte;
          estimates that can be too high broke exact search; and a learned ceiling found the optimal solution for{' '}
          {FRAMEWORK.optimal} of positions, cutting the prover's work by {FRAMEWORK.workCut} while proving nothing on
          its own.
        </p>
      </section>

      <aside class="paper-plain" aria-labelledby="paper-plain">
        <h3 id="paper-plain">In plain words</h3>
        <p>
          Think of driving to another city. A route you have actually driven proves the trip takes at most that long:
          that is a <b>ceiling</b>. The straight-line distance proves no road can be shorter: that is a <b>floor</b>. If
          you ever find a road exactly as long as the straight line, it is the best road, and you never need to try the
          others.
        </p>
        <p>
          On the cube, the straight line comes from simpler puzzles hidden inside it. When no solution is that short,
          the solver checks every sequence one move longer, then one longer again. Each failed round raises the floor by
          one move, and the first round that finds a solution has found the shortest.
        </p>
      </aside>

      <nav class="paper-toc" aria-label="Contents">
        <h3>Contents</h3>
        <ol>
          {CONTENTS.map(([id, title], i) => (
            <li key={id}>
              <button type="button" class="link-btn" onClick={() => goTo(id)}>
                <span class="paper-n">{i < CONTENTS.length - 1 ? i + 1 : ''}</span>
                {title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="paper-intro" n={1} title="Introduction">
        <p>
          How few moves does a scrambled cube need? For the worst positions the answer is known: God's number is 20 for
          the 3×3 (Rokicki et al. 2010) and 11 for the 2×2. This note is about the everyday version of the question,
          asked of one position at a time: what is the shortest solution of <em>this</em> scramble, and how do we know
          nothing shorter exists?
        </p>
        <p>
          Those are different problems. Finding a solution is easy: a beginner's method always works, it is just long.
          Finding a short one is harder. Proving it shortest is the hard part, because the proof must account for every
          shorter sequence of moves, and their number multiplies by about six with each extra move on the 2×2 (about 13
          on the 3×3). Just listing every sequence shorter than 10 moves on the 2×2 means
        </p>
        <Equation>{'1 + 9\\,(1 + 6 + 6^2 + \\cdots + 6^8) = 18{,}139{,}852 \\text{ sequences.}'}</Equation>
        <p>
          No clever trick is expected to remove the search entirely: deciding whether an n×n×n cube can be solved within
          a given number of moves is NP-complete (Demaine et al. 2018). What a method can do is search as little as
          possible, and prove what it finds.
        </p>
        <p>
          This note describes such a method, with the 2×2 as the running example. The 2×2 is small enough that we could
          compute the exact answer for every position, so every claim below was checked against the truth. Our
          contributions are:
        </p>
        <ul>
          <li>
            A framework that splits the job into a ceiling, a floor and a prover, with a certificate when floor meets
            ceiling (§3).
          </li>
          <li>
            Floors built from smaller puzzles, a proof that they are never too high, and a measure of what each byte of
            memory buys (§4).
          </li>
          <li>
            A check on every position: the prover found a proven-shortest solution for all {fmt(TOTAL_POSITIONS)}, with{' '}
            {EXHAUSTIVE.mismatches} mismatches against the exact table (§7.9).
          </li>
          <li>
            Experiments with neural networks, entropy and landscapes, showing where learning helps and where it cannot
            (§7, §8).
          </li>
          <li>The Solver tab of this app, which runs the same method live on any position you choose.</li>
        </ul>
      </Section>

      <Section id="paper-model" n={2} title="The 2×2 as a puzzle of numbers">
        <p>
          A 2×2 cube has eight corner pieces and nothing else. Each corner sits in one of eight slots and is twisted one
          of three ways (0, 1 or 2 thirds of a turn), so a position is fully described by which corner is in which slot
          and how each one is twisted.
        </p>
        <p>
          Turning the whole cube in your hands does not change how scrambled it is, so we hold one corner still: the one
          at the down-back-left (DBL). Then three faces are enough. Turning the left face, for example, does the same to
          the pieces as turning the right face and then turning the whole cube. Seven corners are left free to move, in
          any order: 7! = 5,040 arrangements. Their twists always add up to whole turns, so once six twists are known
          the seventh is forced: 3<sup>6</sup> = 729 twist patterns. In all,
        </p>
        <Equation>{'7! \\times 3^6 = 5040 \\times 729 = 3{,}674{,}160 \\text{ positions.}'}</Equation>
        <p>
          A move is a quarter turn, a half turn or a quarter turn back of the up, right or front face: nine moves in
          all, each counted as one (the half-turn metric). The <em>distance</em> <i>d</i>(<i>x</i>) of a position{' '}
          <i>x</i> is the fewest moves that solve it.
        </p>
        <p>
          One breadth-first search from the solved position labels every position with its exact distance, in about two
          seconds (Figure 1). The counts match the published ones: the farthest positions need 11 moves, God's number
          for the 2×2, or 14 if only quarter turns count.
        </p>
        <Figure
          n={1}
          caption={
            <>
              How many positions need each number of moves. Two thirds of them (68%) are 9 or 10 moves from solved, and
              only {fmt(RING_COUNTS[11])} need 11. Near solved there is almost nothing: {fmt(nearSolved)} positions
              within 4 moves. A random scramble is nearly always far out, which is where the search work is. Hover or
              focus a column for its count.
            </>
          }
        >
          <DistanceChart />
          <DistanceTable />
        </Figure>
        <p>
          In the words of the Learn tab, the positions form a group, the moves generate it, and the distance of a
          position is the length of the shortest word for it. The picture to keep in mind is a map: every position is a
          dot, every move is a road to another dot, and solving means finding the shortest route home.
        </p>
      </Section>

      <Section id="paper-framework" n={3} title="The framework">
        <p>
          Everything we want to say about the shortest solution of a position <i>x</i> is a statement about its distance{' '}
          <i>d</i>(<i>x</i>), a number we do not know. The framework closes in on it from both sides.
        </p>
        <dl class="paper-defs">
          <div>
            <dt>
              Ceiling <i>C</i>(<i>x</i>)
            </dt>
            <dd>
              The length of a solution in hand. The shortest solution can be no longer, so <i>d</i>(<i>x</i>) ≤ <i>C</i>
              (<i>x</i>). Anything may supply a ceiling: a person, a fast method that is not optimal, a neural network.
              Checking one is easy: play the moves and look.
            </dd>
          </div>
          <div>
            <dt>
              Floor <i>h</i>(<i>x</i>)
            </dt>
            <dd>
              A number of moves the position certainly needs: <i>h</i>(<i>x</i>) ≤ <i>d</i>(<i>x</i>) for every
              position, with no exceptions. In search, such a number is called an <em>admissible heuristic</em> (Hart et
              al. 1968). A floor has to be proven, not just likely; §4 shows how to build floors that are.
            </dd>
          </div>
          <div>
            <dt>Prover</dt>
            <dd>
              A search that uses the floor to skip whole families of move sequences, and raises the floor until it meets
              a ceiling.
            </dd>
          </div>
          <div>
            <dt>Certificate</dt>
            <dd>When the two meet, the answer is pinned down:</dd>
          </div>
        </dl>
        <Equation>{'h(x) \\le d(x) \\le C(x), \\qquad h(x) = C(x) \\;\\Rightarrow\\; d(x) = C(x).'}</Equation>
        <Figure
          n={2}
          caption={
            <>
              The distance is unknown, but it lies between a floor, which is never too high, and a ceiling, which is a
              solution in hand. The prover closes the gap. When the floor reaches the ceiling, the solution in hand is
              proven shortest. (Illustrative numbers.)
            </>
          }
        >
          <FrameworkFigure />
        </Figure>
        <p>
          The two sides are not symmetric. A ceiling that is too long only costs time. A floor that is too high, even on
          a single position, can make the prover skip the very branch that holds the shortest solution, and then it
          "proves" a wrong answer. That asymmetry decides where machine learning can help (§8).
        </p>
      </Section>

      <Section id="paper-floors" n={4} title="Floors from smaller puzzles">
        <p>
          Where does a number that is never too high come from? From forgetting. Look at the cube but ignore where the
          corners are, keeping only how each slot's corner is twisted. What remains is a smaller puzzle, the{' '}
          <em>twist puzzle</em>, with 729 positions. Every move of the cube acts on it in a definite way, because the
          twists after a move depend only on the twists before it and the move. So one breadth-first search solves all
          729 positions of the twist puzzle exactly, in microseconds, and the answers fit in a table of 729 numbers.
        </p>
        <p>
          The twist puzzle's distance is a floor for the cube. Take any solution of the cube, say 9 moves long, and play
          the same moves on the twist puzzle. It follows along, so when the cube is solved its twists are solved too.
          The twist puzzle can therefore be solved in 9 moves, maybe fewer. That is true of every solution of the cube,
          including the shortest one, so the twist puzzle never needs more moves than the cube does.
        </p>
        <Figure
          n={3}
          caption={
            <>
              Any solution of the cube (top) also solves its shadow in a smaller puzzle (bottom), so the shadow never
              needs more moves. The shadow's exact distance, looked up in a small table, is therefore a floor.
            </>
          }
        >
          <ShadowFigure />
        </Figure>
        <Theorem
          n={1}
          name="floors from smaller puzzles"
          statement={
            <>
              Let φ send each position of the cube to a position of a smaller puzzle in a way that moves respect: φ(
              <i>x</i>·<i>m</i>) = φ(<i>x</i>)·<i>m</i> for every move <i>m</i>, and φ(solved) = solved. Then for every
              position <i>x</i>, <TeX>{'d_{\\text{small}}\\big(\\varphi(x)\\big) \\le d(x).'}</TeX>
            </>
          }
          proof={
            <>
              If the moves <i>m</i>
              <sub>1</sub> … <i>m</i>
              <sub>k</sub> solve <i>x</i>, then φ(<i>x</i>)·<i>m</i>
              <sub>1</sub>⋯<i>m</i>
              <sub>k</sub> = φ(<i>x</i>·<i>m</i>
              <sub>1</sub>⋯<i>m</i>
              <sub>k</sub>) = φ(solved) = solved, so the same <i>k</i> moves solve the smaller puzzle. Take a shortest
              solution, so that <i>k</i> = <i>d</i>(<i>x</i>).
            </>
          }
        />
        <p>
          In group terms, φ lumps together the positions that look alike through the filter, and these lumps are cosets
          of a subgroup. The floor of a position then equals the smallest true distance among the positions in its lump,
          which is sharper than Theorem 1. The lab checked this for all 121 floors it built, and it held for every one.
        </p>
        <p>
          Floors also combine: if several numbers are each never too high, neither is the largest of them. The Solver's
          medium floor is the higher of two, the twist puzzle and the <em>place puzzle</em>, which ignores twists and
          keeps only where the corners are (5,040 positions). Its strong floor also consults two puzzles that each
          follow five of the seven corners, slot and twist (1.2 million entries in all).
        </p>
        <Equation>{'h(x) = \\max\\big(h_{\\text{twist}}(x),\\; h_{\\text{place}}(x)\\big) \\;\\le\\; d(x)'}</Equation>
        <p>
          The lab built 121 floors (twists only, places only, and every choice of one to five corners to follow) and,
          for each memory budget, the best combination it could find. Table 1 shows how close each comes to the truth
          and how much search it saves; Figure 4 plots one against the other.
        </p>
        <Table
          n={1}
          caption={
            <>
              Floors compared. The average floor and how often it equals the true distance are over all{' '}
              {fmt(TOTAL_POSITIONS)} positions; the true average is 8.76. Work is the mean number of positions the
              prover checked per solve over the same 1,000 random positions, and every one of those solves was optimal.
              Tables store 4 bits per entry. *Counted, not run: the sequences a search without a floor must rule out to
              prove a 10-move answer.
            </>
          }
        >
          <thead>
            <tr>
              <th scope="col">Floor</th>
              <th scope="col">Memory</th>
              <th scope="col" class="num">
                Average
              </th>
              <th scope="col" class="num">
                Exact on
              </th>
              <th scope="col" class="num">
                Work
              </th>
            </tr>
          </thead>
          <tbody>
            {FLOOR_TABLE.map((f) => (
              <tr key={`${f.name} ${f.memory}`}>
                <td>{f.name}</td>
                <td>{f.memory}</td>
                <td class="num">{f.mean === null ? '–' : f.mean.toFixed(2)}</td>
                <td class="num">{f.exact}</td>
                <td class="num">{f.nodes === null ? '–' : `${fmt(f.nodes)}${f.name === 'No floor' ? '*' : ''}`}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Figure
          n={4}
          caption={
            <>
              Work against floor strength, for the floors of Table 1 (best tables labelled by size). Each extra move of
              floor cuts the work about five times (dashed line), because it prunes one more level of a tree that
              branches about six ways. The best tables follow the line. Twists only and places only sit far above it:
              their floors are uneven, and since work grows exponentially with the gap between floor and truth, the
              positions where they are very low dominate the cost.
            </>
          }
        >
          <WorkScatter />
        </Figure>
      </Section>

      <Section id="paper-prover" n={5} title="The prover: iterative deepening">
        <p>
          The prover is IDA*, iterative-deepening A* (Korf 1985), the method Korf used for the first optimal solutions
          of random 3×3 positions (Korf 1997). It works in rounds:
        </p>
        <ol>
          <li>
            Set a bound <i>b</i> equal to the floor of the starting position.
          </li>
          <li>
            Try move sequences depth first. At each position <i>y</i> reached after <i>g</i> moves, if <i>g</i> +{' '}
            <i>h</i>(<i>y</i>) &gt; <i>b</i>, abandon the branch: the floor says <i>y</i> needs at least <i>h</i>(
            <i>y</i>) more moves, so the branch cannot finish within <i>b</i>.
          </li>
          <li>If a sequence reaches solved, stop. It is the answer.</li>
          <li>
            If the round ends with nothing found, raise <i>b</i> to the smallest value of <i>g</i> + <i>h</i> that went
            over it (in practice, one more move) and run the round again.
          </li>
        </ol>
        <p>
          Two habits keep the search small. It never turns the same face twice in a row (U then U2 is just U′), which
          leaves six choices at each step after the first. And it stores only the current sequence, at most 11 moves, so
          its memory is just the floor tables. That second habit is what lets the same method run on puzzles far too big
          to store.
        </p>
        <Theorem
          n={2}
          name="the first solution found is a shortest one"
          statement={
            <>
              If the floor is never too high, the first solution IDA* finds has exactly <i>d</i>(<i>x</i>) moves.
            </>
          }
          proof={
            <>
              Fix a shortest solution, with <i>d</i> = <i>d</i>(<i>x</i>) moves. After <i>g</i> of its moves the cube is
              at a position <i>y</i> that the rest of the solution solves in <i>d</i> − <i>g</i> moves, so <i>h</i>(
              <i>y</i>) ≤ <i>d</i>(<i>y</i>) ≤ <i>d</i> − <i>g</i>, that is, <i>g</i> + <i>h</i>(<i>y</i>) ≤ <i>d</i>.
              Hence a round with <i>b</i> ≥ <i>d</i> never abandons this solution and must succeed. A round with{' '}
              <i>b</i> &lt; <i>d</i> cannot succeed, because no solution has <i>b</i> moves or fewer; it abandons the
              shortest solution at some step whose value is at most <i>d</i>, so the next bound is at most <i>d</i>.
              Bounds therefore rise from <i>h</i>(<i>x</i>) to exactly <i>d</i> without skipping it, and the round at{' '}
              <i>b</i> = <i>d</i> returns a solution of at most <i>d</i> moves: a shortest one.
            </>
          }
        />
        <p>
          Because each round explores about six times as much as the one before, almost all the work is in the last
          round or two, and every extra move of floor removes about one level of the tree. That is the whole reason
          floors matter (Figure 4).
        </p>
      </Section>

      <Section id="paper-example" n={6} title="A worked example">
        <p>
          Take one of the {fmt(RING_COUNTS[11])} hardest positions, made by the scramble{' '}
          <span class="mono scramble-text">{EXAMPLE.scramble}</span>. The Solver's medium floor says it needs at least{' '}
          {EXAMPLE.floorAtStart} moves, so the prover starts there (Table 2).
        </p>
        <Table
          n={2}
          caption={
            <>
              The prover on one hardest position, with the medium floor. Every failed round raises the floor by one. The
              round at 11 finds a solution, which is the ceiling, and floor and ceiling meet. The last round checks
              fewer positions than the one before because it stops at its first solution. {fmt(exampleTotal)} positions
              in all.
            </>
          }
        >
          <thead>
            <tr>
              <th scope="col">Bound</th>
              <th scope="col" class="num">
                Checked
              </th>
              <th scope="col">Result</th>
              <th scope="col">Now known</th>
            </tr>
          </thead>
          <tbody>
            {EXAMPLE.rounds.map((r, i) => {
              const last = i === EXAMPLE.rounds.length - 1
              return (
                <tr key={r.bound} class={last ? 'row-found' : undefined}>
                  <td class="mono">{r.bound}</td>
                  <td class="num">{fmt(r.nodes)}</td>
                  <td>
                    {last ? (
                      <>
                        found <span class="mono">{EXAMPLE.solution}</span>
                      </>
                    ) : (
                      'none that short'
                    )}
                  </td>
                  <td>{last ? <b>exactly {r.bound}</b> : `at least ${r.bound + 1}`}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        <p>
          Nothing here was a guess. Rounds {EXAMPLE.rounds[0].bound} to{' '}
          {EXAMPLE.rounds[EXAMPLE.rounds.length - 2].bound} each ruled out, completely, every solution that short, so
          when the round at 11 found one, it was proven shortest. A stronger floor starts higher and skips the early
          rounds. On this same position the weak floor starts at {EXAMPLE.weak.floorAtStart} and the strong floor at{' '}
          {EXAMPLE.strong.floorAtStart} (Figure 5).
        </p>
        <Figure
          n={5}
          caption={
            <>
              Work on this same position with the Solver's three floors, in positions checked. Starting two moves higher
              cuts the work 15 times; starting five moves higher, 6,500 times. Bars are on a logarithmic scale.
            </>
          }
        >
          <ExampleFloors />
        </Figure>
        <div class="row">
          <button type="button" class="btn small" onClick={watchExample}>
            Watch this solve in the Solver
          </button>
        </div>
      </Section>

      <Section id="paper-experiments" n={7} title="Experiments">
        <p>
          The lab is a set of Python scripts that computed the exact distance of every position and then measured each
          idea against it. Unless noted, numbers are over all {fmt(TOTAL_POSITIONS)} positions, or over the same 1,000
          positions drawn uniformly at random.
        </p>

        <h4>7.1 Ground truth</h4>
        <p>
          Breadth-first search reproduced the published distance counts exactly, in both the half-turn metric (God's
          number 11) and the quarter-turn metric (14).
        </p>

        <h4>7.2 Entropy: where the positions are</h4>
        <p>
          Figure 1 is lopsided: 68% of positions lie 9 or 10 moves out, and the average is 8.76. Three consequences
          follow.
        </p>
        <ul>
          <li>
            <b>Counting alone bounds God's number.</b> There are only 3,023,308 move sequences of 8 moves or fewer, too
            few to reach all {fmt(TOTAL_POSITIONS)} positions, so some position needs at least 9 moves. (The truth is
            11.)
          </li>
          <li>
            <b>Scramble length is a poor label.</b> After 5 random moves, 7% of positions are closer than 5; after 8,
            42% are; after 11, essentially all are. A network taught to predict scramble length learns to overestimate.
          </li>
          <li>
            <b>Uniform sampling starves the region near solved.</b> Only 0.01% of uniformly drawn positions are within 3
            moves of solved, against 27% of positions made by random scrambles.
          </li>
        </ul>

        <h4>7.3 Symmetry</h4>
        <p>
          Two symmetries keep every distance the same: taking a position's inverse, and turning the cube a third of a
          turn about the axis through the URF and DBL corners, which leaves DBL in place. Together they sort the
          positions into 613,058 classes, about six times fewer, so an exact table shrinks to about 300 KB with nothing
          lost.
        </p>

        <h4>7.4 Floors per byte</h4>
        <p>
          Table 1 and Figure 4 show the trade. On the 2×2, though, the symmetry-reduced exact table (about 300 KB) beats
          every partial floor of similar size: here the honest answer is to store everything. The 3×3 cannot, which is
          why partial floors are the part that matters. Our exact table is almost the same as the corner table Korf used
          for the 3×3: its average is 8.756, against his 8.764.
        </p>

        <h4>7.5 Neural floors</h4>
        <p>
          We trained one small network (70 inputs saying which corner is in each slot and how it is twisted, two hidden
          layers of 128, one output; about 26,000 weights) in five ways, and checked each on every position (Table 3).
        </p>
        <Table
          n={3}
          caption={
            <>
              Neural estimates of distance, checked on all positions. A correction table, which stores the true value
              wherever the network is too high, turns an estimate into a floor.
            </>
          }
        >
          <thead>
            <tr>
              <th scope="col">Net</th>
              <th scope="col">Trained on, with labels</th>
              <th scope="col" class="num">
                Too high
              </th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {NETWORKS.map((n) => (
              <tr key={n.name}>
                <td class="mono">{n.name}</td>
                <td>
                  {n.data}
                  <span class="cell-sub">{n.labels}</span>
                </td>
                <td class="num">{n.tooHigh}</td>
                <td>{n.note}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p>
          With corrections, C and E are genuine floors, and the prover with them was optimal on every test position. Per
          byte, though, they lost to group-theory tables: C with corrections (268 KB) needed 372 positions per solve,
          where 400 KB of tables needed 162; E with corrections (57 KB) needed 8,332, where 20 KB of tables needed
          2,319. The networks are weakest far from solved, which is where most positions live.
        </p>

        <h4>7.6 Estimates that can be too high</h4>
        <p>
          An estimate that is too high anywhere can cut off the branch that holds the shortest solution. We let IDA* use
          such estimates anyway, with at most 20,000 positions per solve, on 300 of the test positions (Table 4).
        </p>
        <Table
          n={4}
          caption={
            <>
              IDA* guided by estimates that can be too high. Network A returned a solution that was too long for 71.7%
              of positions, and the search would have presented each one as proven. Network C is too high on only 1.47%
              of positions, yet it found the optimal solution only 8.7% of the time. With its corrections it is a true
              floor: optimal on all 1,000 positions, with no limit needed.
            </>
          }
        >
          <thead>
            <tr>
              <th scope="col">Guide</th>
              <th scope="col" class="num">
                Optimal
              </th>
              <th scope="col" class="num">
                Too long
              </th>
              <th scope="col" class="num">
                Gave up
              </th>
            </tr>
          </thead>
          <tbody>
            {OVERESTIMATES.map((o) => (
              <tr key={o.name}>
                <td>{o.name}</td>
                <td class="num">{o.optimal}</td>
                <td class="num">{o.tooLong}</td>
                <td class="num">{o.gaveUp}</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <h4>7.7 Gravity: landscapes and false valleys</h4>
        <p>
          Physics suggests another way to solve: read an estimate as height, put a ball on the position, and let it roll
          to the lowest neighbour, move by move. If the landscape has no false valleys (positions other than solved
          where no move leads down), the ball always rolls home, along a shortest path (Table 5).
        </p>
        <Table
          n={5}
          caption={
            <>
              Rolling downhill from 1,000 random positions. The true distance is a perfect funnel. Floors have fake
              bottoms: the twists-only floor is 0 wherever the twists happen to be right, so the ball stops there. Heat
              (simulated annealing) lets a ball climb out of small valleys but knocks it off the perfect funnel, and
              proves nothing.
            </>
          }
        >
          <thead>
            <tr>
              <th scope="col">Landscape</th>
              <th scope="col" class="num">
                No way down
              </th>
              <th scope="col" class="num">
                Reaches solved
              </th>
              <th scope="col" class="num">
                With heat
              </th>
            </tr>
          </thead>
          <tbody>
            {GRAVITY.map((g) => (
              <tr key={g.name}>
                <td>{g.name}</td>
                <td class="num">{g.valleys}</td>
                <td class="num">{g.reached}</td>
                <td class="num">{g.heat}</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <h4>7.8 The whole framework</h4>
        <p>
          Finally, the three parts together. Network D proposes a ceiling by beam search (keeping the 64 most promising
          positions at each step), the 400 KB tables are the floor, and IDA* proves. On the 1,000 random positions:
        </p>
        <ul>
          <li>
            The network found a solution for {FRAMEWORK.found} of positions and the optimal one for {FRAMEWORK.optimal}.
          </li>
          <li>
            For {FRAMEWORK.instant}, the floor at the start already equalled the network's solution: certified with no
            search at all.
          </li>
          <li>
            With a ceiling in hand the prover can skip its last round, because once every shorter length is ruled out
            the ceiling is proven. That cut its average work from {FRAMEWORK.nodesAlone} to {FRAMEWORK.nodesWithCeiling}{' '}
            positions, {FRAMEWORK.workCut} less.
          </li>
          <li>All 1,000 certificates matched the exact table.</li>
        </ul>

        <h4>7.9 Every position</h4>
        <p>
          The strongest test ran IDA* with the 400 KB floor on all {fmt(EXHAUSTIVE.positions)} positions. Every solution
          was replayed move by move and solved its position, and every length equalled the exact table.
        </p>
        <dl class="stat-grid">
          <div>
            <dt>Positions solved</dt>
            <dd>{fmt(EXHAUSTIVE.positions)}</dd>
          </div>
          <div>
            <dt>Mismatches</dt>
            <dd>{EXHAUSTIVE.mismatches}</dd>
          </div>
          <div>
            <dt>Positions checked per solve, on average</dt>
            <dd>{fmt(EXHAUSTIVE.meanNodes)}</dd>
          </div>
          <div>
            <dt>Most for one solve</dt>
            <dd>{fmt(EXHAUSTIVE.maxNodes)}</dd>
          </div>
          <div>
            <dt>Positions checked in total</dt>
            <dd>{fmt(EXHAUSTIVE.nodes)}</dd>
          </div>
          <div>
            <dt>Time, on {EXHAUSTIVE.cores} cores</dt>
            <dd>{EXHAUSTIVE.seconds} s</dd>
          </div>
        </dl>
      </Section>

      <Section id="paper-discussion" n={8} title="What AI can and cannot do here">
        <p>The experiments point to a clear division of labour.</p>
        <ul>
          <li>
            <b>Proof needs floors, and floors need guarantees.</b> An estimate that stays below the truth on 99.96% of
            positions (network E) is still not a floor: one position is enough to break a proof. Group theory gives
            floors that are provably never too high (Theorem 1), and they grow stronger through cosets and symmetry.
          </li>
          <li>
            <b>Learning earns its place as a finder.</b> A ceiling is checked by playing it, so it can come from
            anywhere. Network D found the optimal solution for {FRAMEWORK.optimal} of positions, and its ceilings cut
            the prover's work by {FRAMEWORK.workCut}.
          </li>
          <li>
            <b>Learning can compress floors, with a safety net.</b> A network plus a correction table is exact. Samadi
            et al. (2008) compress pattern databases this way, and Futuhi and Sturtevant (2026) train networks to stay
            below the truth. On the 2×2 it still loses to tables per byte, because the networks are weakest far from
            solved, exactly where floors matter most.
          </li>
          <li>
            <b>Anything that can be too high is worse than useless inside an exact prover</b> (Table 4).
          </li>
        </ul>
        <p>
          Network B shows the local-minimum problem of gradient descent directly. Trained on uniform positions with
          squared error, it learned to answer about 8.7 for every position: the average. Since 68% of positions are 9 or
          10 moves away, guessing the average already makes the error small, and the near-solved positions that could
          teach it more were 0.01% of what it saw. It settled into that flat valley of its training loss and stayed
          there. Trained on scrambles instead (network D), the same network learned the region near solved.
        </p>
        <p>
          The puzzle has a landscape too. The true distance has no false valleys: from every unsolved position, the
          first move of a shortest solution goes one step down. So solved is the only minimum, and rolling downhill is a
          perfect solver (Figure 6). The catch is that this landscape <em>is</em> the answer for every position. Every
          cheaper landscape, floor or network, has false valleys (Table 5). Search is what replaces rolling: IDA* does
          not need a perfect landscape, only one that never lies upward.
        </p>
        <Figure
          n={6}
          caption={
            <>
              Two landscapes over the same positions, sketched. Left: the true distance, a funnel with one bottom; a
              ball rolls home along a shortest path. Right: an estimate with a false valley; the ball stops where no
              neighbour is lower. A floor can have valleys and still be useful, because the prover searches instead of
              rolling.
            </>
          }
        >
          <LandscapeFigure />
        </Figure>
      </Section>

      <Section id="paper-3x3" n={9} title="Toward the 3×3">
        <p>
          The 3×3 has 43,252,003,274,489,856,000 positions, about twelve trillion times as many as the 2×2, and its
          God's number is 20 (Rokicki et al. 2010). No table of every answer will ever fit, so floors from smaller
          puzzles are the whole game, and the framework carries over unchanged.
        </p>
        <ul>
          <li>
            <b>The corners are a 2×2.</b> Ignoring the edges, the corners of a 3×3 move like a 2×2 held by its centres:
            88,179,840 positions, whose exact distance is a floor (Korf 1997).
          </li>
          <li>
            <b>Edges need floors of their own.</b> Twelve edges are too many for one table, so floors follow groups of
            them. Korf used two groups of six and took the highest of the three floors.
          </li>
          <li>
            <b>The search is wider.</b> There are about 13.35 sensible choices per move instead of 6 (Korf 1997), so
            each missing move of floor costs about 13 times the work.
          </li>
          <li>
            <b>Symmetry is larger.</b> The 3×3 has 48 symmetries counting mirror images, which can shrink floor tables
            by up to that factor.
          </li>
        </ul>
        <p>
          Korf solved ten random 3×3 positions this way (median 18 moves); a complete search to 16 moves examined about
          9.5 billion positions. A 3×3 engine for this app is being built the same way: its floor is the highest of six
          smaller puzzles, its ceiling comes from cubing.js, and its first benchmark on one processor core proves every
          tested scramble of up to 12 moves within two seconds, 30% of 14-move scrambles, and no random positions yet.
        </p>
      </Section>

      <Section id="paper-limits" n={10} title="Limitations and next steps">
        <ul>
          <li>
            <b>The 2×2 is small.</b> An exact table fits, so on the 2×2 the framework is a demonstration. Every number
            here was checked against that table, which is exactly the check bigger puzzles will not allow.
          </li>
          <li>
            <b>One metric.</b> The Solver counts a half turn as one move. The quarter-turn metric (God's number 14)
            needs floors of its own.
          </li>
          <li>
            <b>Small networks, short training.</b> Our networks had about 26,000 weights and trained for one to two
            minutes each. Larger networks, labels from value iteration as in DeepCubeA (Agostinelli et al. 2019), or
            inputs built from the group's Fourier basis (Pan and Kondor 2021) may make learned floors competitive far
            from solved.
          </li>
          <li>
            <b>Proof cost grows exponentially.</b> For n×n×n cubes God's number grows like n²/log n (Demaine et al.
            2011), and optimal solving is NP-complete. On big cubes the honest output is often a ceiling and a floor
            with a gap between them, reported as such. Learned methods already find short solutions there (Chervov et
            al. 2025); proving them shortest is the open part.
          </li>
        </ul>
        <p>
          Next in this app: the 3×3 with corner and edge floors, symmetry, compressed floors with corrections and
          learned ceilings, all in a web worker; then bigger cubes, with one floor per kind of piece (corners, edges,
          centres) and the remaining gap shown honestly.
        </p>
        <p class="small muted">
          The Solver tab reruns the method on any position you pick. The lab's measurements come from one run of its
          scripts on 2 processor cores; this page quotes them and recomputes nothing.
        </p>
      </Section>

      <Section id="paper-refs" title="References">
        <ol class="paper-refs">
          {REFERENCES.map((r) => (
            <li key={r.key}>
              {r.text}
              {r.url && (
                <>
                  {' '}
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {new URL(r.url).hostname.replace(/^www\./, '')}
                  </a>
                </>
              )}
            </li>
          ))}
        </ol>
      </Section>
    </article>
  )
}
