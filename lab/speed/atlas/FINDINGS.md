# T1 Search atlas: findings

Where the optimal 2×2 solver spends its time, measured on **every one of the 3,674,160 positions**. IDA\* was run with five floors: 2 KB, 20 KB, 100 KB and 400 KB, each with the mirror lookup, plus 20 KB without it. Every solution's length equals the truth table. Lookups are counted as in `lab/2x2/exp7`, and the 1,000-position benchmark reproduces exp7's means exactly for all 12 floor variants.

## Verdict

1. **82% of all work is spent on positions the floor rates at 6 moves that really need 9 or 10.** With the 20 KB + mirror floor, two cells of the distance × gap map hold almost everything:
   - distance 10 with a starting gap of 4: 44% of all lookups
   - distance 9 with a gap of 3: 38%

   Both mean "the floor says 6". A floor, or a compass, that separates these positions from genuinely short ones would pay off most.
2. **Proof against find depends on distance.**
   - Within 5 moves of solved, there is no proof cost at all: the floor is exact and the first round finds the solution.
   - At 9 moves the final round is 65% of the work, and at 10 moves 41%.
   - At 11 moves it is only 14%. The hardest positions are expensive to *prove*, not to find; they have a median of 55 shortest solutions.
   - Over all positions the final round is 52% (2 KB + mirror) to 68% (400 KB + mirror) of the work.
3. **Each move of starting gap roughly triples the work.** The fitted base is 3.4 for 20 KB, 2.8 for 100 KB + mirror and 2.2 for 400 KB + mirror. That is less than the branching factor of about 6, because the gap closes partway down the tree.
4. **More doors, faster find, once distance is fixed.** "Doors" are a position's shortest solutions.
   - The raw correlation between the final round's cost and the door count is +0.25, because both grow with distance.
   - At a fixed distance it is −0.30, and −0.33 and −0.32 at 9 and 10 moves.
   - A third of all positions (33.9%) have exactly one shortest solution: 28% at 9 moves, and almost none at 10.
5. **The tail is mild.** The costliest 1% of positions account for 7.5% of the work, and the top 10% for 38%. There is no small set of monsters worth caching.
   - The top 1% sit far out: 10.1 moves on average, with a starting gap of 4.1 against 2.7 overall.
   - They rarely have a single door: 4% against 34% overall. They cost a lot because of the proof.
6. **New: symmetric twins cost very different amounts.**
   - Within a symmetry class (the position, its inverse and its 120° rotations about the URF–DBL axis, all equally far from solved), work differs by a median factor of 3.1 between the cheapest and the dearest twin. The reason is that the floor tables are not symmetric.
   - Solving whichever twin is cheapest, then mapping the solution back, would cut the work **1.75× on every floor** (`twins.py`).
   - The obvious way to choose, the twin with the highest starting floor, recovers almost nothing: 1.00–1.13×.
   - So the gain needs a better chooser: a cheap probe of the first round on each twin, or a learned model. It stacks with the mirror lookup and the compass. On the 3×3 there are 96 twins (48 symmetries × inverse), which leaves more room.

## Tables

Mean lookups per optimal solve, over all 3,674,160 positions:

| Floor | All positions | Proof rounds | Final round | Final round's share | Cut on arrival | Cut under a tight parent |
|---|--:|--:|--:|--:|--:|--:|
| 2 KB + mirror | 12,772.5 | 6,134.8 | 6,637.7 | 52.0% | 83.3% | 79.3% |
| 20 KB | 2,375.6 | 1,129.7 | 1,245.9 | 52.4% | 83.2% | 78.8% |
| 20 KB + mirror | 1,812.7 | 859.5 | 953.2 | 52.6% | 83.2% | 80.0% |
| 100 KB + mirror | 395.1 | 177.3 | 217.9 | 55.1% | 82.5% | 77.3% |
| 400 KB + mirror | 85.1 | 27.1 | 58.0 | 68.1% | 78.7% | 74.0% |

The 1,000-position benchmark gives 12,480 / 2,319 / 1,766 / 380 / 84 for the same floors, so it is representative.

By distance, 20 KB + mirror floor:

| Distance | Positions | Mean lookups | Proof | Final round | Share of all work |
|--:|--:|--:|--:|--:|--:|
| ≤ 5 | 12,224 | ≤ 20 | 0 | all of it | 0.0% |
| 6 | 50,136 | 28 | 2 | 26 | 0.0% |
| 7 | 227,536 | 73 | 15 | 58 | 0.3% |
| 8 | 870,072 | 316 | 90 | 227 | 4.1% |
| 9 | 1,887,748 | 1,532 | 532 | 1,000 | 43.4% |
| 10 | 623,800 | 5,467 | 3,233 | 2,234 | 51.2% |
| 11 | 2,644 | 24,657 | 21,152 | 3,505 | 1.0% |

Doors home (shortest solutions per position):

| Distance | 7 | 8 | 9 | 10 | 11 |
|---|--:|--:|--:|--:|--:|
| Median | 1 | 1 | 2 | 11 | 55 |
| Maximum | 24 | 20 | 28 | 96 | 196 |
| Share with exactly one | 72.6% | 57.9% | 27.6% | 0.4% | 0% |

Best twin (`results/twins.json`), mean lookups:

| Floor | As given | Best twin (oracle) | Highest-floor twin (proxy) |
|---|--:|--:|--:|
| 2 KB + mirror | 12,772.5 | 7,298.3 (1.75×) | 12,561.0 (1.02×) |
| 20 KB + mirror | 1,812.7 | 1,046.9 (1.73×) | 1,811.9 (1.00×) |
| 100 KB + mirror | 395.1 | 225.4 (1.75×) | 385.7 (1.02×) |
| 400 KB + mirror | 85.1 | 49.0 (1.74×) | 75.3 (1.13×) |

## What this means for the levers

- **Compass (T2).** The final round is half the work or more, so ordering matters. At 9–10 moves, positions with few doors are the ones a compass helps most.
- **Floors.** The work is concentrated where the floor reads 6 on positions 9–10 moves out. That is where extra floor memory should go. A floor designed for that band would beat a uniformly better one byte for byte.
- **Best twin (new).** A 1.75× prize that needs only a chooser, not memory. Worth a quick experiment: probe the first round on each twin, or train a small chooser. It can be checked on the 3×3 with `lab/3x3`, which already does symmetric and inverse lookups.
- **Gravity (T3).** 74–80% of all lookups are under a tight parent, so on the 2×2 the potential saving in reads is large. Whether it pays off depends on time per read on the 3×3 (see T4).

## How it was checked

- Every floor variant was asserted never to exceed the true distance on all 3,674,160 positions.
- All 3,674,160 solutions, for each of the five floors, have exactly the true length.
- The 1,000-position benchmark matches exp7's means exactly for all 12 variants (numba against exp7's Python).
- Distance and doors home are identical across all 613,058 symmetry classes.

## Files

- `atlas.py`: the run. It needs `lab/2x2` exp1 and exp2 data and takes about 14 minutes on 2 cores with numba. Per-position arrays go in `data/`, which is not committed.
- `twins.py`: best-twin savings, from the atlas's per-position work.
- `plots.py`: prototype charts, `results/*.png`.
- `results/aggregates.json`: every number above and more (work maps, door histograms, by-gap tables).
- `results/frontier.json`: benchmark and all-position rows in the shared format.
