# Speed lab, round 1: what we found

**Round 2 is in [SYNTHESIS-2.md](SYNTHESIS-2.md).**

Three tasks, stitched together: the search atlas of every 2×2 position (T1, `atlas/`), the compass (T2, `compass/`) and the 3×3 anatomy (T4, `anatomy3/`). Each folder's FINDINGS.md has the full tables and checks. Every solve in every task was checked: lengths against the 2×2 truth table, and 3×3 solutions replayed and compared with `lab/3x3`.

## In one paragraph

On the 3×3, an optimal solve spends **82–86% of its work in the final round**, hunting for the one shortest solution. **84–90% of positions have exactly one**, counting U D and D U as one sequence. It also spends **92.5% of its floor reads on positions it throws away at once**. Mirror lookups, the free win on the 2×2, are already used where they pay. So the next speed has to come from two levers:
- a **compass**, which finds the solution sooner. Done perfectly it would cut 4–7× of the work, and cheap versions get almost none of that.
- **gravity**, which skips the wasted reads: 67–85% of reads on the desktop set, for extra memory.

They act on different things, so they stack.

## The levers, measured

| Lever | What it removes | 2×2 | 3×3 | Where it stands |
|---|---|---|---|---|
| **Mirror** (read h(x⁻¹) too) | proof and find, as a stronger floor | 1.3–5.5× fewer lookups, free | 2.2–2.4× fewer nodes on the phase-1 table (in the desktop set already); 1.23–1.29× on corner and edge tables; 2-bit phone tables can't use it | Done |
| **Compass** (move order in the final round) | most of the final round | perfect order: 2×. Best practical, a 144 KB mean-distance table: 25% of that. Learned rankers lose net | perfect order: **5.5–7.2×** at 14–16 moves, **4.1×** on random states. Cheap orders: at most 1.15× | The biggest prize. Needs a strong compass that is called rarely |
| **Gravity** (downhill masks) | reads of children that are cut on arrival | 74–80% of reads sit under a tight parent | masks skip **67–85% of reads** on the desktop set, for 331–661 MB. The phone set's masks would cost 9–18× its budget | Counted, not built. The time gain needs a prototype |
| **Best twin** (solve the cheapest symmetric copy) | everything | oracle: **1.75×** on every floor. Highest-floor proxy: at most 1.13× | not measured; there are 96 twins | Needs a chooser |
| **Floors for the 6-against-9–10 band** | proof and find | 82% of 2×2 work goes to positions the floor rates at 6 that need 9 or 10 | not measured | An idea for floor design |

## Three findings that shape what comes next

1. **The compass only has to be good near the start of the search.**
   - On the 2×2, the perfect order applied only at nodes 8 or more moves from the end keeps 97–100% of its gain, with 10–30 calls per solve.
   - A wrong turn deep in the tree costs a tiny subtree; near the root it costs a huge one.
   - So on the 3×3 the compass can be expensive per call: a network of 100,000–1,000,000 multiply-adds, or a full fast solver.
2. **Cheap orders fail for a structural reason.**
   - At a node sitting exactly on the bound, about one child in 13 survives, and the survivors all have nearly the same floor. So the floor can't tell them apart.
   - The compass needs information the floor doesn't have: something close to the true distance of each child, 8–16 moves out.
3. **We already own a fast estimate of the true distance: the ceiling solver.**
   - The two-phase solver (cubing.js, or Kociemba's tables) finds a near-optimal solution in milliseconds.
   - Its length from each child near the root is a far stronger hint than any floor.
   - Using the framework's own ceiling as its compass is the most promising next experiment. A small learned ranker, trained on positions along optimal solutions (exact labels, as T2 describes), is the fallback.

## What the 3×3 runs looked like

From T4's tables, desktop set `C8s+P1x3i`, one thread, native C:

| Scrambles | Lookups per solve | Final round's share | With a perfect compass | Time per solve |
|---|--:|--:|--:|--:|
| 14 moves (50) | 616,532 | 86% | 89,568 (6.9×) | 72.5 ms |
| 16 moves (50) | 87,239,984 | 85% | 13,165,783 (6.6×) | 10.6 s |
| Random state (8) | 5,876,551,998 | 76% (median 56%) | 1,431,128,691 (4.1×) | 12.3 min |

**A rough upper bound, not a measurement.** Combine a near-perfect compass (about 4× on random states) with gravity (perhaps 2× in time if the reads it skips are the bottleneck) and spread the work over 8 cores. A random position would then take seconds to tens of seconds on a desktop. That is close to the goal of a random state under a minute in a laptop browser, and it is why both levers are worth building.

## Next experiments

Round 2 briefs:
- [T6-ceiling-race.md](T6-ceiling-race.md) carries out experiment 1, widened into a race: the ceiling does the finding, so the prover only has to prove.
- [T3-gravity.md](T3-gravity.md) carries out experiment 2.
- [T5-browser-speed.md](T5-browser-speed.md) carries out experiment 3.

1. **Ceiling as compass (3×3).** At the first few levels of the final round, run the two-phase solver from each surviving child and try the shortest first.
   - Measure: final-round lookups against the perfect-compass bound, and the time of the two-phase calls.
   - Sets: 14 and 16 moves, then random states.
   - Try it with best twin at the root (choose among the 96 twins by a two-phase probe).
2. **Gravity prototype (3×3 desktop set).** Down-only masks for C8s and P1, about 331 MB.
   - Measure wall time per solve on the 14- and 16-move sets against the baseline, to see whether skipped reads become time.
3. **Then, the browser** (T5): WebAssembly, several workers, and the 3×3 Solver in the app with whatever wins.
