# T4 3×3 anatomy: findings

Speed lab task T4 (issue #24, part of #20). Question: does the 2×2's picture of where an optimal solve spends its work hold on the 3×3? Its answer decides which lever is worth the most there: mirror, compass or gravity. Measured with `lab/3x3`'s C solver, instrumented, on its phone set `C8s@2+E6x8@2` (12.2 MB) and desktop set `C8s+P1x3i` (73.5 MB). How to rerun: [README.md](README.md).

## Verdict

**The 2×2 picture holds, and it is sharper on the 3×3.** On the 14- and 16-move scrambles:

- **The final round is 82–86% of the work** (2×2: 54–75%). Each round costs about 6–7 times the one before, so the rounds that prove nothing shorter exists are only 14–18%.
- **92.5% of generated positions are cut on arrival** (2×2: 81–83%), on every set and both floor sets. 92% of all children are generated under a tight parent, and there 97–98% of them are cut. On average one child per expansion survives (1.00), out of 13.35 generated.
- **A perfect compass would cut the total work 5.5–7.2 times** (2×2: 2×). It removes almost all of the final round (206 lookups instead of 74 million at 16 moves on the desktop set), leaving only the proof rounds. The cheap orders recover little of that: ordering by the floor gives 1.02–1.10×, by the mirror floor 1.03–1.15×.
- **Most positions have a single shortest solution:** 84–90% at 12–14 moves, counting U D and D U as one (28–40% if they count as two, the 2×2's counting). Lacking a compass, the search finds that one solution about halfway through the final round (find / full round 44–51%, as if the solution sat at a random place).

**Ranking the levers for the 3×3:**

1. **Gravity (downhill masks) is the best lever for the desktop.** At a tight node, masks on the direct lookups would let through only 8–13% of the children (18–25% with down-only masks), so they skip **67–84% of all lookups** (58–75% down-only) without changing a single expansion. Down-only masks for the desktop tables take 331 MB. With the 73.5 MB floor that is about 405 MB, inside the 500 MB budget that the desktop set currently uses less than a sixth of. The gain is time, not expansions; it still has to be measured in a prototype (mask reads are random accesses into a 331 MB array). On the phone set masks are exact (every lookup is direct), so they would skip 87–89% of lookups. But they cost 109–219 MB, 9–18 times the phone's whole 20 MB budget, so gravity is a desktop lever.
2. **Compass has the highest ceiling (5.5–7.2×), but nothing cheap reaches it.** With about one shortest solution per position, the compass has to find a needle: it must point to the one move that leads to that solution at almost every node on the path. Only a learned compass could get there, and T2 will tell whether one can on the 2×2. Its overhead is small, because ordering only touches survivors, about one per expansion (7.5% of lookups). It is also the only lever that costs the phone little memory.
3. **Mirror is already spent where it pays.** The desktop set reads phase 1 on the inverse. That is 2.2–2.4× fewer nodes than without it at 14–16 moves, and 1.4–1.6× faster (`lab/3x3`). On corner and edge tables the inverse only gives 1.23–1.29× fewer nodes and no time. The phone set can't use it: 2-bit tables can't be read on the inverse, and 4-bit `C8s+E6x8` is 24.3 MB, over budget. As an order, the mirror floor gives at most 1.15×.

Gravity and compass act on different things, so they stack: gravity makes each tight expansion cheaper, a compass removes expansions from the final round.

## What changed from the 2×2

| Share | 2×2 (lab/2x2, 1,000 random positions) | 3×3 phone set (14, 16 moves) | 3×3 desktop set (14, 16 moves) |
| --- | --: | --: | --: |
| Final round (find) | 54–75% | 86%, 82% | 86%, 85% |
| Proof rounds | 25–46% | 14%, 18% | 14%, 15% |
| Cut on arrival | 81–83% | 92.5%, 92.5% | 92.5%, 92.5% |
| Generated under a tight parent | about 75% | 92%, 92% | 92%, 92% |
| Perfect compass, total lookups | 2.05× fewer (20 KB + mirror) | 7.2×, 5.5× fewer | 6.9×, 6.6× fewer |
| Cheap orders (floor, mirror floor) | 1.00× | 1.10×, – | 1.02–1.15× |
| Exactly one shortest solution | 33.9% (all positions) | 90% (14 moves; 28% counting U D and D U apart) | 90% (14 moves; 28%) |

What the differences mean, lever by lever:

- **Proof against find.** The 3×3 has 13.35 sensible moves per node, not about 6, so each round is about 6–7 times the one before. The last round outweighs all earlier ones put together by more. Anything that speeds up only the find (a compass) is worth up to 1 / 0.15, about 7×, instead of 2× on the 2×2. Anything that speeds up every round (a stronger floor, gravity) still cuts all of it.
- **Cut on arrival.** 92.5% instead of 81–83% means 12.4 of every 13.35 children are read only to be thrown away. That is the waste gravity targets, and there is more of it than on the 2×2. At a tight parent, 97–98% of children are cut.
- **Compass.** The perfect order wins more (5.5–7.2× against 2×), but cheap orders still win almost nothing. The one exception is the desktop set at 12 moves (1.39–1.45×), where the rounds are tiny. Per position there is about one shortest solution, so "closer by the floor" is a weak hint: the floor barely separates siblings (one survivor per expansion).
- **Mirror.** On the 2×2 the mirror was free strength for every floor. On the 3×3 it pays for the phase-1 table (already in the desktop set) and little elsewhere, and 2-bit tables can't use it.

## Results

<!-- tables:start -->

### Anatomy

One *lookup* is one generated child (one evaluation of the floor set: 9 table reads for the phone set, 7 for the desktop set; one move from the end, a compare with solved). Children are all read before the search descends (exp8 counting). Means over the solves that finished.

| Floor, scrambles (solves) | Length | Lookups per solve | Final round | Proof rounds | Final share (median) | Expansions | Cut on arrival | Generated under tight parents | Cut rate: tight / loose parent | Mean ms |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| Phone `C8s@2+E6x8@2`, 12 moves (50) | 11.94 | 129,910 | 104,664 | 25,246 | 81% (81%) | 9,746 | 92.5% | 91% | 97.0% / 46.6% | 12.1 |
| Desktop `C8s+P1x3i`, 12 moves (50) | 11.94 | 13,344 | 9,225 | 4,119 | 69% (82%) | 1,002 | 92.3% | 83% | 96.8% / 70.2% | 1.4 |
| Phone `C8s@2+E6x8@2`, 14 moves (50) | 13.92 | 17,903,127 | 15,403,660 | 2,499,466 | 86% (84%) | 1,341,536 | 92.5% | 92% | 96.7% / 42.9% | 1,695.0 |
| Desktop `C8s+P1x3i`, 14 moves (50) | 13.92 | 616,532 | 527,143 | 89,389 | 86% (84%) | 46,203 | 92.5% | 92% | 97.7% / 33.9% | 72.5 |
| Phone `C8s@2+E6x8@2`, 16 moves (12) | 15.83 | 2,225,431,730 | 1,822,487,886 | 402,943,843 | 82% (80%) | 166,794,984 | 92.5% | 92% | 96.7% / 42.5% | 215,413.7 |
| Desktop `C8s+P1x3i`, 16 moves (50) | 15.92 | 87,239,984 | 74,074,407 | 13,165,577 | 85% (85%) | 6,536,069 | 92.5% | 92% | 97.8% / 30.2% | 10,565.7 |

### Per expansion

| Floor, scrambles | Children per expansion | Survivors per expansion | Expansions at a tight node | Cut on arrival, final round only | Rounds from the end: last, −1, −2, −3 (mean lookups) |
| --- | --: | --: | --: | --: | --- |
| Phone `C8s@2+E6x8@2`, 12 moves (50) | 13.33 | 1.00 | 91% | 92.5% | 104,664, 22,889, 2,175, 242 |
| Desktop `C8s+P1x3i`, 12 moves (50) | 13.32 | 1.02 | 83% | 92.2% | 9,225, 3,640, 486, 38.6 |
| Phone `C8s@2+E6x8@2`, 14 moves (50) | 13.35 | 1.00 | 92% | 92.5% | 15,403,660, 2,306,375, 178,102, 13,831 |
| Desktop `C8s+P1x3i`, 14 moves (50) | 13.34 | 1.00 | 92% | 92.5% | 527,143, 82,137, 6,671, 550 |
| Phone `C8s@2+E6x8@2`, 16 moves (12) | 13.34 | 1.00 | 92% | 92.5% | 1,822,487,886, 372,017,021, 28,535,286, 2,204,921 |
| Desktop `C8s+P1x3i`, 16 moves (50) | 13.35 | 1.00 | 92% | 92.5% | 74,074,407, 12,130,780, 952,618, 75,568 |

### Compass: the final round in a different order

*Perfect compass*: at every node on the found solution's path, that solution's next move is tried first (an upper bound for any order with the same floor). *By floor*: surviving children in ascending floor. *By mirror floor*: ascending max(h(x), h(x⁻¹)), then h(x) + h(x⁻¹); the phone set reads 4-bit `C8s+E6x8` on the inverse for this (not counted as lookups; listed as extra reads), the desktop set already has its inverse lookups. Totals keep the proof rounds unchanged.

| Floor, scrambles | Final round: move order | Perfect compass | By floor | By mirror floor | Total: move order | Perfect compass | By floor | By mirror floor |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| Phone `C8s@2+E6x8@2`, 12 moves (50) | 104,664 | 153 | 111,151 | 115,588 | 129,910 | 25,399 (5.11×) | 136,398 (0.95×) | 140,834 (0.92×) |
| Desktop `C8s+P1x3i`, 12 moves (50) | 9,225 | 153 | 5,502 | 5,104 | 13,344 | 4,272 (3.12×) | 9,621 (1.39×) | 9,223 (1.45×) |
| Phone `C8s@2+E6x8@2`, 14 moves (50) | 15,403,660 | 179 | 13,715,124 | 13,759,297 | 17,903,127 | 2,499,645 (7.16×) | 16,214,590 (1.10×) | 16,258,763 (1.10×) |
| Desktop `C8s+P1x3i`, 14 moves (50) | 527,143 | 179 | 517,671 | 509,069 | 616,532 | 89,568 (6.88×) | 607,060 (1.02×) | 598,458 (1.03×) |
| Phone `C8s@2+E6x8@2`, 16 moves (12) | 1,822,487,886 | 206 | – | – | 2,225,431,730 | 402,944,050 (5.52×) | – | – |
| Desktop `C8s+P1x3i`, 16 moves (50) | 74,074,407 | 206 | 69,013,335 | 62,369,083 | 87,239,984 | 13,165,783 (6.63×) | 82,178,911 (1.06×) | 75,534,660 (1.15×) |

### Doors home: shortest solutions per position

Counted by finishing the final round after the first solution. *Canonical* counts move sequences the search can generate (opposite faces in one fixed order, so U D and D U count once); *all sequences* counts both orders, like the 2×2 lab (which has no opposite faces). *Find* is the final round's lookups up to the first solution, *full* the whole final round.

| Floor, scrambles | Exactly one (canonical) | Median (canonical) | Mean | Max | Exactly one (all sequences) | Median (all sequences) | Find / full final round (mean, median) | corr(log count, log find) |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| Phone `C8s@2+E6x8@2`, 12 moves (50) | 84% | 1.0 | 1.2 | 5 | 40% | 2.0 | 44%, 38% | +0.34 |
| Desktop `C8s+P1x3i`, 12 moves (50) | 84% | 1.0 | 1.2 | 5 | 40% | 2.0 | 45%, 37% | +0.56 |
| Phone `C8s@2+E6x8@2`, 14 moves (50) | 90% | 1.0 | 1.1 | 4 | 28% | 2.0 | 50%, 45% | +0.16 |
| Desktop `C8s+P1x3i`, 14 moves (50) | 90% | 1.0 | 1.1 | 4 | 28% | 2.0 | 51%, 45% | +0.18 |

Cost of the find by number of shortest solutions (canonical):

| Floor, scrambles | Solutions | Positions | Find (mean lookups) | Full final round | Find / full |
| --- | --- | --: | --: | --: | --: |
| Phone `C8s@2+E6x8@2`, 12 moves (50) | 1 | 42 | 84,156 | 210,730 | 43% |
| Phone `C8s@2+E6x8@2`, 12 moves (50) | 2–3 | 7 | 138,966 | 433,986 | 46% |
| Phone `C8s@2+E6x8@2`, 12 moves (50) | 4–10 | 1 | 725,870 | 998,043 | 73% |
| Desktop `C8s+P1x3i`, 12 moves (50) | 1 | 42 | 3,847 | 11,053 | 45% |
| Desktop `C8s+P1x3i`, 12 moves (50) | 2–3 | 7 | 10,778 | 38,175 | 47% |
| Desktop `C8s+P1x3i`, 12 moves (50) | 4–10 | 1 | 224,255 | 717,813 | 31% |
| Phone `C8s@2+E6x8@2`, 14 moves (50) | 1 | 45 | 14,669,991 | 29,454,716 | 50% |
| Phone `C8s@2+E6x8@2`, 14 moves (50) | 2–3 | 4 | 17,459,401 | 33,198,616 | 48% |
| Phone `C8s@2+E6x8@2`, 14 moves (50) | 4–10 | 1 | 40,195,805 | 45,834,810 | 88% |
| Desktop `C8s+P1x3i`, 14 moves (50) | 1 | 45 | 468,118 | 956,296 | 51% |
| Desktop `C8s+P1x3i`, 14 moves (50) | 2–3 | 4 | 1,166,298 | 1,874,146 | 47% |
| Desktop `C8s+P1x3i`, 14 moves (50) | 4–10 | 1 | 626,630 | 731,814 | 86% |

### Gravity: what downhill masks on the direct lookups would let through

The final round again, at every tight node (g + h = bound, one move or more from the end). *Full masks*: every direct lookup at the parent's maximum must go down, every one at maximum − 1 must not go up (two 18-bit masks per table entry). *Down only*: just the first rule (one 18-bit mask). Inverse lookups cannot use masks (the move acts on the other side) and are read as usual for the children the masks let through. *Lookups saved* is the share of the final round's lookups a mask would skip. Mask memory counts every entry of the floor's tables.

| Floor, scrambles | Children per tight node | Survive | Let through: full masks | Down only | Lookups saved: full / down only | Mask reads per tight node: full / down only | Mask memory: full / down only (floor) |
| --- | --: | --: | --: | --: | --: | --: | --: |
| Phone `C8s@2+E6x8@2`, 12 moves (50) | 13.33 | 3.1% | 3.1% | 5.7% | 88% / 86% | 7.7 / 4.3 | 219 / 109 MB (12.2 MB) |
| Desktop `C8s+P1x3i`, 12 moves (50) | 13.31 | 3.3% | 12.9% | 24.5% | 67% / 58% | 2.6 / 1.6 | 661 / 331 MB (73.5 MB) |
| Phone `C8s@2+E6x8@2`, 14 moves (50) | 13.35 | 3.3% | 3.3% | 6.0% | 89% / 87% | 7.8 / 4.6 | 219 / 109 MB (12.2 MB) |
| Desktop `C8s+P1x3i`, 14 moves (50) | 13.34 | 2.3% | 8.2% | 17.9% | 84% / 75% | 3.5 / 2.1 | 661 / 331 MB (73.5 MB) |
| Desktop `C8s+P1x3i`, 16 moves (50) | 13.35 | 2.2% | 8.2% | 18.2% | 85% / 75% | 3.6 / 2.2 | 661 / 331 MB (73.5 MB) |

**Capped runs:** none.

**Checks:** every solution and every rerun's first solution replayed to solved; 262 lengths compared with `lab/3x3` results, 0 differences.

<!-- tables:end -->

## Caveats

- **Phone set at 16 moves: only the first 12 of the 50 scrambles** (about 3.6 minutes per solve on one thread), all 12 finished, with only the compass rerun. The orders by floor and mirror floor and the gravity count were not run there.
- **Random states: only the first 8 of `lab/3x3`'s 20, desktop set, compass rerun only.** No floor orders, counts or gravity on random states.
- **Doors home was counted on the 12- and 14-move sets only.** Those are random-move scrambles that need exactly 12 or 14 moves almost every time. They are not random states, which need 17–18 moves and may have more shortest solutions.
- **Gravity is counted, not built.** The let-through fractions are exact: the masks' content is computed from the lookups themselves. But no masks were stored and no time was measured. Mask memory assumes one or two 18-bit masks per table entry, without packing.
- **The perfect-compass bound is for the solution the search found.** Another shortest solution could be reached at the same cost (the bound is the path length times about 13 children), so in practice it is the bound for any order.

## How it was checked

- The instrumented search is `lab/3x3`'s `dfs()` with counters and a reorder step. Before anything else ran, its lookups matched `lab/3x3`'s node counts exactly on all 50 twelve-move scrambles for both floor sets.
- Every solution, and the first solution of every rerun (compass, orders, count, gravity), was replayed on the cube to solved.
- Every rerun of the final round found a solution of the same length. In count mode, the first solution came after exactly as many lookups as the plain final round.
- Every length was compared with `lab/3x3`'s results for the same scramble and floor set, or with the other floor set's result where `lab/3x3`'s run was capped: 0 differences.
- For the phone set (all lookups direct), the gravity count's let-through children equal the surviving children exactly at every tight node, as the mask rule predicts.
- No run in this folder hit its cap.
