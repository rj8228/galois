# Neural floors for the 3×3 corner table: findings

**Question.** On the 2×2, a network trained to underestimate, plus a table of its remaining overestimates, gave a floor that is never too high, but it used more bytes than plain tables. Does that change at 3×3 scale? The test case is the 8-corner table (88,179,840 positions, 44,089,920 bytes at 4 bits), the table that "Learning Admissible Heuristics for A*" (arXiv 2509.22626) compressed about 51×.

## Verdict: no, it does not beat plain tables per byte

The 2×2 result carries over. Every net configuration is beaten by a plain table on bytes and search nodes together:

1. **At full strength, a plain table is smaller and exact.** A table reduced by the cube's 48 symmetries and by inversion (d(s) = d(s⁻¹)) holds the exact distance in **438,215 bytes** stored mod 3 (101× smaller than 44 MB). It searches exactly like the 44 MB table: 2,209 IDA* nodes. Every net configuration of 438 KB or more has a weaker floor and more nodes.
2. **Below that, the network is not what does the work.** The correction table is. Replace the net with a constant and keep the corrections, and you get a *perimeter table*: the exact distance of every position within distance k, and k + 1 everywhere else. Each net was set beside the perimeter table with k = 7 − margin and the same inputs:
   - **Bytes:** the perimeter table is 1.2–32× smaller (1.2–1.5× for the raw net, 1.6–32× for the sym nets).
   - **Search:** the net needs about the same IDA* nodes as its twin, from 6% fewer to 74% more.
   - **Mean floor:** the net is higher by only 0.05–0.31.

   At margin 0 the raw net's correction table contains 6,801,927 of the 6,807,696 positions within distance 7, which is a perimeter table in all but name.

What the nets do achieve is a large ratio against the 44 MB table: up to 576× (76 KB) while staying never too high. But perimeter tables over symmetry classes reach the same search strength with no network at all, at 154× to 3,249×.

Every floor here, net or plain, was checked against the BFS truth on all 88,179,840 positions, and none is ever too high (largest floor − truth: 0). IDA* also compared every floor value it computed with the truth: 0 violations in every run. Every solution it returned was optimal.

## Plain floors

"Mean floor" is over all 88,179,840 positions; the truth's is 8.764. "Exact" is the share of positions where the floor equals the distance. IDA* nodes are summed over 50 scrambles of 12 random moves (seeded; no face turned twice in a row). The 12 moves leave the corners at distance 4–9 from solved.

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
| perimeter table over symmetry classes: exact to 7, 8 beyond | 285,791 | 154× | 7.904 | 31.3% | 2,947 |
| max of two 4-corner tables | 136,080 | 324× | 5.683 | 0.8% | 1,417,867 |
| 4-corner table | 68,040 | 648× | 5.292 | 0.5% | 30,730,621 |
| perimeter table over symmetry classes: exact to 6, 7 beyond | 67,100 | 657× | 6.981 | 7.7% | 13,996 |
| perimeter table over symmetry classes: exact to 5, 6 beyond | 13,570 | 3,249× | 5.997 | 1.6% | 163,943 |
| 3-corner table | 4,536 | 9,720× | 4.078 | 0.0% | 358,853,434 |

The mod-3 rows store each distance mod 3 in 2 bits. They give the same values as their 4-bit versions, because a search knows its parent's exact distance and a child differs from it by at most 1. Their node counts are therefore those of the 4-bit tables. The mod-3 lookup itself was not implemented here.

## Nets beside their zero-parameter twins (int8)

Net bytes = int8 weights (with an fp16 scale and fp16 bias per unit) + the correction table. The correction table stores Elias–Fano coded sorted keys plus 4 bits per value: 10–21 bits per entry, fewer when the keys are dense. The twin is the perimeter table with k = 7 − margin, over the same inputs, coded the same way.

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

fp16 weights give the same floors (within 0.012 mean floor), the same correction counts to within 3%, and nearly the same node counts. They cost 1.02–2× the total bytes, so int8 is the better format throughout. All rows, fp16 included, are in `results/table.md` and `results/summary.json`.

## Why the nets lose

- **Overestimates sit at the shallow end, and correcting them builds a perimeter table.** Most positions (51%) are at distance 9 and 17% at distance 10. A net trained under a squared-error loss settles near 8–9 almost everywhere, so its overestimates are the 7.7% of positions at distance ≤ 7. Storing their true distances makes the floor exact near solved, which is where IDA* finishes every iteration. That shallow exactness, not the net, is what keeps node counts low, and it is exactly what a perimeter table provides without the weights.
- **The net's own contribution lands where these searches spend little.** The net raises the floor by 0.05–0.31 on average, mostly at distances 8–11. These scrambles start at distance 4–9, so the extra height buys nothing here.
- **A better-trained net can search worse.** The 100-epoch sym net has a higher mean floor than the 30-epoch one (7.28 vs 7.20 at int8, margin 1), but it needs 47% more nodes (19,904 vs 13,562). Mean floor by true distance (`results/by_depth.json`) shows why:
  - The 30-epoch net overestimated shallow positions more, so the correction table made them exact: 4.00 at distance 4 and 6.97 at distance 7.
  - The better-calibrated 100-epoch net overestimates them less, gets fewer corrections, and is left weaker exactly where search starts (3.91 and 6.79).
  - Its gains are at distances 9–11 (7.49 vs 7.32 at distance 10).
- **Symmetry helps both sides, and the plain table gains more.** Feeding the net a symmetry-class representative cuts its corrections about 37× at margin 0 (7.8M positions down to 210k classes). The same symmetries, plus inversion, shrink an exact plain table to 438 KB. Neither the nets nor the perimeter tables come close to that table's strength.

## Against the paper

I couldn't open arXiv 2509.22626 from this session (arxiv.org is not in the network allowlist), so the only figure used is the brief's "about 51×". I don't know which baseline that ratio was measured against. Here, the nets reach 73× (margin 0) to 576× (margin 2) against the 44 MB table. But plain tables that use the same symmetry knowledge reach 101× exact, and 154× to 3,249× at the nets' search strength. A ratio against the unreduced table overstates what a network contributes unless the baseline also uses symmetry and a perimeter.

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
   - **The symmetry-reduced 8-corner table:** one entry per (corner-permutation class, twist), with 984 permutation classes. A version also reduced by inversion has 654 classes. Filling both from the truth found zero conflicts, which also verifies d(s) = d(s⁻¹) on every position. Their bytes include a 2-byte-per-permutation map: class, symmetry and inverse flag, packed mixed-radix to under 62,784.
   - **Perimeter tables:** stored exactly like the correction tables, so the comparison with the nets is like for like.
6. **IDA*** (`search.py`, `run_search.py`). On the 8-corner puzzle, with the usual move pruning (no face twice in a row; opposite faces in one order). It counts every node visited across all iterations.

## Limits

- **numpy, not PyTorch.** `pip install torch --index-url https://download.pytorch.org/whl/cpu` failed: download.pytorch.org is blocked by this session's network proxy (403). Each training run got 10–50 minutes on a shared 4-core machine.
  - **One stalled run.** An earlier raw run with an 8× overestimate weight and learning rate 2e-3 stayed at a constant prediction for 2,000 steps and was stopped.
  - **What longer training would need.** A longer-trained or larger net would have a higher floor. To beat the plain tables it would have to beat its perimeter twin by more than its own weights, while leaving few overestimates, and the 100-epoch run moved the wrong way on search nodes.
- **Search is on the corner puzzle, not the full 3×3.** In a full 3×3 search the corner floor is consulted at positions whose corners are spread far more evenly over all distances. There, the mean floor counts for more than exactness near solved, and the nets' +0.2–0.3 over the perimeter tables would matter more. Even so, the exact 438 KB table beats every net at 438 KB or more on mean floor too. Between 76 and 286 KB the sym nets have the highest mean floor measured for their size, but only narrowly. Stepping from the 67 KB perimeter table to the 286 KB one adds 4.2 of mean floor per extra MB, more than any net adds over its twin (at most 3.7 per MB).
- **Bytes are stored bytes.** Permutation maps and int8 scales are counted. Code is not. The full table rebuilds by BFS in 3 seconds here, so download size is rarely the binding constraint; memory during search is.
- **Small sweep.** One loss weight (4×), two net shapes and one raw net were tried. Lossy symmetry-aware plain tables (for example, 1 bit per class) were not.

## Reproduce

```bash
cd lab/neural
python3 bfs.py && python3 sym.py && python3 plain.py && python3 plain.py sym && python3 plain.py stats && python3 perimeter.py
python3 train.py --name sym256 --sym --sizes 256,128,64 --epochs 100 --over 4 --lr 1e-3
python3 verify.py sym256 && python3 run_search.py sym256 && python3 by_depth.py sym256 && python3 report.py
```

Trained weights are in `weights/`, and `verify.py` rebuilds the correction tables from them; the raw net's check takes about 30 minutes. Results are in `results/`. `summary.json` has every row with the fields used above; `table.md`, `table_plain.md` and `table_nets.md` are the tables. The tables themselves (`data/`, about 0.7 GB) are rebuilt by the scripts and are not committed.
