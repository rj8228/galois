import { kpuzzle } from '../analysis/kpuzzle.ts'
import { invertMove } from '../cube/notation.ts'
import { highlight, playFast, playSequence, reset } from '../cube/state.ts'
import { affectedPieces, analyse, highlightMask } from '../engine/analysis.ts'
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
            A group has an identity element <i>e</i>, and every element <i>g</i> has an inverse <i>g</i>⁻¹ with <i>g</i>{' '}
            · <i>g</i>⁻¹ = <i>e</i>. On the cube: R · R′ = <i>e</i>, and R2 · R2 = <i>e</i>.
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
            The inverse of a product reverses the order: (<i>g</i>
            <i>h</i>)⁻¹ = <i>h</i>⁻¹<i>g</i>⁻¹. This is sometimes called the socks-and-shoes rule.
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
            The order of <i>g</i> is the smallest <i>n</i> ≥ 1 with <i>g</i>
            <sup>n</sup> = <i>e</i>. In a finite group every element has finite order.
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
            In general <i>g</i>
            <i>h</i> ≠ <i>h</i>
            <i>g</i>. A group where <i>g</i>
            <i>h</i> = <i>h</i>
            <i>g</i> for every pair is called abelian; the cube group is non-abelian.
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
            The commutator [<i>g</i>, <i>h</i>] = <i>g</i>
            <i>h</i>
            <i>g</i>⁻¹<i>h</i>⁻¹ equals <i>e</i> exactly when <i>g</i> and <i>h</i> commute.
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
            run: () => {
              reset()
              const kp = kpuzzle.value
              if (kp) highlight.value = highlightMask(affectedPieces(analyse(kp, "R U R' U'")))
              playSequence(['R', 'U', "R'", "U'"])
            },
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
            In cycle notation the edges of R U R′ U′ are (UR UB FR). The cube group is a subgroup of the permutations of
            its 48 moving stickers.
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
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)
