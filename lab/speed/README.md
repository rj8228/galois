# Speed lab: making optimal solving faster

Galois solves cubes optimally with a framework of three parts. A **ceiling** is any solution found by any method. A **floor** is a number of moves the position certainly needs, never too high, read from smaller puzzles. A **prover** (IDA\*) raises the floor round by round until it meets a solution. Any solution it returns is proven shortest.

This lab asks one question: **how can the same guarantee be reached with less work?** We use the 2×2 as a microscope, because the true distance of all 3,674,160 positions is known (`lab/2x2`). Then we check what carries over to the 3×3 (`lab/3x3`).

**Round 1 results:** [SYNTHESIS.md](SYNTHESIS.md) (atlas, compass, 3×3 anatomy).

**Round 2 results:** [SYNTHESIS-2.md](SYNTHESIS-2.md) (ceiling race, downhill masks, browser speed). Three findings:
- The ceiling race beats splitting the prover over two threads 2× at 16 moves.
- Downhill masks make every round 1.46× faster in 331 MB.
- The solver runs in a browser at 0.55× native speed per core.

**Round 3 results:** [SYNTHESIS-3.md](SYNTHESIS-3.md).
- Native, 4 threads: all 20 random states in a mean of 177 s and a median of 72 s. The two states `lab/3x3` never finished are now proven to need 19 moves.
- The browser engine shares one copy of the tables, runs the race as a worker, and stops every worker within 2 ms.

**Round 3** put them together:
- T7: one native solver with the race and the masks, measured on all 20 random states.
- T8: the browser engine the app will use, with one shared copy of the tables, a ceiling worker and one stop flag for all workers.

## What we already know: the anatomy of an optimal solve

Measured on the same 1,000 random 2×2 positions (`lab/2x2/exp7_where_time_goes.py`, `exp8_doors_and_compass.py`, findings in `lab/2x2/FINDINGS.md` §8):

| Floor | Size | Lookups per solve | With mirror | Final round's share | Cut on arrival |
|---|---|--:|--:|--:|--:|
| Twists only | 729 entries | 214,344 | 38,749 | 54% | 83% |
| Places only | 5,040 entries | 90,238 | 90,238 | 54% | 83% |
| Best tables | 2 KB | 18,609 | 12,480 | 54% | 83% |
| Best tables | 20 KB | 2,319 | 1,766 | 56% | 83% |
| Best tables | 100 KB | 627 | 380 | 61% | 83% |
| Best tables | 400 KB | 162 | 84 | 75% | 81% |
| The truth (perfect floor) | – | 32 | – | 100% | 69% |

- **Proof against find.** The rounds before the last one prove that nothing shorter exists. The final round finds the solution, and it is most of the work.
- **Cut on arrival.** Most positions the search generates are discarded at once, because g + h > bound. About three quarters of all generated positions sit under a parent exactly on the bound ("tight"). At a tight parent only children whose floor drops can survive.
- **Mirror.** Using max(h(x), h(x⁻¹)) is still never too high, because a position and its inverse are equally far from solved. It is free strength.
- **Compass.** In the final round, the order children are tried changes speed, never the answer. With the 20 KB + mirror floor, ordering by the true distance cuts lookups from 1,787 to 873 (final round 969 → 55). Ordering by the floor (1,791) or by network D (1,782) gives nothing.
- **Doors home.** 33.9% of positions have exactly one shortest solution. The median count is 1 up to 8 moves, 2 at 9, 11 at 10 and 55 at 11.

## The tasks

Each task runs in its own cloud session, on its own branch, in its own folder.

| Task | Brief | Branch | Folder | Status |
|---|---|---|---|---|
| T1 Search atlas: dataset + visuals | [T1-atlas.md](T1-atlas.md) | `speed-atlas` | `lab/speed/atlas/` | Done (round 1) |
| T2 Compass: learned move ordering | [T2-compass.md](T2-compass.md) | `speed-compass` | `lab/speed/compass/` | Done (round 1) |
| T4 3×3 anatomy: does it hold at scale? | [T4-3x3-anatomy.md](T4-3x3-anatomy.md) | `speed-3x3-anatomy` | `lab/speed/anatomy3/` | Done (round 1) |
| T6 Ceiling race: the prover only proves | [T6-ceiling-race.md](T6-ceiling-race.md) | `speed-ceiling` | `lab/speed/ceiling/` | Done (round 2, #32) |
| T3 Gravity on the 3×3: downhill masks | [T3-gravity.md](T3-gravity.md) | `speed-gravity` | `lab/speed/gravity/` | Done (round 2, #33) |
| T5 Browser speed | [T5-browser-speed.md](T5-browser-speed.md) | `speed-browser` | `lab/speed/browser/` | Done (round 2, #31) |
| T7 Combined native solver: race + masks | [T7-combined.md](T7-combined.md) | `speed-combined` | `lab/speed/combined/` | Done (round 3, #38) |
| T8 Web engine: shared memory, ceiling worker | [T8-web-engine.md](T8-web-engine.md) | `speed-webengine` | `lab/speed/webengine/` | Done (round 3, #37) |

Cloud credit is limited, so each task is boxed to **about 2 hours of session time**. The main session reviews each pull request, reruns part of it, and stitches the results. Best twin, round 1's other lead, was folded into T6 as a short check and not reached; the desktop floor gives a position and all its symmetric twins the same value, so only the inverse searches a different tree. GitHub issues: tracker #20; tasks #21–#25, #29, and round 3: #35 (T7) and #36 (T8).

## Rules for every task

1. **Start from the lab base:** `git fetch origin && git checkout -b <your branch> origin/phase-8-speed-lab`. It already contains `lab/2x2`, `lab/3x3`, `lab/neural` and the 3×3 engine in `src/solver3`.
2. **Stay in your folder.** Don't change other tasks' folders, `lab/2x2`, `lab/3x3` or the app (`src/`, `tests/`, `public/`), except where your brief says so. Copy code you need into your folder.
3. **Rebuild the data you need first.** Neither puzzle's data is committed.
   - **2×2:** `lab/2x2/data/`. From `lab/2x2`, run `exp1_truth.py`, `exp2_floors.py`, `exp3_neural.py 6` and `exp5_finder.py 12` in that order (about 10 minutes), or only the ones your task needs. See `lab/2x2/README.md`.
   - **3×3:** run `make`, then `./cube3 build corners_sym phase1_sym` for the desktop set or `./cube3 build corners_sym edges6` for the phone set, with `CUBE3_TABLES` pointing at a git-ignored `data/` folder. Each takes under a minute (see `lab/speed/anatomy3/README.md`). `lab/3x3/results` already holds the per-bound node counts of every benchmark solve, so reuse them rather than rerunning hours of solves.
4. **Never commit large files.** Anything over 5 MB goes in a git-ignored `data/` folder in your task folder and must be rebuildable by your scripts.
5. **Tools.** Use Python 3 with numpy. Packages from PyPI install with pip (numba, scipy, matplotlib). PyTorch cannot be installed (download.pytorch.org is blocked), so write networks in numpy like `lab/2x2/nets.py`. arxiv.org may be blocked. C is fine (gcc is available).
6. **Correctness comes first.**
   - On the 2×2, every solution's length must equal the truth table.
   - Any floor you use must never exceed the true distance on any of the 3,674,160 positions. Assert it.
   - On the 3×3, replay every solution, and cross-check lengths against `lab/3x3` results.
   - Report any violation as a failure; never hide one.
7. **Use the shared benchmark.** It is the same 1,000 2×2 positions as before: `np.random.default_rng(42).choice(3674160, 1000, replace=False)`.
   - A *lookup* is one read of the floor table.
   - Say which counting you use. exp7 descends into a child right after reading it; exp8 reads all of a node's children first, then descends. The two differ by about 1–2%.
   - If a method adds work (mask reads, model evaluations), report it separately, and give wall time where the gain is time rather than lookups.
8. **Write `FINDINGS.md` in plain language.** Put the verdict first (what worked, by how much, what didn't), then tables, then how it was checked. Negative results are results.
9. **Write `results/frontier.json` in the shared format below,** so all tasks can be stitched into one picture.
10. **Push checkpoints at least every hour,** because cloud sessions can be reclaimed. When done, open a pull request with base **`phase-8-speed-lab`** (not `main`). Don't merge it.
11. **Budget a few hours.** If something is too slow, report partial results with clear caveats rather than leaving nothing.

## Shared result format

`results/frontier.json` is a list of rows, one per method × floor:

```json
{
  "task": "compass",
  "puzzle": "2x2",
  "method": "listwise ranker, 70-64-1, int8",
  "floor": "20 KB + mirror",
  "floor_bytes": 20000,
  "extra_bytes": 4672,
  "positions": 1000,
  "optimal": 1000,
  "lookups_counting": "exp8",
  "mean_lookups": 1012.4,
  "mean_final_round_lookups": 190.0,
  "mean_extra_work": 2400,
  "extra_work_unit": "model evaluations",
  "mean_ms": null,
  "impl": "python",
  "notes": "recovers 85% of the perfect order's gain"
}
```

`extra_bytes` is the memory the method adds on top of the floor. Use `null` for anything not measured.

## Stitching

Each pull request is reviewed and merged into `phase-8-speed-lab` in the main session. Then:

- One combined picture: lookups and time against memory, for the baseline, mirror, compass, gravity and their combinations.
- The 3×3 transfer verdict.
- Whatever earns it goes into the app: a "where the time went" view in the Solver, a speed-lab section in the Paper, and the design of the 3×3 Solver.
