# 3×3 solver engine

The 2×2 solver's framework (`src/solver/`), carried to the 3×3: a **ceiling** (any solution), a **floor** (the distance in a smaller puzzle, which can never exceed the real distance) and a **prover** (IDA\*). When the floor meets the ceiling, the answer is proven. No UI yet.

| File | What it is |
| --- | --- |
| `cube3.ts` | Cubie model: 8 corners (place, twist), 12 edges (place, flip), fixed centres, Kociemba's labels, 18 face turns (half-turn metric). A position is one 40-byte `Uint8Array`. Converts to and from cubing.js pattern data. |
| `tables.ts` | Six coordinate puzzles and their floors, each built by breadth-first search in its own space. |
| `engine.ts` | `ida` (the prover), `prove` (floor meets ceiling), `cubingCeiling`, and `solve3`, which puts them together. |
| `worker.ts`, `protocol.ts`, `client.ts` | Runs the solver in a web worker, like `src/solver/`. A solve posts a `round` message for each completed round, then `solved`. |

## How it works

**Floors.** Each coordinate sees only part of the cube, and a face turn moves it to a value that depends only on the value it had, so each is a puzzle in its own right. Its move table is built by breadth-first search from solved, keeping one real cube per value reached (so no unranking is needed, and the search checks that every value is reached). Its distance table is a second breadth-first search over the coordinate's own values.

| Floor | Values | Deepest |
| --- | --- | --- |
| Corner twists | 2,187 | 6 |
| Edge flips | 2,048 | 7 |
| UD-slice (where FR, FL, BL, BR are) | 495 | 5 |
| Corner places | 40,320 | 7 |
| Twists × slice | 1,082,565 | 9 |
| Flips × slice | 1,013,760 | 9 |

The floor is the highest of the six. Inside the search only three are looked up, because twists × slice can never be lower than twists or slice alone (and likewise for flips). The six distance tables take about 2.1 MB and the four move tables about 1.6 MB; all of them build in about 0.4–0.7 s.

**Prover.** IDA\* on the full cube: a stack of 40-byte states in one typed array, plus the four coordinates carried along through their move tables for the floor. It never turns the same face twice in a row, and turns opposite faces only in the order U before D, R before L, F before B. Each round that finishes without a solution proves the position needs more than its bound; the next bound is the smallest overshoot seen in the round, and that is the proven floor. It stops at a node budget (positions looked at) and reports each completed round as it goes.

**Ceiling.** cubing.js's `experimentalSolve3x3x3IgnoringCenters`, checked against the cubie model before use. The prover runs bounds below the ceiling's length only: if it finds a solution, that one is shorter and proven shortest; if its bound reaches the ceiling's length, the ceiling is proven optimal. Otherwise the result is a gap.

```ts
const t = buildTables()
const report = await solve3(t, ['R', 'U', "F'"], { budget: 40_000_000 })
// { solution, ceiling, provenFloor, status: 'proven' | 'gap', source, rounds, nodes, ms, ceilingMs, … }
```

## Tests (`tests/unit/solver3.test.ts`)

- Every move has order 4 (half turns order 2), and the model matches cubing.js's 3×3 KPuzzle on each move and on 500 random sequences, both ways.
- No floor is higher than the true distance on any of the 621,649 positions within 5 moves of solved (breadth-first search on the full cube, deduplicated; ring sizes match the published 1, 18, 243, 3,240, 43,239, 574,908).
- On 200 random positions up to 7 moves, the solver is proven and its length equals the exact distance (radius-5 table plus every 0–2 move prefix).
- Superflip: floor ≤ 20, and within a 3-million-position budget it reports a gap with proven floor ≤ 20 < ceiling, a ceiling that solves it, and one `onRound` call per completed round.
- The prover replaces a ceiling that is too long, proves one that is optimal, respects the move-order rules, and stops at its budget.

## Measured

Run with `node scripts/bench-solver3.ts` (Node 22.18 or later runs the TypeScript directly). Measured on 30 October 2026 on one core of an Intel Xeon @ 2.10 GHz (cloud container, 4 vCPUs), Node 22.22.0.

**Speed: 19.4 million positions per second** (mean over five random-state positions, 10 million positions each, after a warm-up). A position is one child whose floor was looked up; the cube itself is only turned for children that survive the floor.

**Share proven optimal within a 2-second budget.** The budget is in positions, 2 s × the measured speed = 38.8 million, so a run is repeatable; actual prover times are close to 2 s. The cubing.js ceiling is timed separately and not counted. Scrambles are random face turns that never turn the same face twice in a row; random states are uniformly random positions (`randomPositionData` from `src/daily/scramble.ts`). Seed 2026.

| Scrambles | Proven optimal | Mean optimal length (proven) | Mean floor → ceiling (gaps) | Median prover time | Median ceiling time |
| --- | --- | --- | --- | --- | --- |
| 8 random moves (50) | 50/50 (100%) | 7.8 | – | 0 ms | 1 ms |
| 10 random moves (50) | 50/50 (100%) | 9.4 | – | 2 ms | 2 ms |
| 12 random moves (50) | 50/50 (100%) | 11.4 | – | 149 ms | 4 ms |
| 14 random moves (50) | 15/50 (30%) | 11.3 | 12.9 → 19.3 | 1,910 ms | 8 ms |
| Random state (20) | 0/20 (0%) | – | 13.0 → 20.6 | 2,225 ms | 18 ms |

**Reading it.** Each round costs roughly 13× the one before (9–19× measured on random states), so the floors' strength sets where proofs stop: positions up to about 12 moves away are proven in well under a second, and from 13 moves on the 2-second budget runs out. A typical random position is 17–18 moves away while its floor starts at about 7 (mean 7.1 over 20 random states), and 2 seconds lifts the proven floor to about 13, so a proof would need four or five more rounds, each about 13× longer. Closing that gap needs stronger floors (larger pattern databases such as corners at 88 million entries, or symmetry-reduced phase-1 tables), not a faster loop.
