/**
 * How a part of an algorithm is drawn: the two halves of a commutator and their inverses, a setup and
 * its undo, or a plain run of moves.
 */
export type Role = 'x' | 'y' | 'x-inverse' | 'y-inverse' | 'setup' | 'undo' | 'plain'

export type Part = { moves: string; role: Role; label: string }

export type Breakdown = {
  id: string
  name: string
  /** Where cubers use it. */
  use: string
  parts: Part[]
  /** What it does, and why, in a few short paragraphs. */
  story: string[]
  /** Lessons that explain it, by id. */
  lessons: string[]
}

export const algOf = (b: Breakdown) => b.parts.map((p) => p.moves).join(' ')

export const BREAKDOWNS: Breakdown[] = [
  {
    id: 'corner-twister',
    name: "Beginner's corner algorithm",
    use: "The beginner's method: turning top corners the right way up, one at a time.",
    parts: [
      { moves: "R'", role: 'x', label: 'X' },
      { moves: "D'", role: 'y', label: 'Y' },
      { moves: 'R', role: 'x-inverse', label: 'X′' },
      { moves: 'D', role: 'y-inverse', label: 'Y′' },
    ],
    story: [
      'R′ D′ R D is the plainest commutator there is: [R′, D′]. R′ and D′ share only the three pieces along the bottom-right edge, so it disturbs little else.',
      'Its order is 6. Twice twists the top-front-right corner in place; the bottom gets mixed up, and the other corners are twisted to balance it, as the invariants demand.',
      'Beginners repeat it until the top corner is right, turn the top, and repeat again. The bottom repairs itself by the end because the twists add up to zero.',
    ],
    lessons: ['commutators', 'twists'],
  },
  {
    id: 'niklas',
    name: 'Niklas',
    use: 'Placing the last corners: it cycles three top corners and moves nothing else.',
    parts: [
      { moves: 'R', role: 'x', label: 'X' },
      { moves: "U' L' U", role: 'y', label: "Y = [U': L']" },
      { moves: "R'", role: 'x-inverse', label: 'X′' },
      { moves: "U' L U", role: 'y-inverse', label: 'Y′' },
    ],
    story: [
      'Niklas is a commutator whose second half is a conjugate: [R, [U′: L′]].',
      'Y = U′ L′ U is L′ seen from a different place: the setup U′ brings a corner over, L′ works on it, U puts it back. X = R overlaps Y in just one corner spot.',
      'One shared spot, so the result is a 3-cycle: UFR, URB and UBL go round, and everything else is untouched. Exactly the trick from lessons 5 and 6.',
    ],
    lessons: ['commutators', 'conjugates'],
  },
  {
    id: 'sune',
    name: 'Sune',
    use: 'Orienting the last layer (OLL): turning the top corners to face up.',
    parts: [
      { moves: "R U R'", role: 'setup', label: '[R: U]' },
      { moves: 'U', role: 'plain', label: 'U' },
      { moves: "R U2 R'", role: 'setup', label: '[R: U2]' },
    ],
    story: [
      'Read Sune as two conjugates with a U between them: [R: U], then U, then [R: U2]. Each conjugate is a top-layer turn done from the right-hand side.',
      'Because every R is undone by an R′, the bottom two layers come back exactly. Only the top layer changes: 4 corners and 3 edges.',
      'Its order is 6. Speedcubers use it to turn the top corners face up; the corners it also shuffles are fixed in the last step.',
    ],
    lessons: ['conjugates'],
  },
  {
    id: 't-perm',
    name: 'T-perm',
    use: 'Permuting the last layer (PLL): swapping two corners and two edges.',
    parts: [
      { moves: "R U R' U'", role: 'x', label: '[R, U]' },
      { moves: "R' F R2 U' R' U'", role: 'plain', label: 'middle' },
      { moves: "R U R' F'", role: 'plain', label: 'end' },
    ],
    story: [
      'The T-perm swaps two corners and two edges, nothing else. Two swaps of corners is odd; two swaps of edges is odd too, so the parities still match.',
      "That's why it can't be a single commutator: every commutator is an even rearrangement. It opens with one, [R, U], and needs the rest to make it odd.",
      'Its order is 2: do it twice and the swaps undo themselves.',
    ],
    lessons: ['parity', 'commutators'],
  },
]

export const breakdownById = (id: string) => BREAKDOWNS.find((b) => b.id === id)
