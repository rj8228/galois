# T2 Compass: findings

Counting is **exp8** throughout (read all of a node's children, then descend), on the shared 1,000 benchmark positions. **Recovered share** = (L_move − L_compass) / (L_move − L_perfect), where L is mean lookups per solve. **Net** share also charges each compass evaluation its measured time, converted into floor lookups. All 16,000+ benchmark solves across every compass and floor returned a length equal to the truth table.

## Verdict

1. **The best compass is not learned: a small table of mean true distance.** It is indexed by an abstraction of the position (corners 0–3: slot and twist), read for x and x⁻¹, and the child with the lowest sum is tried first. It recovers **23–29%** of the perfect order's gain on all four floors, and **21–26% net** of its time. The catch is memory: it is 144 KB. The 5.8 KB version (twists table + permutation table) recovers 17–18%, or 10–15% net. The 729-byte twists table alone recovers 6–9%, or 4–6% net.
2. **Spending the same bytes on a bigger floor is better on the 2×2.** 20 KB floor + 5.8 KB compass costs about 1,690 effective lookups. Interpolating between the measured 20 KB floor (1,788) and 100 KB floor (403) suggests a 26 KB floor would cost about 1,400. That is an interpolation, not a measurement. The compass only earns its bytes when the floor can't grow any more, or when the table is nearly free (the 729-byte one).
3. **Learned rankers recover a little, but they cost more time than they save.** The best one is a listwise ranker: 64 hidden units, with inputs x and x⁻¹ one-hot plus the floor's own component values, trained per floor. It recovers 7% at 20 KB, 9% at 100 KB and 19% at 400 KB, and −2% at 2 KB. One evaluation takes 0.4–0.8 of a floor lookup's time, which makes it −14% to −1% net. Limiting it to nodes with 8 or more moves left makes it slightly positive (0–3% net). Pure one-hot rankers and a distance regressor (256 hidden units) recover 0–6%, the same flatness network D showed. A small MLP cannot read distance from the one-hot input on this puzzle.
4. **Cheap reorderings using values already read win nothing, and often lose.** These are: the floor itself, the sum of component floors, floor-then-sum, and h(x)+h(x⁻¹). They score from −30% to +4%. They get worse as the floor gets stronger, because at a tight node every survivor has nearly the same floor. The two-move look-ahead does not order better (−13% to +1%) and costs 9 reads per evaluation. A second floor (twists + permutation) recovers 2–6% and loses net.
5. **All the value is near the root.** The perfect compass applied only at nodes with 8 or more moves left keeps **97–100%** of its gain, with 10–30 evaluations per solve instead of 140–895. A wrong turn deep in the tree costs a tiny subtree; near the root it costs a large one. This matters most for the 3×3 (see below): a compass may be expensive per call, because it is called rarely.

**Best compass, stated plainly:** mean-distance table on corners 0–3, 144 KB. Recovered share 24.6% at 20 KB + mirror (1,788 → 1,563 lookups; perfect 874). Cost: about 238 evaluations per solve, each 2 one-byte reads, measured at 0.12 floor lookups. Net 21.6%. Break-even: one evaluation may cost up to 0.95 floor lookups ((1,788 − 1,563) / 238). The ranker MLP costs 0.76 lookups per evaluation and recovers far less, which is why it loses.

## Tables

Mean lookups per solve (exp8). Columns per floor: lookups / recovered / net after time.

| Compass | Extra bytes | 2 KB + mirror | 20 KB + mirror | 100 KB + mirror | 400 KB + mirror |
|---|--:|--:|--:|--:|--:|
| Move order (baseline) | 0 | 12,501 | 1,788 | 403 | 108 |
| Floor first | 0 | 12,487 / 0% / 0% | 1,792 / −0% / −0% | 412 / −5% / −5% | 114 / −23% / −23% |
| Sum of component floors | 0 | 12,625 / −2% | 1,800 / −1% | 423 / −11% | 112 / −15% |
| Floor, then sum of components | 0 | 12,531 / −0% | 1,806 / −2% | 408 / −3% | 114 / −24% |
| Mirror h(x)+h(x⁻¹) | 0 | 12,230 / 4% / 4% | 1,773 / 2% / 2% | 417 / −7% | 116 / −30% |
| Second floor (twists+perm) | 2.9 KB | 12,119 / 6% / 1% | 1,749 / 4% / −3% | 400 / 2% / −2% | 112 / −16% / −23% |
| Two-move look-ahead min | 0 | 12,636 / −2% / −260% | 1,781 / 1% / −266% | 407 / −2% / −291% | 111 / −13% / −456% |
| Tiny table: twists (729 B) | 729 B | 12,079 / 6% / 4% | 1,710 / 9% / 5% | 392 / 6% / 4% | 106 / 9% / 6% |
| Tiny table: permutation | 5 KB | 11,645 / 13% / 11% | 1,689 / 11% / 8% | 380 / 13% / 11% | 105 / 10% / 7% |
| Tiny table: twists + permutation | 5.8 KB | 11,326 / 18% / 14% | 1,632 / 17% / 11% | 369 / 18% / 15% | 104 / 17% / 10% |
| Tiny table: corners 012 | 8 KB | 12,008 / 8% / 5% | 1,733 / 6% / 3% | 397 / 3% / 1% | 106 / 9% / 6% |
| **Tiny table: corners 0123** | 144 KB | **10,801 / 26% / 24%** | **1,563 / 25% / 22%** | **362 / 23% / 21%** | **100 / 29% / 26%** |
| Listwise ranker 64h + components | 85–159 KB fp32 | 12,631 / −2% / −18% | 1,721 / 7% / −14% | 386 / 9% / −3% | 103 / 19% / −1% |
| Listwise ranker 32h, one-hot only | 18 KB fp32 | 12,309 / 3% / −5% | 1,771 / 2% / −9% | 401 / 1% / −5% | 108 / 1% / −9% |
| Distance regressor 256h | 144 KB fp32 | 12,130 / 6% / −56% | 1,749 / 4% / −83% | 400 / 2% / −46% | 109 / −2% / −84% |
| Truth first (perfect) | – | 5,921 | 874 | 220 | 81 |

Final-round lookups for every row are in `results/frontier.json`. Final-round lookups at the perfect order are 55 on every floor.

Evaluations per solve, counted only at nodes with 2 or more survivors, in all rounds: about 1,800 at 2 KB, 260 at 20 KB, 55 at 100 KB and 12 at 400 KB. Model sizes are float32. int8 would quarter them; that was not tested.

### Rank only near the root (`results/near_root.json`)

| Floor | Perfect compass, all nodes (evals) | Perfect, nodes with 8+ moves left (evals, recovered) | Ranker 64h, 8+ left (recovered, net) |
|---|--:|--:|--:|
| 2 KB + mirror | 895 | 30, 97.3% | −2.5%, −2.9% |
| 20 KB + mirror | 140 | 30, 97.7% | 6.7%, +3.1% |
| 100 KB + mirror | 35 | 27, 98.8% | 8.8%, +0.5% |
| 400 KB + mirror | 10 | 10, 99.9% | 18.6%, +0.3% |

### Time per evaluation (`results/timing.json`, numba loop, this container)

| Floor | Tables read per floor lookup (x and x⁻¹) | Floor lookup | Tiny-table eval (x, x⁻¹) | MLP 64h eval | MLP multiply-adds |
|---|--:|--:|--:|--:|--:|
| 2 KB | 24 | 1,126 ns | ~95 ns | 634 ns | 3,392 |
| 20 KB | 16 | 759 ns | ~75–105 ns | 573 ns | 2,880 |
| 100 KB | 40 | 1,731 ns | ~95 ns | 668 ns | 4,416 |
| 400 KB | 26 | 1,224 ns | ~80 ns | 540 ns | 3,520 |

The absolute nanoseconds include the same index arithmetic in each loop, so they overstate the true costs. Only the ratios are used. The MLP's first layer is sparse: about 28 + 2T active inputs, each adding a 64-wide row.

## Why the learned rankers struggle here

- **The signal is near the root, and so is the scarcity.** Of 2.36 M recorded final-round nodes, only about 63 k (at 20 KB) have some survivors that lead home and some that don't. Each training root contributes only a handful of nodes with many moves left. Weighting nodes by 3^(moves left) helped: 20 KB went from 4.7% to 7.3%.
- **Ranking siblings needs near-exact distance at 8–10 moves.** This is exactly where both the floors and network D are flat. A mean-distance table gets there by averaging over a large abstraction. A 64-unit MLP over a one-hot did not, even with the component floors as inputs.
- Top-1 accuracy (does the first-tried child lead home?) rose from 25% (random) to 35–46%. That did not turn into lookups in proportion, because what matters is the cost of the failed subtrees tried first, not the hit rate.

## Carrying it to the 3×3

- **Labels without a truth table.** Every position on an optimal solution found by `lab/3x3`'s solver has an exact distance: L − k at step k. At each node of that solve's final round, the child the solution took is a certain positive. Siblings are unlabeled rather than negative, because other optimal solutions exist; the 2×2's doors-home counts show this is common at 10+ moves. So use the listwise loss already written here, −log(probability mass on the good children). It accepts several positives, and it treats the solution's child as a known positive and the rest as unknown. Re-solving from sibling positions with a capped prover can turn some unknowns into proven negatives ("needs more than the budget"). This is costly but exact. Weight nodes by moves left.
- **The cheapest win is likely a tiny table, not a network.** E[distance | abstraction] can't be computed exactly on the 3×3. It can be estimated from a few thousand optimal solves (every path position is a labeled sample), or a stronger floor can stand in for distance: E[big floor | small abstraction]. On the 2×2 the 729-byte and 5 KB versions were the only compasses that were positive net at every floor.
- **How big a model fits a browser-speed search.** On the 2×2 the break-even was 0.1–1 floor lookups per evaluation when ranking at every node. Ranking only at nodes with 8+ moves left keeps 97–100% of the perfect gain with 10–30 evaluations per solve. A 3×3 final round explores millions of nodes, but nodes near the root are few: thousands at most. So a model can cost thousands of floor lookups per call there and still pay off. In a browser, that is roughly a 100k–1M multiply-add network (e.g. 300 → 256 → 256 → 1 in int8 WASM SIMD, well under 1 ms per call), or a 100 KB–1 MB table. Measuring the actual near-root node counts and the final round's share on the 3×3 is T4's job. The compass only helps if the final round dominates there too.

## How it was checked

- `check_baseline.py`: the compiled IDA\* reproduces exp8's 20 KB + mirror numbers (1,788 / 969 move order, 874 / 55 perfect; exp8 printed 1,787 / 873).
- `evaluate()` asserts that every benchmark solve's length equals the truth table. Every row above has 1,000 / 1,000 optimal.
- Every component table rebuilt here is asserted never too high on all 3,674,160 positions. The floors are lab/2x2's exp2 floors, with the mirror lookup added.
- The benchmark positions are excluded from every training set: ranker roots, uniform samples, and regressor data. The mean-distance tables are averages over all positions, benchmark included; each is one statistic over at least 729 cells, not a per-position lookup.
- Compass scores are precomputed for all positions to make counting fast. Time cost comes from the separate compiled measurement, not from that precomputation.

## Files and reproduction

Rebuild the 2×2 data first (from `lab/2x2`: `exp1_truth.py`, `exp2_floors.py`). Then, from this folder:

```sh
python3 check_baseline.py
python3 static_compasses.py           # non-learned and tiny-table compasses -> results/static_compasses.json
for B in 2000 20000 100000 400000; do WBASE=3 python3 learned_ranker.py 64 comp $B; done
python3 distance_regressor.py 256 6
python3 timing.py                     # -> results/timing.json
python3 make_frontier.py              # -> results/frontier.json (all compass x floor rows)
python3 near_root.py                  # -> results/near_root.json
```

Training is seeded and deterministic. Weights are in `results/weights_*.npz` (each under 200 KB). Caveat: the "32 hidden, one-hot only" ranker (`weights_mlp_mirror_32.npz`) came from an earlier version of `learned_ranker.py`: fewer training roots and no moves-left weighting. To retrain it from the current script, run `WBASE=1 python3 learned_ranker.py 32 mirror all`. The result will be similar but not identical, and `make_frontier.py` then picks up the new score file.
