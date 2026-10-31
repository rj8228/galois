# Neural floors for the 3×3 corner table: findings

**Question.** On the 2×2, a network trained to underestimate, plus a table of its remaining overestimates, gave a floor that is never too high, but it used more bytes than plain tables. Does that change at 3×3 scale? The test case is the 8-corner table (88,179,840 positions, 44,089,920 bytes at 4 bits), the table that "Learning Admissible Heuristics for A*" (arXiv 2509.22626) compressed about 51×.

## Verdict: no, with a narrow exception inside a full 3×3 search

The 2×2 result mostly carries over:

1. **At full strength, a plain table is smaller and exact.** A table reduced by the cube's 48 symmetries and by inversion (d(s) = d(s⁻¹)) holds the exact distance in **438,215 bytes** stored mod 3, 101× smaller than 44 MB. It searches exactly like the 44 MB table. Every net configuration of 438 KB or more has a weaker floor and searches more nodes, on the corner puzzle and in the full 3×3.
2. **On the corner puzzle, the correction table does the work, not the network.** Replace the net with a constant and keep the corrections, and you get a *perimeter table*: the exact distance of every position within distance k, and k + 1 everywhere else. Set each net beside the perimeter table with k = 7 − margin and the same inputs:
   - **Bytes:** the perimeter table is 1.2–32× smaller.
   - **Search:** the net searches between 6% fewer and 74% more nodes than its twin.
   - **Mean floor:** the net is higher by only 0.05–0.31.

   At margin 0 the raw net's correction table contains 6,801,927 of the 6,807,696 positions within distance 7, which is a perimeter table in all but name.
3. **In a full 3×3 search the nets do a little better, but only fill gaps.** With the corner floor combined with two 6-edge tables, every net searches 2–18% fewer nodes than its twin. Two net configurations stay on the bytes-against-nodes frontier, each the only floor measured in a gap between plain tables:
   - **108 KB**, between the 37 KB and 156 KB perimeter tables.
   - **284 KB**, between the 156 KB perimeter table and a 415 KB plain table: perimeter-7 plus 1 bit per class marking distance ≥ 9.

   That 415 KB table searches almost exactly like the exact table: 11.63M full-cube nodes against 11.55M, and the same 2,209 on the corner puzzle. It beats the two largest nets (424–428 KB) outright. In both remaining gaps, bytes spent on the next plain table buy 2.7–3.8× more search reduction than bytes spent on the net.

So a net is only the best floor measured when the memory budget falls in one of those two gaps, roughly 108–155 KB or 284–414 KB. Even there, a little more memory spent on a plain table buys far more search. Everywhere else, a plain table is smaller and searches at least as well.

What the nets do achieve is a large ratio against the 44 MB table: up to 615× (72 KB) while staying never too high. But perimeter tables over symmetry+inverse classes reach the same corner-puzzle search strength with no network at all, at 283× to 5,957×.

**Checks:**
- Every floor here, net or plain, was checked against the BFS truth on all 88,179,840 positions, and none is ever too high (largest floor − truth: 0).
- Both searches compared every corner floor value they computed with the truth: 0 violations in every reported run.
- Every solution was optimal. On the full cube, every floor returned the same 50 optimal lengths, and every solution was replayed on the cube to check that it solves it.

## Plain floors (corner puzzle)

"Mean floor" is over all 88,179,840 positions; the truth's is 8.764. "Exact" is the share of positions where the floor equals the distance. IDA* nodes are summed over 50 scrambles of 12 random moves (seeded; no face turned twice in a row), solving the corners only. The 12 moves leave the corners at distance 4–9 from solved.

| floor | bytes | vs 44 MB | mean floor | exact | IDA* nodes, 50 scrambles |
|---|---:|---:|---:|---:|---:|
| 8-corner table, 4 bits (the truth) | 44,089,920 | 1× | 8.764 | 100.0% | 2,209 |
| 8-corner table, 2 bits (mod 3) | 22,044,960 | 2× | 8.764 | 100.0% | 2,209 |
| max of two 6-corner tables | 14,696,640 | 3× | 7.982 | 43.1% | 9,382 |
| perimeter table: exact to distance 7, 8 beyond | 8,509,620 | 5× | 7.904 | 31.3% | 2,947 |
| 6-corner table | 7,348,320 | 6× | 7.610 | 31.0% | 692,270 |
| perimeter table: exact to distance 6, 7 beyond | 2,107,602 | 21× | 6.981 | 7.7% | 13,996 |
| max of two 5-corner tables | 1,632,960 | 27× | 6.771 | 7.1% | 117,427 |
| symmetry-reduced table, 4 bits | 1,156,644 | 38× | 8.764 | 100.0% | 2,209 |
| 5-corner table | 816,480 | 54× | 6.365 | 4.7% | 3,573,994 |
| symmetry+inverse-reduced table, 4 bits | 795,789 | 55× | 8.764 | 100.0% | 2,209 |
| symmetry-reduced table, 2 bits (mod 3) | 618,642 | 71× | 8.764 | 100.0% | 2,209 |
| perimeter table: exact to distance 5, 6 beyond | 443,535 | 99× | 5.997 | 1.6% | 163,943 |
| **symmetry+inverse-reduced table, 2 bits (mod 3)** | **438,215** | **101×** | **8.764** | **100.0%** | **2,209** |
| perimeter table over symmetry+inverse classes (exact to 7) + 1 bit per entry (9 if distance ≥ 9, else 8) | 415,000 | 106× | 8.591 | 82.8% | 2,209 |
| perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) | 296,284 | 149× | 8.355 | 59.2% | 2,887 |
| perimeter table over symmetry classes: exact to 7, 8 beyond | 285,791 | 154× | 7.904 | 31.3% | 2,947 |
| perimeter table over symmetry+inverse classes (exact to 5) + 1 bit per entry (9 if distance ≥ 9, else 6) | 266,829 | 165× | 8.058 | 53.1% | 10,037 |
| perimeter table over symmetry+inverse classes: exact to 7, 8 beyond | 155,572 | 283× | 7.904 | 31.3% | 2,947 |
| max of two 4-corner tables | 136,080 | 324× | 5.683 | 0.8% | 1,417,867 |
| 4-corner table | 68,040 | 648× | 5.292 | 0.5% | 30,730,621 |
| perimeter table over symmetry classes: exact to 6, 7 beyond | 67,100 | 657× | 6.981 | 7.7% | 13,996 |
| perimeter table over symmetry+inverse classes: exact to 6, 7 beyond | 36,856 | 1,196× | 6.981 | 7.7% | 13,996 |
| perimeter table over symmetry classes: exact to 5, 6 beyond | 13,570 | 3,249× | 5.997 | 1.6% | 163,943 |
| perimeter table over symmetry+inverse classes: exact to 5, 6 beyond | 7,401 | 5,957× | 5.997 | 1.6% | 163,943 |
| 3-corner table | 4,536 | 9,720× | 4.078 | 0.0% | 358,853,434 |

The mod-3 rows store each distance mod 3 in 2 bits. They give the same values as their 4-bit versions, because a search knows its parent's exact distance and a child differs from it by at most 1. Their node counts are therefore those of the 4-bit tables. The mod-3 lookup itself was not implemented here.

## Nets beside their zero-parameter twins (corner puzzle, int8)

Net bytes = int8 weights (with an fp16 scale and fp16 bias per unit) + the correction table. The correction table stores Elias–Fano coded sorted keys plus 4 bits per value: 10–21 bits per entry, fewer when the keys are dense. The twin is the perimeter table with k = 7 − margin, over the same inputs, coded the same way.

There are three kinds of input:
- **raw:** the position itself.
- **sym:** its representative under the 48 symmetries.
- **sym+inv:** its representative under the symmetries and inversion. This is the same trained sym net, read at a different representative, with corrections only for those 934,778 classes. No retraining is needed.

| net (int8) | margin | bytes: weights + corrections | mean floor | IDA* nodes | twin: perimeter k | twin bytes | twin mean floor | twin nodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| raw MLP 512-256-128 (2 epochs) | 0 | 9,929,777 = 212,612 + 9,717,165 | 7.953 | 2,898 | 7 | 8,509,620 | 7.904 | 2,947 |
| raw MLP 512-256-128 (2 epochs) | 1 | 2,503,006 = 212,612 + 2,290,394 | 7.042 | 13,383 | 6 | 2,107,602 | 6.981 | 13,996 |
| raw MLP 512-256-128 (2 epochs) | 2 | 663,385 = 212,612 + 450,773 | 6.059 | 155,842 | 5 | 443,535 | 5.997 | 163,943 |
| sym MLP 512-256-128 (30 epochs) | 0 | 600,996 = 212,612 + 388,384 | 8.089 | 2,878 | 7 (sym) | 285,791 | 7.904 | 2,947 |
| sym MLP 512-256-128 (30 epochs) | 1 | 287,644 = 212,612 + 75,032 | 7.201 | 13,562 | 6 (sym) | 67,100 | 6.981 | 13,996 |
| sym MLP 512-256-128 (30 epochs) | 2 | 223,641 = 212,612 + 11,029 | 6.219 | 154,381 | 5 (sym) | 13,570 | 5.997 | 163,943 |
| sym MLP 512-256-128 (100 epochs) | 0 | 607,205 = 212,612 + 394,593 | 8.169 | 3,166 | 7 (sym) | 285,791 | 7.904 | 2,947 |
| sym MLP 512-256-128 (100 epochs) | 1 | 255,448 = 212,612 + 42,836 | 7.283 | 19,904 | 6 (sym) | 67,100 | 6.981 | 13,996 |
| sym MLP 512-256-128 (100 epochs) | 2 | 214,912 = 212,612 + 2,300 | 6.292 | 279,438 | 5 (sym) | 13,570 | 5.997 | 163,943 |
| sym MLP 256-128-64 (100 epochs) | 0 | 466,293 = 65,348 + 400,945 | 8.094 | 2,934 | 7 (sym) | 285,791 | 7.904 | 2,947 |
| sym MLP 256-128-64 (100 epochs) | 1 | 143,413 = 65,348 + 78,065 | 7.209 | 13,920 | 6 (sym) | 67,100 | 6.981 | 13,996 |
| sym MLP 256-128-64 (100 epochs) | 2 | 76,494 = 65,348 + 11,146 | 6.228 | 160,022 | 5 (sym) | 13,570 | 5.997 | 163,943 |
| sym+inv MLP 512-256-128 (30 epochs) | 0 | 424,312 = 212,612 + 211,700 | 8.089 | 2,840 | 7 (sym+inv) | 155,572 | 7.904 | 2,947 |
| sym+inv MLP 512-256-128 (30 epochs) | 1 | 253,855 = 212,612 + 41,243 | 7.202 | 13,313 | 6 (sym+inv) | 36,856 | 6.981 | 13,996 |
| sym+inv MLP 512-256-128 (30 epochs) | 2 | 218,886 = 212,612 + 6,274 | 6.220 | 153,747 | 5 (sym+inv) | 7,401 | 5.997 | 163,943 |
| sym+inv MLP 512-256-128 (100 epochs) | 0 | 428,116 = 212,612 + 215,504 | 8.168 | 3,220 | 7 (sym+inv) | 155,572 | 7.904 | 2,947 |
| sym+inv MLP 512-256-128 (100 epochs) | 1 | 236,417 = 212,612 + 23,805 | 7.282 | 19,392 | 6 (sym+inv) | 36,856 | 6.981 | 13,996 |
| sym+inv MLP 512-256-128 (100 epochs) | 2 | 213,966 = 212,612 + 1,354 | 6.292 | 279,798 | 5 (sym+inv) | 7,401 | 5.997 | 163,943 |
| sym+inv MLP 256-128-64 (100 epochs) | 0 | 284,368 = 65,348 + 219,020 | 8.094 | 2,918 | 7 (sym+inv) | 155,572 | 7.904 | 2,947 |
| sym+inv MLP 256-128-64 (100 epochs) | 1 | 108,250 = 65,348 + 42,902 | 7.211 | 13,894 | 6 (sym+inv) | 36,856 | 6.981 | 13,996 |
| sym+inv MLP 256-128-64 (100 epochs) | 2 | 71,750 = 65,348 + 6,402 | 6.229 | 160,344 | 5 (sym+inv) | 7,401 | 5.997 | 163,943 |

fp16 weights give the same floors (within 0.012 mean floor), the same correction counts to within 3%, and nearly the same node counts. They cost 1.02–2× the total bytes, so int8 is the better format throughout. All rows, fp16 included, are in `results/table.md` and `results/summary.json`.

## In a full 3×3 search

The corner floor's real job is inside a full-cube search. There, the floor is max(corner floor, edge table A, edge table B), as in Korf's 1997 optimal solver. The two 6-edge tables are the same for every row (42,577,920 entries each), so the bytes column counts only the corner floor. The 50 scrambles are the same move sequences, now applied to the whole cube; their optimal lengths are 8 (3 scrambles), 9 (2), 10 (6), 11 (8) and 12 (31). Rows below are the frontier, plus the comparisons that matter. Every row is in `results/table_full3x3.md`.

| corner floor | corner bytes | mean corner floor | full-3×3 nodes, 50 scrambles | vs exact | seconds | frontier |
|---|---:|---:|---:|---:|---:|---|
| no corner floor (the two edge tables alone) | 0 | – | 66,552,574 | 5.76× | 45 | **yes** |
| perimeter table over symmetry+inverse classes: exact to 5, 6 beyond | 7,401 | 5.997 | 58,662,838 | 5.08× | 44 | **yes** |
| perimeter table over symmetry+inverse classes: exact to 6, 7 beyond | 36,856 | 6.981 | 41,269,162 | 3.57× | 33 | **yes** |
| sym+inv MLP 256-128-64, int8, margin 2 | 71,750 | 6.229 | 55,199,584 | 4.78× | 168 | |
| **sym+inv MLP 256-128-64, int8, margin 1** | **108,250** | **7.211** | **35,969,262** | **3.11×** | **137** | **yes** |
| max of two 4-corner tables | 136,080 | 5.683 | 60,158,770 | 5.21× | 45 | |
| perimeter table over symmetry+inverse classes: exact to 7, 8 beyond | 155,572 | 7.904 | 17,094,941 | 1.48× | 16 | **yes** |
| sym+inv MLP 512-256-128 (100 epochs), int8, margin 1 | 236,417 | 7.282 | 34,062,546 | 2.95× | 160 | |
| perimeter-5 over symmetry+inverse classes + 1 bit (distance ≥ 9) | 266,829 | 8.058 | 20,898,154 | 1.81× | 100 | |
| **sym+inv MLP 256-128-64, int8, margin 0** | **284,368** | **8.094** | **15,904,172** | **1.38×** | **92** | **yes** |
| perimeter-6 over symmetry+inverse classes + 1 bit (distance ≥ 9) | 296,284 | 8.355 | 16,658,356 | 1.44× | 89 | |
| perimeter-7 over symmetry+inverse classes + 1 bit (distance ≥ 9) | 415,000 | 8.591 | 11,628,102 | 1.01× | 72 | **yes** |
| sym+inv MLP 512-256-128 (100 epochs), int8, margin 0 | 428,116 | 8.168 | 15,724,617 | 1.36× | 104 | |
| symmetry+inverse-reduced table, 2 bits (mod 3) | 438,215 | 8.764 | 11,550,222 | 1.00× | 8 | **yes** |
| raw MLP 512-256-128, int8, margin 0 | 9,929,777 | 7.953 | 16,714,693 | 1.45× | 40 | |
| perimeter table: exact to distance 7, 8 beyond | 8,509,620 | 7.904 | 17,094,941 | 1.48× | 16 | |
| max of two 6-corner tables | 14,696,640 | 7.982 | 18,571,735 | 1.61× | 16 | |
| 8-corner table, 4 bits (the truth) | 44,089,920 | 8.764 | 11,550,222 | 1.00× | 8 | |

**The perimeter-plus-bit tables** (`threshold.py`) store a perimeter table over symmetry+inverse classes, plus 1 bit per entry of the symmetry+inverse table, set where the distance is 9 or more. That is 1,430,298 bits (178,788 bytes), using the same 2-byte permutation map as the exact table. The floor is the exact distance inside the perimeter, 9 where the bit is set, and k + 1 elsewhere.

- **Checks:** each variant was checked on all 88,179,840 positions through the search's own lookup code. Each equals that formula everywhere and is never above the truth.
- **Perimeter-7 + bit** is the plain answer to the upper gap. It beats the two largest nets (424–428 KB) outright, and its search is within 1% of the exact table's.
- **The 284 KB net is the exception.** The plain table nearest it, perimeter-6 + bit at 296 KB, is both bigger and slower to search: 16.7M nodes against the net's 15.9M. Here a net beats a plain table outright.

**What changes from the corner puzzle:**

- **The corner floor matters, but less than on its own.** The exact corner table cuts the edge-only search 5.8×, and the perimeter-7 table cuts it 3.9×.
- **The search now spends where the nets are stronger.** With the exact corner table, the nodes a full-cube search generates have corners at distance 7.3 on average, and 47.5% of them are at distance 8 or more. On the corner puzzle these scrambles start at distance 4–9; over all positions, 92.3% are at 8 or more. The nets' extra floor height is at distances 8–11, so they now beat their twins: by 2–8% at margins 0 and 2, and by 4–18% at margin 1.
- **That makes some nets frontier points, but at a poor exchange rate.** Here is what each extra byte buys, measured as reduction in log(nodes) per KB:

  | step | extra bytes | nodes | reduction per KB |
  |---|---:|---:|---:|
  | perimeter-6 → net at margin 1 | +71 KB | 12.8% fewer | 0.0019 |
  | perimeter-6 → perimeter-7 | +119 KB | 58.6% fewer | 0.0074 |
  | perimeter-7 → net at margin 0 | +129 KB | 7.0% fewer | 0.00056 |
  | perimeter-7 → perimeter-7 + bit | +259 KB | 32.0% fewer | 0.0015 |

  So in each gap, the next plain table buys 2.7–3.8× more search per byte than the net does.
- **Nets are slow per node.** A forward pass plus 96 conjugations to find the class representative cost microseconds; a table lookup costs nanoseconds. The edge tables are checked first and the net only runs when they can't prune, and the net-floor searches still took 40–206 s against 8–45 s for the table-only floors. The perimeter-plus-bit tables took 72–100 s, because their perimeter lookup also finds the class representative with 96 conjugations; the exact table's index needs only one. These are single-threaded runs that shared 4 cores, so the times are indicative only.

## Why the nets lose

- **Overestimates sit at the shallow end, and correcting them builds a perimeter table.** Most positions (51%) are at distance 9 and 17% at distance 10. A net trained under a squared-error loss settles near 8–9 almost everywhere, so its overestimates are the 7.7% of positions at distance ≤ 7. Storing their true distances makes the floor exact near solved, which is where IDA* finishes every iteration. That shallow exactness, not the net, is what keeps corner-puzzle node counts low, and it is exactly what a perimeter table provides without the weights.
- **The net's own contribution is small.** It raises the floor by 0.05–0.31 on average, mostly at distances 8–11. On the corner puzzle the scrambles start at distance 4–9, so this buys nothing. In the full 3×3 search it buys 2–18%.
- **A better-trained net can search worse.** The 100-epoch sym net has a higher mean floor than the 30-epoch one (7.28 vs 7.20 at int8, margin 1), but it needs 47% more corner-puzzle nodes (19,904 vs 13,562). Mean floor by true distance (`results/by_depth.json`) shows why:
  - The 30-epoch net overestimated shallow positions more, so the correction table made them exact: 4.00 at distance 4 and 6.97 at distance 7.
  - The better-calibrated 100-epoch net overestimates them less, gets fewer corrections, and is left weaker exactly where the corner search starts (3.91 and 6.79).
  - Its gains are at distances 9–11 (7.49 vs 7.32 at distance 10). In the full 3×3 search, which spends more at those distances, the order flips: 34.1M against 36.3M nodes.
- **Symmetry and inversion help both sides, and the plain tables gain more.** Feeding the net a class representative cuts its corrections about 37× at margin 0, and inversion halves them again. But the same reductions shrink an exact plain table to 438 KB and a perimeter-7 table to 156 KB, and the net's weights don't shrink at all.

## Against the paper

I couldn't open arXiv 2509.22626 from this session (arxiv.org is not in the network allowlist), so the only figure used is the brief's "about 51×". I don't know which baseline that ratio was measured against. Here, against the 44 MB table, the int8 symmetry nets reach 73–155× at margin 0 and up to 615× at margin 2. But plain tables that use the same symmetry knowledge reach 101× exact, and 283× to 5,957× at the nets' corner-puzzle search strength. A ratio against the unreduced table overstates what a network contributes unless the baseline also uses symmetry and a perimeter.

## What was built

1. **The truth** (`bfs.py`). BFS over all 18 face turns, on the index perm-rank × 2187 + twist: 3 seconds with numba on 4 cores. The level counts match Korf's published corner table exactly: 1, 18, 243, 2,874, 28,000, 205,416, 1,168,516, 5,402,628, 20,776,176, 45,391,616, 15,139,616, 64,736. Max 11, mean 8.764.
2. **Symmetry** (`sym.py`). The 48 cube symmetries (Kociemba's generators, with the mirror), checked against the table: 0 mismatches over 2M random positions × 48. Every position was then mapped to its class representative: 1,841,970 classes. All 88,179,840 positions agree with their representative's distance.
3. **Networks** (`nn.py`, `train.py`). numpy MLPs with ReLU and hand-written backprop, gradients checked against finite differences.
   - **Input:** one-hot slot (8) and twist (3) per corner, 88 inputs.
   - **Loss:** squared error, with overestimates weighted 4×.
   - **Training:** Adam with warmup and cosine decay, batch 8,192, checkpoints every 2,000 steps (training resumes from them).
   - **Raw nets** train on all 88M positions.
   - **Sym nets** train on the 1.84M class representatives. At use, a position is first mapped to its representative (48 conjugations).
4. **Floors and the exhaustive check** (`verify.py`). The floor at margin m is max(0, round(pred) − m). Every position (raw) or class (sym) where that floor exceeds the truth goes into the correction table with its true distance. The final floor is then compared with the truth at all 88,179,840 positions, as an assert.
   - **The guard.** The search evaluates the net one position at a time in numba, with a different float summation order from the batched check. So the check adds a guard of 0.001 to the prediction before rounding, and it measures the gap between the two code paths on 200,000 positions; the largest gap is 9e-6. Within that bound, the search's floor is never above the checked one.
5. **Plain tables** (`plain.py`, `perimeter.py`).
   - **Partial tables:** 3–6 corners, each built by its own BFS, and maxes of two.
   - **The symmetry-reduced 8-corner table:** one entry per (corner-permutation class, twist), with 984 permutation classes. A version also reduced by inversion has 654 classes. Filling both from the truth found zero conflicts. Their bytes include a 2-byte-per-permutation map: class, symmetry and inverse flag, packed mixed-radix to under 62,784.
   - **Perimeter tables:** stored exactly like the correction tables, so the comparison with the nets is like for like.
6. **Inversion for both sides** (`inverse.py`). Representatives under the symmetries and inversion: 934,778 classes. The script asserts d(s) = d(s⁻¹) on every position. It builds the perimeter tables and the sym nets' correction tables over these classes, and checks each floor on all 88,179,840 positions. The inverse perimeter tables reproduce the old node counts exactly, which also tests the new lookup.
7. **Corner-puzzle IDA*** (`search.py`, `run_search.py`). The usual move pruning (no face twice in a row; opposite faces in one order). It counts every node generated, across all iterations.
8. **The full 3×3** (`cube3.py`, `edges.py`, `search3.py`, `run_search3.py`).
   - **Edge model:** edges use Kociemba's convention, like the corners. The full-cube model reproduces the known position counts to depth 4 (1, 18, 243, 3,240, 43,239) and the order of R U (105 = 15 on the corners × 7 on the edges).
   - **Edge tables:** two 6-edge tables by BFS (UR UF UL UB DR DF, and DL DB FR FL BL BR), max 10, mean 7.62.
   - **Search:** IDA* takes the max of the corner floor and both edge floors. It looks up the edge floors first, which changes the time but not the node counts.
9. **Perimeter plus a threshold bit** (`threshold.py`). Perimeter tables over symmetry+inverse classes, plus 1 bit per entry of the symmetry+inverse table marking distance ≥ 9. Each variant is checked on all 88,179,840 positions through `search.heur`, the code both searches run.

## Limits

- **numpy, not PyTorch.** `pip install torch --index-url https://download.pytorch.org/whl/cpu` failed: download.pytorch.org is blocked by this session's network proxy (403). Each training run got 10–50 minutes on a shared 4-core machine.
  - **One stalled run.** An earlier raw run with an 8× overestimate weight and learning rate 2e-3 stayed at a constant prediction for 2,000 steps and was stopped.
  - **What longer training would need.** A longer-trained or larger net would have a higher floor. To beat the plain tables it would have to beat its perimeter twin by more than its own weights, while leaving few overestimates.
- **Full-cube scope.** The scrambles are 12 random moves (optimal 8–12), and the edge floor is Korf's pair of 6-edge tables. Deeper scrambles spend even more of the search at large corner distances, which would help the nets somewhat. Stronger edge tables would leave the corner floor less often decisive.
- **One family of lossy plain tables.** Only perimeter tables plus a single threshold bit (distance ≥ 9) were tried. Other lossy designs, such as other thresholds or 2 lossy bits per class, might also fill the 108 KB or 284 KB gap.
- **Bytes are stored bytes.** Permutation maps and int8 scales are counted. Code is not. The full corner table rebuilds by BFS in 3 seconds here, so download size is rarely the binding constraint; memory during search is. The permutation map is counted, although it could be computed at load time, the way the nets compute their class representatives. Without it, every table indexed by permutation class shrinks by 80,640 bytes (the exact table to 357,575). The frontier keeps the same two nets either way: the upper gap becomes 216–334 KB, and the 284 KB net is still the only floor in it.
- **Small sweep.** One loss weight (4×), two net shapes and one raw net were tried.
- **A numba caching trap, caught.** numba's on-disk cache doesn't notice changes to functions in other modules. A cached full-cube search kept an old corner-floor function and gave floors above the truth for the sym+inv nets. The violation count and length checks stopped it before any result was recorded. The full-cube search is no longer cached. An earlier full-cube run was re-run with freshly compiled code and matched exactly on all 50 scrambles.

## Reproduce

```bash
cd lab/neural
python3 bfs.py && python3 sym.py && python3 plain.py && python3 plain.py sym && python3 plain.py stats && python3 perimeter.py
python3 train.py --name sym256 --sym --sizes 256,128,64 --epochs 100 --over 4 --lr 1e-3
python3 verify.py sym256 && python3 inverse.py sym256 && python3 by_depth.py sym256
python3 run_search.py sym256 sym256inv
python3 threshold.py && python3 run_search.py
python3 cube3.py && python3 edges.py && python3 run_search3.py && python3 run_search3.py sym256inv
python3 report.py
```

Trained weights are in `weights/`, and `verify.py` and `inverse.py` rebuild the correction tables from them; the raw net's check takes about 30 minutes. Results are in `results/`. `summary.json` has every row with the fields used above; `table.md`, `table_plain.md`, `table_nets.md` and `table_full3x3.md` are the tables. The tables themselves (`data/`, about 0.8 GB) are rebuilt by the scripts and are not committed.
