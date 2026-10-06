/** Short how-to notes behind each component's ? button. Plain words, one idea per sentence. */
export const HELP = {
  stage:
    'This is the cube. Drag to rotate your view; that never turns a face. Undo takes back your last move, Scramble mixes the cube into a random position (every position equally likely), and Reset returns it to solved.',
  moves:
    "Tap a letter to turn that face a quarter turn clockwise, as if you were looking straight at it. R is right, L left, U up, D down, F front, B back. A prime (R') turns it anticlockwise, and 2 (R2) turns it twice. Slices (M, E, S) turn a middle layer; x, y and z turn the whole cube.",
  sequence:
    "Type several moves with spaces between them, such as R U R' U'. Brackets repeat a group: (R U)3 means R U three times. Play runs the sequence from the cube's current position and adds it to your moves. On phones, a notation keypad replaces the keyboard.",
  playback:
    '◀ Step and Step ▶ walk through the last sequence one turn at a time without changing your moves. Pause and Play stop and continue. Loop repeats the sequence forever as a demonstration; Stop loop ends it. Speed sets how fast turns animate.',
  order:
    'The order is how many times you must repeat the sequence before the cube comes back to where it started. The counts show how many corners and edges it moves or turns. Focus dims every piece the sequence leaves alone, so you can see what it really does.',
  cycles:
    "Each line is a cycle: the first piece moves to the second one's place, the second to the third, and the last back to the first. Twisted or flipped means the pieces come back turned. Stickers counts the same movement sticker by sticker.",
  invariants:
    "These are rules no sequence can break. Corner swaps and edge swaps always balance (both even or both odd), and the total corner twist and edge flip are always zero. That's why a cube with one twisted corner can never be solved.",
  tracker:
    'Pick a corner or edge. Pieces are named by the faces they touch, so UFR is the up-front-right corner. The list shows where it sits after each move of the sequence, starting from solved. Press Reset, then Play, to watch it travel while the cube dims every other piece.',
  history:
    'Every move you have made since the last scramble or reset, in order. Copy them to save or share a position.',
  look: 'Changes the style of the whole app. Tick Follow my device to switch between a light and a dark look whenever your phone or laptop does.',
  rendering:
    "How the cube is drawn: plain 3D, 3D with floating copies of the hidden faces, sharper 3D, a flat unfolded net, or a top-down view of the top layer. Mirror view adds a second view of the back. Show pieces for greys out pieces that don't matter for a solving stage, as speedcubers do when they practise.",
  typing: 'Choose whether the sequence box uses the on-screen notation keypad or your normal keyboard.',
  lesson:
    'Each lesson has five steps: do something on the cube, notice what happened, learn its name, explore it, then prove you have it with a challenge. Next unlocks when a step is done; Skip lets you move on anyway.',
  daily:
    'One scrambled cube for everyone, new every day at midnight India time. Compete in Speed (fastest solve) and Optimal (fewest moves). Playing either one keeps your streak going.',
  speed:
    'Press Start: you get 15 seconds to look at the cube. The clock starts with your first turn and stops the moment the cube is solved. Your best of 3 attempts counts. While the clock runs, only real turns are allowed (move pad or keyboard).',
  optimal:
    "Find a solution with as few moves as you can. Study the cube freely, then write your solution in face turns (R, U' , F2…). Each turn counts as 1. Use my moves copies what you did on the cube. You get one submission a day, and then Galois shows its own solver's solution.",
  streak:
    'A day counts once you finish a Speed solve or submit an Optimal solution. Every 7 days in a row earns a freeze (hold up to 2), which automatically covers one missed day.',
  badges: 'Badges you can earn, named after the maths where possible. Earned ones show the day you got them.',
  share: 'Copy a short summary of today to paste anywhere. It shows times and move counts, never the solution.',
} as const

export type HelpTopic = keyof typeof HELP
