# L2 Lenses: solve with it, zoom out (Progress, Top, Home, Graph, Far)

**Branch** `lenses-solve` from `origin/phase-8-lenses` · **Pull request into** `phase-8-lenses` (not `main`)

Read [README.md](README.md) first: where each lens goes, and the base already built (`src/lenses/`).

## Goal

Build five lenses from the design, as working parts of the app, in its existing style.
- **Progress, Top and Home** go in the Play stage's lens bar.
- **Graph** goes in Learn lesson 9.
- **Far** goes in Learn lesson 12.

The design screens are `Progress`, `Top`, `Home`, `Graph` and `Far` in this folder. Open each `.png` for the look and each `.html` for exact text, colours and layout. Use the app's own CSS variables (`--accent`, `--muted`, `--line`, `--surface`, `--ink`, `--mono` and the rest, in `src/styles/looks.css`), so the lenses follow the user's chosen look. Don't copy the mockups' hex values.

## What each lens does

The three Play lenses read the current position: `scramble` then `history`, from `src/cube/state.ts`, applied with cubing.js's 3×3 model (`src/analysis/kpuzzle.ts`). They update as the cube is turned.

1. **Progress.** How solved the position is, in layer-by-layer terms:
   - pieces home and straight, out of 20
   - per layer (top, middle, bottom)
   - which pieces are home but turned, or in the wrong slot
   - the checklist: cross, layer 1, layer 2, top colour, top pieces
   - one sentence on the next step, and a button that opens the Top lens (set `activeLens` from `src/lenses/state.ts`)

   Cube orientation: the solved cube's U face is the top, as on the stage.
2. **Top.** The top layer from above, with only the top colour shown (the U face plus the top layer's side stickers).
   - The corner twists, and their sum, which is always a multiple of 3.
   - Name the case when it is one of the seven named top-colour cases with the cross done (Sune "fish" and the others); otherwise no name.
   - A button to the Home lens.
3. **Home.** Arrows from where each top-layer piece sits to where it belongs (corner swaps and loops, edge loops), with pieces already home marked.
   - Add a short solution of the current position, with "Play it on the cube".
   - For the solution, use the app's 3×3 engine (`solve3` in `src/solver3/engine.ts`, run in its worker through `src/solver3/client.ts`) with a small budget. Say "shortest, proven" when it proves the solution optimal, and "a solution" when not.
   - When the bottom two layers are not solved, say Home works on the last layer, and show the top layer anyway.
4. **Graph** (Learn lesson 9, subgroups). The reader picks moves (R2 and U2 to start; a "+" adds one).
   - Explore the subgroup they generate by breadth-first search, capped at 5,000 positions.
   - Draw the graph: a loop for one cycle (R2 and U2 give 12 positions on one loop), rings by distance otherwise.
   - Tapping a node shows its distance and a move sequence that reaches it.
   - Numbers: positions, furthest distance, and the order of the product of the moves.
   - Past the cap, say how many positions were found and that the group is far larger ("watch it explode").
5. **Far** (Learn lesson 12, God's number). Every 3×3 position sorted into rings by its face-turn distance from solved, out to ring 20, the edge proved in 2010.
   - Show the counts. They are exact up to distance 15 and estimated beyond.
   - Take them from cube20.org and cite it in the lesson. The first rings are 18; 243; 3,240; 43,239; 574,908.
   - Make the outer rings honest: label estimates as estimates.
   - "Watch a solver search inward" links to the Solver (`href('solver')`).

To embed Graph and Far, see how lessons render (`src/learn/lessons.tsx`, `LessonView.tsx`) and add each as a block in its lesson.

## Rules

- **Your files:**
  - `src/lenses/solve.ts` (register Progress, Top and Home there, in that order)
  - new files for your lenses (`src/lenses/progress/`, `top/`, `home/`, and `src/learn/` widgets for Graph and Far), each with its own CSS file imported by its component
  - lessons 9 and 12
  - your own test files
- **Not your files:** don't change the base (`src/lenses/types.ts`, `registry.ts`, `LensBar.tsx`, `lenses.css`, `state.ts`, `src/cube/CubeStage.tsx`), `src/lenses/see.ts`, or `src/solver3/` beyond calling it. Task L1 and the main session work in parallel. If you truly need a base change, keep it minimal and explain it in the pull request.
- **Accessible as built:**
  - every drawing an SVG with `role="img"` and an `aria-label` that says what it shows
  - real buttons
  - text contrast 4.5:1 or more, in every look
  - touch targets of at least 44 px
  - a layout that works at 360 px wide
- **Light:** no new dependencies. Lighthouse in CI must stay at 90+, so load the solver only when Home asks for it.

## Tests

- **Unit:**
  - Progress counts on known positions (solved: 20/20; after R: the right counts per layer)
  - the Top twist sum is a multiple of 3 on random positions, and Sune's case is named
  - Home's arrows on a known last-layer case
  - Graph: R2 and U2 give exactly 12 positions with furthest distance 6, and the cap holds
  - Far's counts add up as stated for the exact rings
- **E2E** (`tests/e2e/lenses-solve.spec.ts`, phone, tablet and laptop):
  - each Play lens shows its key numbers after a known sequence
  - Graph in lesson 9 and Far in lesson 12 render
- **Screenshots:** commit each finished lens at 390 × 844 to `design/lenses/built/` (Progress, Top, Home, Graph, Far), so the review can compare them with the design.
- **Before the pull request,** run `npm run lint`, `npm run typecheck`, `npm test` and `npm run e2e` locally.

## Done when

- The five lenses work, as described.
- The tests pass.
- The screenshots are committed.
- The pull request is open into `phase-8-lenses`.

**Time box: about 2 hours of session time.** Push checkpoints every hour. If time runs short, finish Progress, Top and Home well before starting Graph and Far.
