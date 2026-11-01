# L1 Lenses: see what a move does (Net, Rings, Path, Tree)

**Branch** `lenses-see` from `origin/phase-8-lenses` · **Pull request into** `phase-8-lenses` (not `main`)

Read [README.md](README.md) first: where each lens goes, and the base already built (`src/lenses/`).

## Goal

Build four lenses from the design, as working parts of the app, in its existing style.
- **Net, Rings and Path** go in the Play stage's lens bar.
- **Tree** goes in Decode.

The design screens are `Net`, `Main` (Rings), `Path` and `Tree` in this folder. Open each `.png` for the look and each `.html` for exact text, colours and layout. Use the app's own CSS variables (`--accent`, `--muted`, `--line`, `--surface`, `--ink`, `--mono` and the rest, in `src/styles/looks.css`), so the lenses follow the user's chosen look. Don't copy the mockups' hex values.

## What each lens does

All three Play lenses read the sequence box: `sequenceText` in `src/cube/SequenceBar.tsx` (default "R U"). They update as it changes. An empty or invalid sequence shows one plain line, not an error.

1. **Net.** The cube unfolded flat (U on top; L F R B across; D below) after the sequence, applied to a solved cube.
   - Outline the strips that moved.
   - Show three numbers: stickers moved, stickers that stay, and the sequence's order (`src/engine/order.ts`).
   - You need a facelet view of a cubing.js pattern. Write a small, tested mapping, from pieces and orientations to 54 stickers.
2. **Rings.** The sequence's cycles: edges on the outer ring and corners on the inner ring, each laid out in loop order so one loop reads as one arc.
   - Pieces that stay put are grey, and a piece that twists or flips in place gets a small loop arrow.
   - The card gives the cycle lengths, how pieces come back turned, and `order = lcm(...)`.
   - Use `analyse()` and `OrbitAnalysis` from `src/engine/analysis.ts` and the piece names from `src/engine/pieces.ts`.
3. **Path.** Follow one piece while the sequence repeats: the slots it visits in one lap, and how many laps until it comes home straight.
   - Default to the first piece of the longest corner cycle.
   - Tapping another piece on the drawing switches to it.
   - Use `tracePiece()`.
4. **Tree** (Decode). An algorithm's structure as nested boxes: commutator [X, Y] and conjugate [A: B], as in the `Tree` design for Niklas, `[R, [U′: L′]]`.
   - Tapping a box plays just that part on the cube.
   - Add it to the algorithms in `src/decode/breakdowns.ts` whose structure is a commutator or conjugate, Niklas first.
   - If a structure isn't in the data yet, add it there with a unit test that the tree expands back to the algorithm's exact moves.

## Rules

- **Your files:**
  - `src/lenses/see.ts` (register Net, Rings and Path there, in that order)
  - new files for your lenses (`src/lenses/net/`, `rings/`, `path/` or similar, each with its own CSS file imported by its component)
  - the Decode page and `src/decode/` for Tree
  - your own test files
- **Not your files:** don't change the base (`src/lenses/types.ts`, `registry.ts`, `LensBar.tsx`, `lenses.css`, `state.ts`, `src/cube/CubeStage.tsx`) or `src/lenses/solve.ts`. Task L2 works in parallel. If you truly need a base change, keep it minimal and explain it in the pull request.
- **Accessible as built:**
  - every drawing an SVG with `role="img"` and an `aria-label` that says what it shows
  - real buttons
  - text contrast 4.5:1 or more, in every look
  - touch targets of at least 44 px
  - a layout that works at 360 px wide
- **Light:** no new dependencies. Lighthouse in CI must stay at 90+.

## Tests

- **Unit:**
  - the facelet mapping: R moves exactly 20 stickers, and R four times is solved
  - Rings data for R U: an edge 7-cycle, a corner 5-cycle coming back turned, one corner twisted in place, order 105
  - Path for R U from URB: URB → DBR → DRF → ULF → UBL, 3 laps to come back straight
  - Tree: every tree expands back to its algorithm
- **E2E** (`tests/e2e/lenses-see.spec.ts`, phone, tablet and laptop):
  - on Play, each lens button shows its lens with its key numbers
  - in Decode, tapping a Tree box plays that part
- **Screenshots:** commit each finished lens at 390 × 844 to `design/lenses/built/` (Net, Rings, Path, Tree), so the review can compare them with the design.
- **Before the pull request,** run `npm run lint`, `npm run typecheck`, `npm test` and `npm run e2e` locally.

## Done when

- The four lenses work, as described.
- The tests pass.
- The screenshots are committed.
- The pull request is open into `phase-8-lenses`.

**Time box: about 2 hours of session time.** Push checkpoints every hour. If time runs short, finish Rings, Net and Path well before starting Tree.
