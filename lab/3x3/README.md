# 3×3 floor lab

Which floors (admissible lower bounds) make guaranteed-optimal 3×3 solving fast, and what they cost in memory, so the app can pick a phone set (≤ 20 MB) and a desktop set (≤ 500 MB). Results and the recommendation are in [FINDINGS.md](FINDINGS.md).

This is a measurement lab, not app code: the solver is C, built and run on a desktop machine. Nothing here ships in the app bundle.

## What is here

| Path | What it is |
| --- | --- |
| `src/cube3.c` | Cube model, symmetries, table builder (breadth-first search), the exhaustive check, IDA*. One file, subcommands `build`, `selftest`, `verify`, `stats`, `solve` |
| `scripts/lab.py` | Runs everything and checkpoints to `results/*.json` |
| `scripts/report.py` | Writes the tables in FINDINGS.md from `results/` |
| `scripts/make_scrambles.py` | The seeded random-move sets (12, 14, 16 moves, 50 each) and superflip |
| `scripts/export-scrambles.mjs` | 20 random-state scrambles from cubing.js |
| `scripts/check-solutions.mjs` | Re-checks every solution in `results/` with cubing.js |
| `scrambles/` | The scramble sets the results used |
| `results/` | Every number in FINDINGS.md, as JSON |
| `tables/` | Built tables, about 600 MB (gitignored; rebuilt in under a minute) |

## Rerun every number

Needs a C compiler with OpenMP (gcc), Python 3.9+, Node 22, and about 2 GB of free memory. From the repository root run `npm ci` once (for cubing.js), then:

```sh
cd lab/3x3
make                                  # builds ./cube3
./cube3 selftest                      # symmetries, coordinates, fast lookups vs slow ones
python3 scripts/lab.py all            # tables, exhaustive check, stats, benchmark, superflip, sizes
node scripts/check-solutions.mjs      # every solution again, with cubing.js
python3 scripts/report.py             # rewrites the tables in FINDINGS.md
```

`lab.py all` runs, in order (each step can also run alone, e.g. `python3 scripts/lab.py verify`):

| Step | Writes | Time here |
| --- | --- | --- |
| `builds` | `tables/*.bin`, `results/builds.json` | 40 s |
| `verify` | `results/verify.json` | 2 min |
| `stats` | `results/stats.json` | 3 min |
| `bench` | `results/bench-moves-12.json`, `-14`, `-16`, `bench-random-state.json` | about 3½ hours (2 of them random states) |
| `superflip` | `results/superflip.json` | 30 min (25 for the desktop set, 5 for the capped phone set) |
| `sizes` | `results/sizes.json` | 10 min |

Times are for 4 threads on the machine in FINDINGS.md. `bench` and `superflip` skip any floor set already in their result file, so an interrupted run continues where it stopped; delete a result file (or one floor set's entry in it) to measure it again. `LAB_FULL=1` also runs the 7-edge desktop set on the random states (about 2 more hours). `LAB_THREADS=n` sets the thread count. The solver's progress goes to `results/cube3.log`, the driver's to stdout.

The random-move scrambles are seeded, so `make_scrambles.py` rewrites the same files. cubing.js random-state scrambles cannot be seeded: `node scripts/export-scrambles.mjs` draws a new set, so only run it to measure on fresh positions.

## How it works, briefly

- **Cube model.** Kociemba's cubie conventions (corner and edge slots, orientations), the same labels as `src/solver/cube2.ts`. All 48 cube symmetries are built from four generators and checked: each maps every face turn to a face turn.
- **Floors.** A floor is a table of exact distances in a smaller puzzle: all 8 corners (88,179,840 positions), 6 or 7 edges with orientation (42,577,920 and 510,935,040), or Kociemba's coordinates (corner twist, edge flip, UD-slice, their pairs, and phase 1, twist × flip × slice). Each is built by breadth-first search from solved, so its value never exceeds the real distance.
- **Symmetry reduction.** The corner and phase-1 tables are stored once per class under the 16 symmetries that keep the U-D axis (2,768 × 2,187 and 64,430 × 2,187 entries), with class tables to look them up. One edge table also answers other edge sets: conjugating the position by a symmetry maps those edges onto the tracked ones (`x2`, `x8`, `x24`). Phase-1 and Kociemba floors are read along all three axes (`x3`).
- **Inverse lookups.** A position and its inverse are the same distance from solved, so a floor can also be read on the inverse (`i`).
- **2-bit tables.** A table can store each distance mod 3 (half the memory). The search knows the parent's exact value and every move changes a distance by at most 1, so mod 3 is enough (`@2`). The cost: no inverse lookups on 2-bit tables, because the inverse does not move by a single turn.
- **Search.** IDA* with the highest of the floor set's lookups. Moves: never the same face twice, opposite faces in one order. A position with its own symmetries (superflip has 48) only tries one first move per orbit.
- **Checks.** `selftest` compares every fast path with the obvious slow one. `verify` compares every floor with the true distance for all 8,240,087 positions within 6 moves, and runs the search on them. Every benchmark solution is replayed by the solver and again by cubing.js.

Floor tokens (`C8s+E7x2i+P1x3i` etc.) are documented above `parse_floor` in `src/cube3.c`.
