import { kpuzzle } from '../analysis/kpuzzle.ts'
import { invertMove } from '../cube/notation.ts'
import { highlight, playFast, playSequence, reset } from '../cube/state.ts'
import { type Analysis, affectedPieces, analyse, highlightMask } from '../engine/analysis.ts'
import type { OrbitName } from '../engine/pieces.ts'
import { TeX } from './TeX.tsx'
import type { Lesson, StepContext } from './types.ts'

const face = (move: string) => move[0]

/** True when the sequence box holds X Y X' Y' for two different faces X and Y. */
function isCommutatorShape(ctx: StepContext, first?: string) {
  if (!ctx.sequence.ok) return false
  const m = ctx.sequence.moves
  return (
    m.length === 4 &&
    face(m[0]) !== face(m[1]) &&
    m[2] === invertMove(m[0]) &&
    m[3] === invertMove(m[1]) &&
    (first === undefined || m[0] === first)
  )
}

const repeat = (moves: string[], times: number) => Array.from({ length: times }, () => moves).flat()

/** How many pieces a sequence moves or turns, over corners, edges and centres. */
const totalAffected = (a: Analysis | null) => a?.orbits.reduce((n, o) => n + o.affected, 0) ?? 0
const orbit = (a: Analysis | null, name: OrbitName) => a?.orbits.find((o) => o.orbit === name)
/** Names of the corners in a sequence's only corner cycle, when corners form exactly one cycle. */
function cornerCycle(a: Analysis | null) {
  const c = orbit(a, 'CORNERS')
  return c?.cycles.length === 1 && c.twistedInPlace.length === 0 ? c.cycles[0].positions.map((p) => c.names[p]) : null
}
/** Play a sequence from solved with focus on the pieces it moves. */
function playWithFocus(sequence: string) {
  reset()
  const kp = kpuzzle.value
  if (kp) highlight.value = highlightMask(affectedPieces(analyse(kp, sequence)))
  playSequence(sequence.split(' '))
}

const CORNER_3_CYCLE = "R U R' D R U' R' D'"
const TWO_TWISTS = "R' D' R D R' D' R D U D' R' D R D' R' D R U'"

export const LESSONS: Lesson[] = [
  {
    id: 'undo',
    number: 1,
    title: 'Every move can be undone',
    concept: 'Identity and inverses',
    summary: 'Doing nothing is a move too, and every move has a partner that cancels it.',
    steps: [
      {
        kind: 'do',
        title: 'Turn it, then turn it back',
        fromSolved: true,
        body: <p>Turn the right face once with R. Then find a single move that puts the cube back to solved.</p>,
        task: 'Make R, then one move that solves the cube again.',
        done: (c) => c.history[0] === 'R' && c.history.length >= 2 && c.solved,
        success: 'Solved again.',
        hint: 'Try turning the same face the other way.',
      },
      {
        kind: 'notice',
        title: 'What did your second move do?',
        body: <p>Think about what R′ (R prime) did to the R before it.</p>,
        choices: [
          {
            text: 'It cancelled R exactly',
            correct: true,
            feedback: 'Right. Together, R and R′ add up to doing nothing.',
          },
          {
            text: 'It turned a different face',
            correct: false,
            feedback: 'Look again: R′ turns the same face as R, just the other way.',
          },
          {
            text: 'It mixed the cube up more',
            correct: false,
            feedback: 'The cube ended up solved, so nothing is mixed up.',
          },
        ],
      },
      {
        kind: 'name',
        title: 'Identity and inverse',
        body: (
          <>
            <p>
              Doing nothing at all is called the <b>identity</b>. It's a perfectly good "move": it leaves every piece
              where it is.
            </p>
            <p>
              A move that cancels another is its <b>inverse</b>. R′ is the inverse of R, and R is the inverse of R′. R2
              is its own inverse, because doing it twice does nothing.
            </p>
          </>
        ),
        formal: (
          <p>
            A group has an identity element <TeX>e</TeX>, and every element <TeX>g</TeX> has an inverse{' '}
            <TeX>{'g^{-1}'}</TeX> with <TeX>{'g\\,g^{-1} = e'}</TeX>. On the cube: <TeX>{"R\\,R' = e"}</TeX>, and{' '}
            <TeX>{'R2 \\cdot R2 = e'}</TeX>.
          </p>
        ),
      },
      {
        kind: 'explore',
        title: 'Undo a whole sequence',
        fromSolved: true,
        load: 'R U',
        body: (
          <p>
            Press Play to run R U. Now undo it using the move pad. Each move has an inverse, but you have to choose the
            order carefully.
          </p>
        ),
        task: 'Play R U, then get back to solved with the move pad.',
        done: (c) => c.history[0] === 'R' && c.history[1] === 'U' && c.history.length >= 4 && c.solved,
        success: 'Undone. The last move went first.',
        hint: 'Take off your shoes before your socks: undo the last move first. The inverse of R U is U′ R′.',
        formal: (
          <p>
            The inverse of a product reverses the order: <TeX>{'(g\\,h)^{-1} = h^{-1}g^{-1}'}</TeX>. This is sometimes
            called the socks-and-shoes rule.
          </p>
        ),
      },
      {
        kind: 'prove',
        title: 'Your turn',
        load: '',
        body: <p>Type the inverse of R U F′ in the sequence box. You can test it on the cube first if you like.</p>,
        task: "The sequence box holds the inverse of R U F'.",
        done: (c) => c.sequence.ok && c.analyse(`R U F' ${c.sequence.moves.join(' ')}`)?.order === 1,
        success: 'Correct: R U F′ followed by your sequence does nothing.',
        hint: "Reverse the order and invert each move. The last move, F', is undone first by F.",
      },
    ],
  },
  {
    id: 'order',
    number: 2,
    title: 'Repeat until solved',
    concept: 'Order',
    summary: 'Repeat any sequence enough times and the cube always comes back. How many times is its order.',
    steps: [
      {
        kind: 'do',
        title: 'Four quarter turns',
        fromSolved: true,
        body: <p>Turn the right face with R, again and again, until the cube is solved.</p>,
        task: 'Press R until the cube is back to solved.',
        done: (c) => c.history.length >= 2 && c.history.every((m) => m === 'R') && c.solved,
        success: 'Back to solved.',
      },
      {
        kind: 'notice',
        title: 'How many turns did it take?',
        body: <p>Count the R moves you made before the cube came back.</p>,
        choices: [
          { text: '2', correct: false, feedback: 'Two turns of R make R2: half way round. Keep going.' },
          { text: '4', correct: true, feedback: 'Yes: four quarter turns make a full turn.' },
          { text: '6', correct: false, feedback: 'Too many: the cube was already solved after fewer.' },
        ],
      },
      {
        kind: 'name',
        title: 'Order',
        body: (
          <>
            <p>
              The number of repeats a sequence needs to get back to where it started is its <b>order</b>. R has order 4,
              R2 has order 2, and the identity has order 1.
            </p>
            <p>Every sequence has an order, because the cube has only finitely many positions.</p>
          </>
        ),
        formal: (
          <p>
            The order of <TeX>g</TeX> is the smallest <TeX>{'n \\ge 1'}</TeX> with <TeX>{'g^n = e'}</TeX>. In a finite
            group every element has finite order.
          </p>
        ),
      },
      {
        kind: 'explore',
        title: 'Guess the order of R U',
        fromSolved: true,
        load: 'R U',
        body: <p>R has order 4 and U has order 4. How many times do you think you must repeat R U?</p>,
        choices: [
          { text: 'About 4', correct: false, feedback: "That's a natural guess. Press the button to find out." },
          { text: 'About 20', correct: false, feedback: 'Bigger. Press the button to find out.' },
          { text: 'More than 100', correct: true, feedback: 'Bold guess, and right: it is 105.' },
        ],
        actions: [{ label: 'Play R U until solved', run: () => playFast(repeat(['R', 'U'], 105), 14) }],
        task: 'Watch R U repeat until the cube comes back.',
        done: (c) => c.actions.has('Play R U until solved'),
        success: 'R U has order 105. Two moves of order 4 can combine into something with a huge order.',
      },
      {
        kind: 'prove',
        title: 'Find an order of 6',
        load: '',
        body: <p>Type a sequence whose order is exactly 6. The Order card updates as you type.</p>,
        analysis: true,
        task: 'The sequence box holds a sequence of order 6.',
        done: (c) => c.analysis?.order === 6,
        success: 'Order 6. Repeat it six times and the cube is solved.',
        hint: 'Try two faces with some primes or doubles. R2 U2 is one of many answers.',
      },
    ],
  },
  {
    id: 'commute',
    number: 3,
    title: 'Order matters',
    concept: 'Non-commutativity',
    summary: 'R then U is not the same as U then R. That one fact makes the cube interesting.',
    steps: [
      {
        kind: 'do',
        title: 'Same moves, different order',
        fromSolved: true,
        body: <p>Watch both of these, starting from solved each time. Look closely at the top and right faces.</p>,
        actions: [
          {
            label: 'Show R then U',
            run: () => {
              reset()
              playSequence(['R', 'U'])
            },
          },
          {
            label: 'Show U then R',
            run: () => {
              reset()
              playSequence(['U', 'R'])
            },
          },
        ],
        task: 'Watch both versions.',
        done: (c) => c.actions.size >= 2,
      },
      {
        kind: 'notice',
        title: 'Were the two cubes the same?',
        body: <p>Compare where the stickers ended up after R U and after U R.</p>,
        choices: [
          {
            text: 'Yes, identical',
            correct: false,
            feedback: 'Look again: several stickers ended up in different places.',
          },
          { text: 'No, they were different', correct: true, feedback: 'Right. Swapping the order changed the result.' },
        ],
      },
      {
        kind: 'name',
        title: 'Commuting moves',
        body: (
          <>
            <p>
              Two moves <b>commute</b> when their order doesn't matter. R and U don't commute, so the cube's moves are{' '}
              <b>non-commutative</b>.
            </p>
            <p>That's why solving needs care: the same moves in another order give a different cube.</p>
          </>
        ),
        formal: (
          <p>
            In general <TeX>{'g\\,h \\ne h\\,g'}</TeX>. A group where <TeX>{'g\\,h = h\\,g'}</TeX> for every pair is
            called abelian; the cube group is non-abelian.
          </p>
        ),
      },
      {
        kind: 'explore',
        title: 'A test for commuting',
        load: "R L R' L'",
        analysis: true,
        body: (
          <p>
            If X and Y commute, then X Y X′ Y′ does nothing, because Y and X′ can swap and cancel. This shape is called
            a <b>commutator</b>. Try R L R′ L′ and look at its order.
          </p>
        ),
        task: "The sequence box holds X Y X' Y' (two different faces) that does nothing.",
        done: (c) => isCommutatorShape(c) && c.analysis?.order === 1,
        success: 'Order 1: these two faces commute.',
        hint: 'Opposite faces never touch the same pieces.',
        formal: (
          <p>
            The commutator <TeX>{'[g, h] = g\\,h\\,g^{-1}h^{-1}'}</TeX> equals <TeX>e</TeX> exactly when <TeX>g</TeX>{' '}
            and <TeX>h</TeX> commute.
          </p>
        ),
      },
      {
        kind: 'prove',
        title: 'Which face commutes with U?',
        load: 'U',
        body: <p>Find a face X, other than U, so that U X U′ X′ does nothing. Type the whole sequence.</p>,
        analysis: true,
        task: "The sequence box holds U X U' X' and it does nothing.",
        done: (c) => isCommutatorShape(c, 'U') && c.analysis?.order === 1,
        success: 'Yes: U and its partner never share a piece, so they commute.',
        hint: 'Which face shares no pieces with the top face?',
      },
    ],
  },
  {
    id: 'cycles',
    number: 4,
    title: 'Watch the pieces move',
    concept: 'Permutations and cycles',
    summary: 'Every sequence just moves pieces round in loops. Seeing those loops explains everything else.',
    steps: [
      {
        kind: 'do',
        title: 'Spot what moves',
        fromSolved: true,
        load: "R U R' U'",
        body: <p>Play R U R′ U′ with focus on: every piece it leaves alone is dimmed.</p>,
        actions: [
          {
            label: "Play R U R' U' with focus",
            run: () => playWithFocus("R U R' U'"),
          },
        ],
        task: 'Play it with focus on.',
        done: (c) => c.actions.size >= 1,
      },
      {
        kind: 'notice',
        title: 'How many edges moved?',
        body: <p>Count the edge pieces (the ones with two stickers) that are not dimmed.</p>,
        choices: [
          { text: '2', correct: false, feedback: 'Look again: three edges stay bright.' },
          { text: '3', correct: true, feedback: 'Yes: three edges, and four corners.' },
          { text: '4', correct: false, feedback: 'Look again, and count only the bright edges.' },
        ],
      },
      {
        kind: 'name',
        title: 'Cycles',
        body: (
          <>
            <p>
              The three edges move in a loop: UR goes to UB's place, UB to FR's, and FR back to UR's. A loop like this
              is a <b>cycle</b>, written UR → UB → FR.
            </p>
            <p>
              Any sequence, however long, is just a set of cycles of pieces, some of them twisted. That description is
              called a <b>permutation</b>.
            </p>
          </>
        ),
        formal: (
          <p>
            In cycle notation the edges of R U R′ U′ are <TeX>{'(\\text{UR}\\;\\text{UB}\\;\\text{FR})'}</TeX>. The cube
            group is a subgroup of the permutations of its 48 moving stickers.
          </p>
        ),
      },
      {
        kind: 'explore',
        title: 'Follow one piece',
        fromSolved: true,
        load: "R U R' U'",
        analysis: true,
        body: (
          <p>
            Use Track a piece below to follow a corner through R U R′ U′. Try UFR, then try a few sequences of your own
            and watch the cycles change.
          </p>
        ),
      },
      {
        kind: 'prove',
        title: 'Make a 5-cycle',
        load: '',
        analysis: true,
        body: <p>Find a sequence where the corners travel in a single loop of five.</p>,
        task: 'The corners form exactly one 5-cycle.',
        done: (c) => {
          const corners = c.analysis?.orbits.find((o) => o.orbit === 'CORNERS')
          return corners?.cycles.length === 1 && corners.cycles[0].positions.length === 5
        },
        success: 'A single 5-cycle of corners.',
        hint: 'Two different faces, one turn each, is enough.',
      },
    ],
  },
  {
    id: 'commutators',
    number: 5,
    title: 'Change only a few pieces',
    concept: 'Commutators',
    summary: 'X Y X′ Y′ only disturbs the pieces X and Y share. Keep the overlap small and you move just a few pieces.',
    steps: [
      {
        kind: 'do',
        title: 'Four moves, few pieces',
        fromSolved: true,
        body: <p>Play R U R′ U′ with focus on. Pieces it leaves alone are dimmed.</p>,
        actions: [{ label: "Play R U R' U' with focus", run: () => playWithFocus("R U R' U'") }],
        task: 'Play it with focus on.',
        done: (c) => c.actions.size >= 1,
      },
      {
        kind: 'notice',
        title: 'How much of the cube moved?',
        body: <p>A cube has 20 pieces that move: 8 corners and 12 edges. How many stayed bright?</p>,
        choices: [
          {
            text: '7',
            correct: true,
            feedback: 'Yes: 4 corners and 3 edges. The other 13 are exactly where they were.',
          },
          { text: '12', correct: false, feedback: 'Fewer than that. Count the bright corners and edges separately.' },
          { text: 'All 20', correct: false, feedback: 'Look again: most of the cube is dimmed.' },
        ],
      },
      {
        kind: 'name',
        title: 'Commutators',
        body: (
          <>
            <p>
              A sequence of the shape X Y X′ Y′ is a <b>commutator</b>. You met it in lesson 3 as a test for commuting.
            </p>
            <p>
              Here's why it moves so little. A piece that only X touches is put back by X′. A piece that only Y touches
              is put back by Y′. Only pieces in the <b>overlap</b>, the ones both X and Y touch, can end up somewhere
              new. R and U share just a few pieces, so R U R′ U′ moves just a few.
            </p>
          </>
        ),
        formal: (
          <p>
            The commutator of <TeX>g</TeX> and <TeX>h</TeX> is <TeX>{'[g, h] = g\\,h\\,g^{-1}h^{-1}'}</TeX>. If{' '}
            <TeX>g</TeX> and <TeX>h</TeX> move disjoint sets of pieces they commute, and <TeX>{'[g, h] = e'}</TeX>. When
            the overlap is small, <TeX>{'[g, h]'}</TeX> moves only a few pieces.
          </p>
        ),
      },
      {
        kind: 'explore',
        title: 'Shrink the overlap to one piece',
        fromSolved: true,
        load: CORNER_3_CYCLE,
        analysis: true,
        body: (
          <>
            <p>
              X doesn't have to be one move. Take X = R U R′: on the bottom layer it changes just one spot, the
              front-right corner. Take Y = D, which turns only the bottom layer. They overlap in one place.
            </p>
            <p>
              So X Y X′ Y′ = R U R′ D R U′ R′ D′. Play it and check the panel: exactly 3 corners move, and nothing else.
            </p>
          </>
        ),
        actions: [{ label: 'Play it with focus', run: () => playWithFocus(CORNER_3_CYCLE) }],
        formal: (
          <p>
            This is <TeX>{"[R\\,U\\,R', D]"}</TeX>, a 3-cycle of corners. 3-cycles are the building blocks: every even
            permutation is a product of them.
          </p>
        ),
      },
      {
        kind: 'prove',
        title: 'Your own 3-piece sequence',
        load: '',
        analysis: true,
        body: <p>Find a sequence that moves exactly 3 pieces, but not the same 3 corners as the one in Explore.</p>,
        task: 'Exactly 3 pieces move, and they are not UFR, DRF and DFL.',
        done: (c) => {
          if (totalAffected(c.analysis) !== 3) return false
          const cycle = cornerCycle(c.analysis)
          return !(cycle && ['UFR', 'DRF', 'DFL'].every((n) => cycle.includes(n)))
        },
        success: 'Three pieces, and the rest of the cube untouched.',
        hint: "Keep X = R U R' and change Y: try D' instead of D (and D instead of D' at the end).",
      },
    ],
  },
  {
    id: 'conjugates',
    number: 6,
    title: 'Set up, do, undo',
    concept: 'Conjugates',
    summary: 'A B A′ does B somewhere else. That one trick aims every algorithm at the pieces you need.',
    steps: [
      {
        kind: 'do',
        title: 'The same trick, moved',
        fromSolved: true,
        body: <p>Watch the corner 3-cycle from lesson 5, then the same thing with U2 before and after it.</p>,
        actions: [
          { label: 'Show the 3-cycle', run: () => playWithFocus(CORNER_3_CYCLE) },
          { label: 'Show U2, the 3-cycle, U2', run: () => playWithFocus(`U2 ${CORNER_3_CYCLE} U2`) },
        ],
        task: 'Watch both.',
        done: (c) => c.actions.size >= 2,
      },
      {
        kind: 'notice',
        title: 'What changed?',
        body: <p>Compare which pieces stayed bright each time.</p>,
        choices: [
          {
            text: 'The same kind of change, on different pieces',
            correct: true,
            feedback: 'Right: still 3 corners in a loop, but a different 3.',
          },
          {
            text: 'A completely different kind of change',
            correct: false,
            feedback: 'Count again: 3 corners both times.',
          },
          { text: 'Nothing changed', correct: false, feedback: 'Look at which top corner joins in the second time.' },
        ],
      },
      {
        kind: 'name',
        title: 'Conjugates',
        body: (
          <>
            <p>
              A B A′ is a <b>conjugate</b>. A is the <b>setup</b>: it moves the pieces you care about to where B works.
              B does its job there. A′ puts everything back, carrying B's effect along.
            </p>
            <p>So a conjugate is the same move done from a different place. Speedcubers do this all the time.</p>
          </>
        ),
        formal: (
          <>
            <p>
              The conjugate of <TeX>h</TeX> by <TeX>g</TeX> is <TeX>{'g\\,h\\,g^{-1}'}</TeX>. It relabels the pieces: if{' '}
              <TeX>h</TeX> is the cycle <TeX>{'(a\\; b\\; c)'}</TeX>, then
            </p>
            <TeX block>{'g\\,(a\\; b\\; c)\\,g^{-1} = (g(a)\\; g(b)\\; g(c))'}</TeX>
            <p>So conjugates always have the same cycle shape.</p>
          </>
        ),
      },
      {
        kind: 'explore',
        title: 'Try other setups',
        fromSolved: true,
        load: `U ${CORNER_3_CYCLE} U'`,
        analysis: true,
        body: (
          <p>
            Change the setup at both ends (U and U′ here) to anything you like, as long as the end undoes the start.
            Watch the panel: the pieces change, the shape never does.
          </p>
        ),
      },
      {
        kind: 'prove',
        title: 'Aim it at UBL',
        load: CORNER_3_CYCLE,
        analysis: true,
        body: (
          <p>Add a setup so that the 3-cycle includes the top-back-left corner, UBL, and still moves nothing else.</p>
        ),
        task: 'A single 3-cycle of corners that includes UBL.',
        done: (c) => totalAffected(c.analysis) === 3 && (cornerCycle(c.analysis)?.includes('UBL') ?? false),
        success: 'Aimed: the same 3-cycle, now working on UBL.',
        hint: 'Which turn of the top face brings UBL to the front-right? Put it first, and its inverse last.',
      },
    ],
  },
  {
    id: 'parity',
    number: 7,
    title: "Why you can't swap two edges",
    concept: 'Parity',
    summary:
      'Every quarter turn is odd for corners and odd for edges, so the two always match. A lone swap breaks that.',
    steps: [
      {
        kind: 'do',
        title: 'Count the swaps',
        fromSolved: true,
        load: 'R',
        analysis: true,
        body: (
          <>
            <p>Play R. Four corners move round in a loop, and four edges do too.</p>
            <p>
              A loop of 4 can be built from swaps: swap the first two, then the first and third, then the first and
              fourth. That's 3 swaps.
            </p>
          </>
        ),
        task: 'Play R.',
        done: (c) => c.history.includes('R'),
      },
      {
        kind: 'notice',
        title: 'Odd or even?',
        body: <p>A quarter turn is one 4-loop of corners and one 4-loop of edges. Each takes 3 swaps.</p>,
        choices: [
          { text: 'Odd for corners and odd for edges', correct: true, feedback: 'Yes: 3 swaps each, and 3 is odd.' },
          { text: 'Odd for corners, even for edges', correct: false, feedback: 'The edges also move in a 4-loop.' },
          { text: 'Even for both', correct: false, feedback: '3 swaps is an odd number.' },
        ],
      },
      {
        kind: 'name',
        title: 'Parity',
        body: (
          <>
            <p>
              A rearrangement is <b>even</b> if it can be made from an even number of swaps and <b>odd</b> otherwise. It
              can never be both. This is its <b>parity</b>.
            </p>
            <p>
              Every quarter turn flips the corner parity and the edge parity together. So after any sequence they always
              match. Swapping just two edges would make edges odd and corners even: no sequence can do that.
            </p>
          </>
        ),
        formal: (
          <>
            <p>
              The sign <TeX>{'\\operatorname{sgn}(\\sigma) = \\pm 1'}</TeX> of a permutation is <TeX>{'(-1)'}</TeX> to
              the number of swaps, and{' '}
              <TeX>{'\\operatorname{sgn}(\\sigma\\tau) = \\operatorname{sgn}(\\sigma)\\operatorname{sgn}(\\tau)'}</TeX>.
              A 4-cycle has sign <TeX>{'-1'}</TeX>. Every face turn has sign <TeX>{'-1'}</TeX> on corners and on edges,
              so for every cube position
            </p>
            <TeX block>
              {'\\operatorname{sgn}(\\sigma_{\\text{corners}}) = \\operatorname{sgn}(\\sigma_{\\text{edges}})'}
            </TeX>
          </>
        ),
      },
      {
        kind: 'explore',
        title: 'They always agree',
        load: 'R U',
        analysis: true,
        body: (
          <p>
            Type any sequences you like and watch the parity in the panel's invariants. Corners and edges always agree.
          </p>
        ),
      },
      {
        kind: 'prove',
        title: 'The impossible cube',
        load: '',
        analysis: true,
        body: (
          <p>
            A friend hands you a cube that is solved except for two edges swapped. Then find a sequence that makes the
            corners odd.
          </p>
        ),
        choices: [
          {
            text: 'It was taken apart and put back',
            correct: true,
            feedback: 'Yes. No sequence of turns can swap just two edges.',
          },
          {
            text: 'They found a clever sequence',
            correct: false,
            feedback: "Two edges swapped means edges odd, corners even. Turns can't separate them.",
          },
        ],
        task: 'The sequence box makes the corners odd.',
        done: (c) => orbit(c.analysis, 'CORNERS')?.parity === 'odd',
        success: 'Corners odd, and the edges are odd too. They always match.',
        hint: 'One quarter turn is enough.',
      },
    ],
  },
  {
    id: 'twists',
    number: 8,
    title: "Why you can't twist one corner",
    concept: 'Invariants',
    summary:
      'Corner twists add up to zero, edge flips add up to zero, and parities match. Only 1 in 12 reassembled cubes can be solved.',
    steps: [
      {
        kind: 'do',
        title: 'Twist a corner',
        fromSolved: true,
        load: "R' D' R D R' D' R D",
        body: (
          <p>
            Play R′ D′ R D twice. It's the beginner's way to turn a top corner in place. Watch the top-front-right
            corner, then look at the bottom layer.
          </p>
        ),
        task: "Play R' D' R D R' D' R D.",
        done: (c) => c.history.length >= 8,
      },
      {
        kind: 'notice',
        title: 'What happened below?',
        body: <p>The top corner turned in place. Look at the bottom corners.</p>,
        choices: [
          {
            text: 'Some bottom corners twisted too',
            correct: true,
            feedback: 'Yes. The twist had to go somewhere: the bottom corners balance it.',
          },
          { text: 'The bottom stayed perfect', correct: false, feedback: 'Turn the cube over and look again.' },
        ],
      },
      {
        kind: 'name',
        title: 'Invariants',
        body: (
          <>
            <p>
              Give every corner a twist of 0, 1 or 2 (in thirds of a turn). However you turn the cube, the twists always
              add up to a multiple of 3. Edge flips (0 or 1) always add up to an even number. And from lesson 7, the
              parities match.
            </p>
            <p>
              A rule that no sequence can break is an <b>invariant</b>. There are three here, worth 3, 2 and 2 ways to
              go wrong. So if you take a cube apart and put it back at random, only 1 time in 3 × 2 × 2 = 12 can it be
              solved.
            </p>
          </>
        ),
        formal: (
          <>
            <p>
              With corner twists <TeX>{'c_i'}</TeX>, edge flips <TeX>{'e_j'}</TeX> and permutations{' '}
              <TeX>{'\\sigma_c, \\sigma_e'}</TeX>, every position satisfies
            </p>
            <TeX block>
              {
                '\\begin{gathered} \\textstyle\\sum c_i \\equiv 0 \\pmod 3 \\\\ \\textstyle\\sum e_j \\equiv 0 \\pmod 2 \\\\ \\operatorname{sgn}\\sigma_c = \\operatorname{sgn}\\sigma_e \\end{gathered}'
              }
            </TeX>
            <p>Counting what's left gives the size of the cube group:</p>
            <TeX block>
              {'|G| = \\frac{8!\\cdot 3^8 \\cdot 12! \\cdot 2^{12}}{3 \\cdot 2 \\cdot 2} \\approx 4.3 \\times 10^{19}'}
            </TeX>
          </>
        ),
      },
      {
        kind: 'explore',
        title: 'Two twists, nothing else',
        fromSolved: true,
        load: TWO_TWISTS,
        analysis: true,
        body: (
          <p>
            Twist one corner, turn the top with U, then untwist the next corner with the reverse, D′ R′ D R twice. The
            bottom layer repairs itself. Play it: one corner turns each way, and the panel's twist total stays 0.
          </p>
        ),
        formal: (
          <p>
            A commutator again: <TeX>{"[\\,(R'D'RD)^2,\\; U\\,]"}</TeX>. Its two parts overlap in a single corner
            position, so only two corners change.
          </p>
        ),
      },
      {
        kind: 'prove',
        title: 'Twist a different pair',
        load: TWO_TWISTS,
        analysis: true,
        body: <p>Change the sequence so it twists UFR and ULF, the two front corners on top, and nothing else.</p>,
        task: 'Only UFR and ULF are twisted in place.',
        done: (c) => {
          const corners = orbit(c.analysis, 'CORNERS')
          const twisted = corners?.twistedInPlace.map((t) => corners.names[t.position]).sort()
          return totalAffected(c.analysis) === 2 && twisted?.join(' ') === 'UFR ULF'
        },
        success: 'Two front corners twisted, the rest of the cube untouched.',
        hint: "The U in the middle chooses the second corner. Try U' there, and U at the end.",
      },
    ],
  },
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)
