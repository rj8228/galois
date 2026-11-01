# Galois Lenses: design and build plan

Nine "lenses": other ways to look at the cube, from the Galois Lenses design canvas (10 October 2026). Each `*.html` here is one phone screen (390 × 844) as drawn; each `*.png` is that screen rendered. `Main` is the Rings lens. `canvas.json` is the canvas's layout.

## Where each lens goes

| Lens | Design | Where it lives in the app | What it reads |
|---|---|---|---|
| Net | `Net` | Play stage, lens bar | the sequence box (`sequenceText`) applied to a solved cube |
| Rings | `Main` | Play stage, lens bar | the sequence box: its cycles (`src/engine/analysis.ts`) |
| Path | `Path` | Play stage, lens bar | the sequence box, repeated: one piece's route (`tracePiece`) |
| Progress | `Progress` | Play stage, lens bar | the current position (`scramble` + `history`) |
| Top | `Top` | Play stage, lens bar | the current position, top colour only |
| Home | `Home` | Play stage, lens bar | the current position: where each top-layer piece belongs, and a short solution |
| Tree | `Tree` | Decode, inside an algorithm's breakdown | the algorithm's commutator/conjugate structure |
| Graph | `Graph` | Learn, lesson 9 (subgroups) | the moves the reader picks: the subgroup they generate |
| Far | `Far` | Learn, lesson 12 (God's number) | the published counts of 3×3 positions by distance |

## The base (already on `phase-8-lenses`)

- `src/lenses/types.ts`: the `Lens` type: `id`, `label`, `hint`, `View`.
- `src/lenses/registry.ts`: `LENSES = [cube, ...SEE_LENSES, ...SOLVE_LENSES]`.
- `src/lenses/see.ts` (task L1) and `src/lenses/solve.ts` (task L2): each task's own list.
- `src/lenses/LensBar.tsx`: the lens buttons on the Play stage and the active lens's view. The bar stays hidden while the cube is the only lens.
- `src/lenses/state.ts`: the active lens, remembered per device.
- `src/cube/CubeStage.tsx`: on Play, a lens replaces the 3D view. The player stays mounted, hidden, and the stage grows to 64% of the screen height.

## Two tasks, in parallel

| Task | Brief | Branch | Owns |
|---|---|---|---|
| L1 See what a move does | [L1-see.md](L1-see.md) | `lenses-see` | Net, Rings, Path (`src/lenses/see.ts`), Tree (Decode) |
| L2 Solve with it, zoom out | [L2-solve.md](L2-solve.md) | `lenses-solve` | Progress, Top, Home (`src/lenses/solve.ts`), Graph (lesson 9), Far (lesson 12) |

Both branch from `origin/phase-8-lenses` and open their pull request into it. The main session reviews, stitches, and opens one pull request to `main`.
