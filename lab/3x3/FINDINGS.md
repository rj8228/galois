# 3×3 floors: findings

Phase 8 lab. Question: which floors (admissible lower bounds) make guaranteed-optimal 3×3 solving fast, and what do they cost in memory? The app needs a phone set (≤ 20 MB) and a desktop set (≤ 500 MB). How to rerun every number: [README.md](README.md).

## Recommendation

**Phone (≤ 20 MB): `C8s@2+E6x8@2`, 12.3 MB.** The 8-corner table (reduced by 16 symmetries) and one 6-edge table read through 8 symmetries, both stored at 2 bits per entry. Mean time per optimal solve on one thread: **12 ms** at 12 moves, **1.6 s** at 14 moves, about **4 minutes** at 16 moves (estimated: 43 of 50 solves were capped), and about **a day** for a random state (estimated at 21 hours; every random-state solve was capped). Superflip would take about 27 hours on four threads (estimated).

**Desktop (≤ 500 MB): `C8s+P1x3i`, 77 MB.** The same corner table plus Kociemba's phase-1 coordinate (corner twist × edge flip × UD-slice, 70 MB after symmetry reduction), read along all three axes and on the inverse position. Mean time per optimal solve on one thread: **1.3 ms** at 12 moves, **72 ms** at 14, **9.6 s** at 16, and **11.5 minutes** for a random state (mean of the 18 of 20 positions that need 17 or 18 moves; median 9.1 minutes, worst 28). The other two random states need 19 moves: the search proved that in about 48 minutes each, then hit its 30-billion-node cap partway through depth 19. Superflip: **exactly 20 moves**, in 25 minutes on four threads (51 billion nodes, 92% of them spent proving that 19 moves are not enough).

The desktop set uses less than a sixth of its budget, because nothing else measured here earns its memory. Adding the 255 MB 7-edge table (`C8s+E7x2i+P1x3i`, 332 MB) removes under 1% of the nodes at 16 moves and makes each solve 58% slower (15.1 s), since every node then reads two more entries from a 255 MB table. It was not run on the random states: at 16 moves it changes nothing that matters, and the time went to the recommended sets instead.

### What this means for the app

- **Optimal is interactive only for short scrambles.** On a phone, the optimal solver answers instantly up to about 12 moves and in seconds at 14. At 16 moves it needs minutes, and a random state about a day. A desktop answers 16-move positions in seconds and random states in about 10 minutes on one thread (19-move positions take hours). These are native C times on a 2.1 GHz Xeon core; a WebAssembly build on a phone will be slower.
- **The finale should show the proof, not wait for it.** IDA* proves a lower bound each time it finishes a depth ("no solution in 16 moves"). The *How deep a floor set can prove, by time* table below gives the depth each set reaches in a given time on random states. That is the natural progress bar for the search view, and a time limit can end it gracefully.
- **For random states on a phone, pair it with two-phase.** Show the two-phase solution (fast, near-optimal) at once, and let the optimal search climb towards it.
- **If the phone budget can reach 40 MB, take phase 1.** `C8s@2+P1x3@2` (40 MB: phase 1 and corners at 2 bits) solves 14-move positions in 89 ms instead of 1.6 s, and 16-move positions in 12.7 s instead of about 4 minutes, roughly 20× faster. It loses the inverse lookups (2-bit tables can't do them), which is why it trails the desktop set.
- **Download or build? Build.** With xz, the phone set compresses from 12.2 MB to 8.1 MB (2-bit tables look almost random) and the desktop set from 73.5 MB to 25.8 MB (`results/sizes.json`). Building them from scratch on one native thread takes 0.7 s (corners) plus 5.2 s (6 edges) for the phone set, and 0.7 s plus 17 s (phase 1) for the desktop set. Even several times slower in WebAssembly, building on first use and caching in IndexedDB beats a download of that size.

## What made the difference

1. **Phase 1 is the best floor per byte at the top.** On its own, `P1` (74 MB) has a mean of 9.53 over random positions, above all 8 corners (8.76) and above corners plus 7 edges (9.15). Read along three axes and on the inverse (`P1x3i`, same 74 MB), it reaches 10.10, matching the 332 MB set (10.11). Corners add what phase 1 cannot see: the corner permutation. That is worth 9% of the nodes at 16 moves (`C8s+P1x3i` vs `P1x3i`) for 3.2 MB.
2. **Inverse lookups are the cheapest big win.** A position and its inverse are the same distance from solved, so every table can be read twice. `P1x3i` searches 2.2× fewer nodes than `P1x3` at 16 moves, and is 1.4× faster in time.
3. **Symmetry shrinks tables for free.** The corner table drops from 44 MB to 3.0 MB (16 symmetries; 2,768 corner-permutation classes) with identical values, and phase 1 drops from 1.1 GB to 70 MB. Lookups through symmetry let one 6-edge table stand for 24 edge sets.
4. **More lookups trade nodes for time per node.** Going from 2 to 8 to 24 symmetric 6-edge lookups cuts nodes by 43% then 31%, but the 24-lookup set is the slowest (2.2 s vs 1.6 s at 14 moves). The sweet spot was 8 for the 6-edge table, the three axes for phase 1, and the minimum for the 7-edge table.
5. **2-bit tables halve memory and cost about 10% speed.** Storing each distance mod 3 works because the search knows the parent's exact value and one move changes it by at most 1. Same nodes, roughly 10% fewer nodes per second (`C8s@2+E6x8@2` vs `C8s+E6x8`: 1.59 s vs 1.45 s at 14 moves).
6. **Kociemba's small coordinate tables are too weak alone.** Twist, flip and slice and their pairs (3.3 MB) solve 12-move scrambles but need hundreds of millions of nodes at 14. Under 20 MB they add almost nothing to corners plus 6 edges either: 7% fewer nodes at 12 moves, 2% at 14, and a slower search overall.

## What was measured

- **Floors.** All 8 corners (88,179,840 positions; full table 44 MB, or 3.0 MB reduced by 16 symmetries, with identical values). 6 edges with orientation (42,577,920; 21.3 MB) and 7 edges (510,935,040; 255 MB), each read through several symmetries. Kociemba's coordinates: corner twist, edge flip, UD-slice, their three pairs, and phase 1 (twist × flip × slice: 2.2 billion raw entries, stored as 140,908,410 after 16-fold symmetry reduction; 70 MB). Every table can also be stored at 2 bits per entry (distance mod 3), half the size.
- **Correctness.** Every floor checked against the true distance at all 8,240,087 positions within 6 moves: no floor ever exceeds it. The search returns exactly the true distance on those positions (52,741 of them: all within 4 moves, 3,000 each at 5 and 6), for five floor sets including both recommended ones. Every benchmark solution replayed by the solver and again by cubing.js (3,126 solutions, 0 failures: `results/cubing-check.json`). The corner table's distance counts match Korf (1997) exactly, and the 6-edge mean (7.668) matches his.
- **Benchmark.** IDA* on 50 scrambles each of 12, 14 and 16 random moves (seeded), 20 random-state scrambles from cubing.js, and superflip. For each floor set: memory, mean and maximum nodes, time per solve, solution lengths. The random-move scrambles never turn the same face twice in a row and take opposite faces in a fixed order, so almost nothing cancels: 48 of 50 need exactly 12 moves, 48 of 50 exactly 14, 47 of 50 exactly 16. Random states need 17 or 18 moves (2 and 16 of the 20). The other two need at least 19, which the search proved before its cap stopped it.
- **Budgets.** Floor sets that could not finish an easier set, or whose estimate for the next set was over 12 billion nodes, are skipped there; the JSON records why. The best phone and desktop sets were forced through the 16-move and random-state sets. The phone set was capped per solve there (600 million and 750 million nodes) and the rest estimated from the depths it finished (see *Capped runs*). The desktop set's random-state solves had a 30-billion-node cap, which only the two 19-move positions reached.

*Nodes* are positions generated by the search, each looked up in the floors (or, one move from the end, compared with solved). Each solve runs on one thread with four solves running at once; superflip runs on all four threads. Times are native C (gcc -O3).

## Results

<!-- tables:start -->

Measured on Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, 16.9 GB RAM, Linux-6.18.44-fc-v185-x86_64-with-glibc2.39, cc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 4 threads.

### Tables

| Table | Entries | Max | Mean (entries) | 4-bit | 2-bit (mod 3) | Build |
| --- | --: | --: | --: | --: | --: | --: |
| `slice` | 495 | 5 | 3.192 | 0.2 KB | 0.1 KB | 0.0 s |
| `flip` | 2,048 | 7 | 4.609 | 1.0 KB | 0.5 KB | 0.0 s |
| `twist` | 2,187 | 6 | 4.459 | 1.1 KB | 0.5 KB | 0.0 s |
| `flip_slice` | 1,013,760 | 9 | 6.837 | 0.5 MB | 0.3 MB | 0.0 s |
| `twist_slice` | 1,082,565 | 9 | 6.739 | 0.5 MB | 0.3 MB | 0.0 s |
| `twist_flip` | 4,478,976 | 9 | 7.169 | 2.2 MB | 1.1 MB | 0.1 s |
| `corners_sym` | 6,053,616 | 11 | 8.768 | 3.0 MB | 1.5 MB | 0.2 s |
| `edges6` | 42,577,920 | 10 | 7.668 | 21.3 MB | 10.6 MB | 1.4 s |
| `corners` | 88,179,840 | 11 | 8.764 | 44.1 MB | 22.0 MB | 1.3 s |
| `phase1_sym` | 140,908,410 | 12 | 9.525 | 70.5 MB | 35.2 MB | 5.0 s |
| `edges7` | 510,935,040 | 11 | 8.508 | 255 MB | 128 MB | 28.1 s |

### Every floor against the true distance

All 8,240,087 positions within 6 moves (1, 18, 243, 3,240, 43,239, 574,908, 7,618,438 at distance 0–6), found by breadth-first search over whole positions. *Violations* counts lookups above the true distance, *max floor − distance* is the worst case (0 means some position meets its floor exactly). The last column is the mean floor over 1,000,000 uniformly random positions (`results/stats.json`).

| Floor | Lookups | Violations | Max floor − distance | Mean floor at distance 6 | Mean floor, random |
| --- | --: | --: | --: | --: | --: |
| `C8s+P1x3i` | 7 | 0 | 0 | 5.848 | 10.105 |
| `C8s@2+E6x8@2` | 9 | 0 | 0 | 5.945 | 8.981 |
| `C8s+E7x2i+P1x3i` | 11 | 0 | 0 | 5.990 | 10.106 |
| `C8s@2+E6x24@2+Ktsx3i+Kfsx3i+Ktfx3i` | 43 | 0 | 0 | 5.995 | 9.064 |
| `C8s@2+E7x24@2+P1x3@2` | 28 | 0 | 0 | 5.994 | 9.987 |
| `Kt` | 1 | 0 | 0 | 3.679 | 4.459 |
| `Kf` | 1 | 0 | 0 | 2.716 | 4.609 |
| `Ks` | 1 | 0 | 0 | 2.979 | 3.192 |
| `Kts` | 1 | 0 | 0 | 4.468 | 6.739 |
| `Kfs` | 1 | 0 | 0 | 4.263 | 6.837 |
| `Ktf` | 1 | 0 | 0 | 4.565 | 7.170 |
| `Ktsx3` | 3 | 0 | 0 | 5.199 | 7.264 |
| `Kfsx3` | 3 | 0 | 0 | 5.029 | 7.281 |
| `Ktfx3` | 3 | 0 | 0 | 5.314 | 7.676 |
| `P1` | 1 | 0 | 0 | 4.738 | 9.525 |
| `P1x3` | 3 | 0 | 0 | 5.350 | 9.947 |
| `P1x3i` | 6 | 0 | 0 | 5.754 | 10.099 |
| `C8` | 1 | 0 | 0 | 5.375 | 8.764 |
| `C8s` | 1 | 0 | 0 | 5.375 | 8.764 |
| `E6x2` | 2 | 0 | 0 | 5.743 | 8.024 |
| `E6x8` | 8 | 0 | 0 | 5.908 | 8.375 |
| `E6x24` | 24 | 0 | 0 | 5.974 | 8.647 |
| `E6x24i` | 48 | 0 | 0 | 5.974 | 8.779 |
| `C8s@2` | 1 | 0 | 0 | 5.375 | 8.764 |
| `E6x8@2` | 8 | 0 | 0 | 5.908 | 8.375 |
| `E6x24@2` | 24 | 0 | 0 | 5.974 | 8.647 |
| `Ktsx3@2` | 3 | 0 | 0 | 5.199 | 7.264 |
| `Kfsx3@2` | 3 | 0 | 0 | 5.029 | 7.281 |
| `Ktfx3@2` | 3 | 0 | 0 | 5.314 | 7.676 |
| `Ktsx3i` | 6 | 0 | 0 | 5.603 | 7.489 |
| `Kfsx3i` | 6 | 0 | 0 | 5.402 | 7.487 |
| `Ktfx3i` | 6 | 0 | 0 | 5.710 | 7.876 |
| `E7x2` | 2 | 0 | 0 | 5.873 | 8.835 |
| `E7x8` | 8 | 0 | 0 | 5.924 | 9.111 |
| `E7x8i` | 16 | 0 | 0 | 5.968 | 9.238 |
| `P1x3@2` | 3 | 0 | 0 | 5.350 | 9.947 |
| `E7x2i` | 4 | 0 | 0 | 5.956 | 9.012 |
| `E7x24@2` | 24 | 0 | 0 | 5.974 | 9.326 |

The search on the same positions (every position at distance ≤ 4, 3,000 sampled at 5 and 6), solution length must equal the distance: `C8s+P1x3i`: 52,741 of 52,741 optimal; `C8s@2+E6x8@2`: 52,741 of 52,741 optimal; `C8s+E7x2i+P1x3i`: 52,741 of 52,741 optimal; `C8s@2+E6x24@2+Ktsx3i+Kfsx3i+Ktfx3i`: 52,741 of 52,741 optimal; `C8s@2+E7x24@2+P1x3@2`: 52,741 of 52,741 optimal.

### Overview: mean nodes / mean time per solve

Memory is what the app holds: packed tables plus the small class tables that index the symmetry-reduced ones (those can also be computed at startup in about a second). Mean floor is over 1,000,000 random positions. Each solve runs on one thread, four at a time. *Skipped* means the estimate from the previous set (or a 4-scramble probe) was over the budget; the reason is in the JSON. A dash means not run: `C8` and the 4-bit twins of the 2-bit phone sets search exactly the same nodes as their twins, so they stop after 14 moves. *est.* marks a capped run, estimated as described under *Capped runs*.

| Floor set | Family | Memory | Mean floor | 12 random moves | 14 random moves | 16 random moves | Random state (cubing.js) |
| --- | --- | --: | --: | --: | --: | --: | --: |
| `Kt+Kf+Ks` | Kociemba coordinates | 2.4 KB | 5.00 | skipped | skipped | skipped | skipped |
| `Kts+Kfs+Ktf` | Kociemba coordinates | 3.3 MB | 7.47 | 5.0e7 / 1.6 s | skipped | skipped | skipped |
| `Ktsx3+Kfsx3+Ktfx3` | Kociemba coordinates | 3.3 MB | 7.84 | 2.2e6 / 120.0 ms | 2.4e8 / 14.0 s | skipped | skipped |
| `P1` | Kociemba coordinates | 73.6 MB | 9.53 | 4.3e7 / 1.3 s | skipped | skipped | skipped |
| `P1x3` | Kociemba coordinates | 73.6 MB | 9.95 | 6.8e5 / 26.3 ms | 1.7e6 / 124.9 ms | 2.1e8 / 14.9 s | skipped |
| `P1x3i` | Kociemba coordinates | 73.6 MB | 10.10 | 4.2e4 / 3.4 ms | 7.1e5 / 78.7 ms | 9.5e7 / 10.5 s | skipped |
| `C8` | Corners | 44.1 MB | 8.76 | 2.8e7 / 896.3 ms | skipped | – | – |
| `C8s` | Corners | 3.2 MB | 8.76 | 2.8e7 / 868.4 ms | skipped | skipped | skipped |
| `C8s+Ktsx3+Kfsx3+Ktfx3` | Corners | 6.5 MB | 8.85 | 3.7e5 / 20.7 ms | 3.8e7 / 2.1 s | skipped | skipped |
| `C8s+E6x2` | Corners + 6 edges | 24.5 MB | 8.90 | 2.2e5 / 11.8 ms | 3.1e7 / 1.6 s | skipped | skipped |
| `C8s+E6x8` | Corners + 6 edges | 24.5 MB | 8.98 | 1.3e5 / 11.0 ms | 1.8e7 / 1.4 s | skipped | skipped |
| `C8s+E6x24` | Corners + 6 edges | 24.5 MB | 9.06 | 9.3e4 / 15.2 ms | 1.2e7 / 2.0 s | – | – |
| `C8s+E6x24i` | Corners + 6 edges | 24.5 MB | 9.10 | 7.5e4 / 16.4 ms | 9.6e6 / 2.1 s | – | – |
| `C8s+E6x24+Ktsx3+Kfsx3+Ktfx3` | Corners + 6 edges | 27.8 MB | 9.06 | 8.7e4 / 15.4 ms | 1.2e7 / 2.1 s | – | – |
| `C8s@2+E6x8@2` | Phone, 2-bit tables | 12.3 MB | 8.98 | 1.3e5 / 12.3 ms | 1.8e7 / 1.6 s | est. 2.8e9 / 4.1 min | est. 8.6e11 / 21.1 h (18 of 20) |
| `C8s@2+E6x24@2` | Phone, 2-bit tables | 12.3 MB | 9.06 | 9.3e4 / 17.6 ms | 1.2e7 / 2.2 s | skipped | skipped |
| `C8s@2+E6x24@2+Ktsx3@2+Kfsx3@2+Ktfx3@2` | Phone, 2-bit tables | 14.0 MB | 9.06 | 8.7e4 / 18.3 ms | 1.2e7 / 2.4 s | skipped | skipped |
| `C8s@2+E6x24@2+Ktsx3i+Kfsx3i+Ktfx3i` | Phone, 2-bit tables | 15.6 MB | 9.06 | 8.1e4 / 19.9 ms | 1.2e7 / 2.9 s | skipped | skipped |
| `C8s+E7x2` | Corners + 7 edges | 259 MB | 9.15 | 7.8e4 / 5.6 ms | 9.5e6 / 626.6 ms | skipped | skipped |
| `C8s+E7x8` | Corners + 7 edges | 259 MB | 9.29 | 4.3e4 / 5.1 ms | 4.9e6 / 591.8 ms | skipped | skipped |
| `C8s+E7x8i` | Corners + 7 edges | 259 MB | 9.38 | 3.3e4 / 5.1 ms | 3.8e6 / 563.3 ms | skipped | skipped |
| `C8s@2+P1x3@2` | Desktop | 40.0 MB | 9.97 | 1.4e5 / 6.6 ms | 1.2e6 / 89.1 ms | 1.6e8 / 12.7 s | skipped |
| `C8s+P1x3i` | Desktop | 76.8 MB | 10.11 | 1.3e4 / 1.3 ms | 6.2e5 / 71.7 ms | 8.7e7 / 9.6 s | 6.3e9 / 11.5 min (18 of 20; 2 capped) |
| `C8s+E6x8+P1x3i` | Desktop | 98.1 MB | 10.11 | 7.5e3 / 1.8 ms | 6.2e5 / 132.0 ms | 8.7e7 / 18.5 s | skipped |
| `C8s+E7x2+P1x3` | Desktop | 332 MB | 9.97 | 1.8e4 / 1.7 ms | 1.1e6 / 112.9 ms | 1.6e8 / 17.0 s | skipped |
| `C8s+E7x2i+P1x3i` | Desktop | 332 MB | 10.11 | 7.0e3 / 1.3 ms | 6.1e5 / 103.0 ms | 8.7e7 / 15.1 s | skipped |
| `C8s+E7x8i+P1x3i` | Desktop | 332 MB | 10.11 | 6.8e3 / 2.1 ms | 6.0e5 / 181.5 ms | 8.5e7 / 25.0 s | skipped |
| `C8s+E6x24i+E7x8i+P1x3i` | Desktop | 354 MB | 10.11 | 6.7e3 / 3.7 ms | 6.0e5 / 384.3 ms | 8.5e7 / 55.0 s | skipped |
| `C8s@2+E7x24@2+P1x3@2` | Desktop | 168 MB | 9.99 | 1.3e4 / 5.2 ms | 1.0e6 / 421.3 ms | 1.4e8 / 60.3 s | skipped |

### 12 random moves

| Floor set | Memory | Solved | Mean root floor | Mean nodes | Max nodes | Mean time | Max time | Nodes/s | Optimal lengths |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --- |
| `Kts+Kfs+Ktf` | 3.3 MB | 50/50 | 6.98 | 5.0e7 | 2.1e9 | 1.6 s | 64.0 s | 31.5M | 10: 1, 11: 1, 12: 48 |
| `Ktsx3+Kfsx3+Ktfx3` | 3.3 MB | 50/50 | 7.40 | 2.2e6 | 3.8e7 | 120.0 ms | 1.7 s | 18.3M | 10: 1, 11: 1, 12: 48 |
| `P1` | 73.6 MB | 50/50 | 8.26 | 4.3e7 | 2.1e9 | 1.3 s | 60.2 s | 33.9M | 10: 1, 11: 1, 12: 48 |
| `P1x3` | 73.6 MB | 50/50 | 9.24 | 6.8e5 | 3.2e7 | 26.3 ms | 1.2 s | 25.9M | 10: 1, 11: 1, 12: 48 |
| `P1x3i` | 73.6 MB | 50/50 | 9.56 | 4.2e4 | 1.7e6 | 3.4 ms | 119.0 ms | 12.6M | 10: 1, 11: 1, 12: 48 |
| `C8` | 44.1 MB | 50/50 | 8.48 | 2.8e7 | 2.6e8 | 896.3 ms | 8.4 s | 31.3M | 10: 1, 11: 1, 12: 48 |
| `C8s` | 3.2 MB | 50/50 | 8.48 | 2.8e7 | 2.6e8 | 868.4 ms | 8.1 s | 32.3M | 10: 1, 11: 1, 12: 48 |
| `C8s+Ktsx3+Kfsx3+Ktfx3` | 6.5 MB | 50/50 | 8.52 | 3.7e5 | 7.5e6 | 20.7 ms | 306.6 ms | 18.0M | 10: 1, 11: 1, 12: 48 |
| `C8s+E6x2` | 24.5 MB | 50/50 | 8.56 | 2.2e5 | 1.6e6 | 11.8 ms | 78.6 ms | 19.0M | 10: 1, 11: 1, 12: 48 |
| `C8s+E6x8` | 24.5 MB | 50/50 | 8.66 | 1.3e5 | 8.5e5 | 11.0 ms | 78.4 ms | 11.8M | 10: 1, 11: 1, 12: 48 |
| `C8s+E6x24` | 24.5 MB | 50/50 | 8.78 | 9.3e4 | 6.5e5 | 15.2 ms | 123.6 ms | 6.1M | 10: 1, 11: 1, 12: 48 |
| `C8s+E6x24i` | 24.5 MB | 50/50 | 8.88 | 7.5e4 | 5.6e5 | 16.4 ms | 123.4 ms | 4.6M | 10: 1, 11: 1, 12: 48 |
| `C8s+E6x24+Ktsx3+Kfsx3+Ktfx3` | 27.8 MB | 50/50 | 8.78 | 8.7e4 | 6.0e5 | 15.4 ms | 121.5 ms | 5.6M | 10: 1, 11: 1, 12: 48 |
| `C8s@2+E6x8@2` | 12.3 MB | 50/50 | 8.66 | 1.3e5 | 8.5e5 | 12.3 ms | 83.1 ms | 10.6M | 10: 1, 11: 1, 12: 48 |
| `C8s@2+E6x24@2` | 12.3 MB | 50/50 | 8.78 | 9.3e4 | 6.5e5 | 17.6 ms | 130.6 ms | 5.3M | 10: 1, 11: 1, 12: 48 |
| `C8s@2+E6x24@2+Ktsx3@2+Kfsx3@2+Ktfx3@2` | 14.0 MB | 50/50 | 8.78 | 8.7e4 | 6.0e5 | 18.3 ms | 127.0 ms | 4.7M | 10: 1, 11: 1, 12: 48 |
| `C8s@2+E6x24@2+Ktsx3i+Kfsx3i+Ktfx3i` | 15.6 MB | 50/50 | 8.82 | 8.1e4 | 4.7e5 | 19.9 ms | 123.6 ms | 4.1M | 10: 1, 11: 1, 12: 48 |
| `C8s+E7x2` | 259 MB | 50/50 | 8.90 | 7.8e4 | 6.1e5 | 5.6 ms | 40.0 ms | 13.9M | 10: 1, 11: 1, 12: 48 |
| `C8s+E7x8` | 259 MB | 50/50 | 9.00 | 4.3e4 | 3.3e5 | 5.1 ms | 42.9 ms | 8.4M | 10: 1, 11: 1, 12: 48 |
| `C8s+E7x8i` | 259 MB | 50/50 | 9.10 | 3.3e4 | 2.6e5 | 5.1 ms | 52.7 ms | 6.5M | 10: 1, 11: 1, 12: 48 |
| `C8s@2+P1x3@2` | 40.0 MB | 50/50 | 9.36 | 1.4e5 | 6.1e6 | 6.6 ms | 261.5 ms | 20.8M | 10: 1, 11: 1, 12: 48 |
| `C8s+P1x3i` | 76.8 MB | 50/50 | 9.64 | 1.3e4 | 3.6e5 | 1.3 ms | 27.1 ms | 10.2M | 10: 1, 11: 1, 12: 48 |
| `C8s+E6x8+P1x3i` | 98.1 MB | 50/50 | 9.64 | 7.5e3 | 8.3e4 | 1.8 ms | 24.5 ms | 4.2M | 10: 1, 11: 1, 12: 48 |
| `C8s+E7x2+P1x3` | 332 MB | 50/50 | 9.40 | 1.8e4 | 3.5e5 | 1.7 ms | 26.5 ms | 10.2M | 10: 1, 11: 1, 12: 48 |
| `C8s+E7x2i+P1x3i` | 332 MB | 50/50 | 9.64 | 7.0e3 | 6.8e4 | 1.3 ms | 11.0 ms | 5.3M | 10: 1, 11: 1, 12: 48 |
| `C8s+E7x8i+P1x3i` | 332 MB | 50/50 | 9.64 | 6.8e3 | 6.4e4 | 2.1 ms | 19.0 ms | 3.3M | 10: 1, 11: 1, 12: 48 |
| `C8s+E6x24i+E7x8i+P1x3i` | 354 MB | 50/50 | 9.64 | 6.7e3 | 6.1e4 | 3.7 ms | 35.1 ms | 1.8M | 10: 1, 11: 1, 12: 48 |
| `C8s@2+E7x24@2+P1x3@2` | 168 MB | 50/50 | 9.44 | 1.3e4 | 1.8e5 | 5.2 ms | 62.3 ms | 2.5M | 10: 1, 11: 1, 12: 48 |

### 14 random moves

| Floor set | Memory | Solved | Mean root floor | Mean nodes | Max nodes | Mean time | Max time | Nodes/s | Optimal lengths |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --- |
| `Ktsx3+Kfsx3+Ktfx3` | 3.3 MB | 50/50 | 7.74 | 2.4e8 | 8.1e8 | 14.0 s | 47.7 s | 16.8M | 11: 1, 13: 1, 14: 48 |
| `P1x3` | 73.6 MB | 50/50 | 9.72 | 1.7e6 | 2.0e7 | 124.9 ms | 1.3 s | 13.7M | 11: 1, 13: 1, 14: 48 |
| `P1x3i` | 73.6 MB | 50/50 | 9.90 | 7.1e5 | 5.6e6 | 78.7 ms | 567.6 ms | 9.1M | 11: 1, 13: 1, 14: 48 |
| `C8s+Ktsx3+Kfsx3+Ktfx3` | 6.5 MB | 50/50 | 8.80 | 3.8e7 | 1.4e8 | 2.1 s | 8.1 s | 18.4M | 11: 1, 13: 1, 14: 48 |
| `C8s+E6x2` | 24.5 MB | 50/50 | 8.86 | 3.1e7 | 9.5e7 | 1.6 s | 5.5 s | 19.7M | 11: 1, 13: 1, 14: 48 |
| `C8s+E6x8` | 24.5 MB | 50/50 | 8.90 | 1.8e7 | 4.4e7 | 1.4 s | 4.5 s | 12.4M | 11: 1, 13: 1, 14: 48 |
| `C8s+E6x24` | 24.5 MB | 50/50 | 8.92 | 1.2e7 | 3.4e7 | 2.0 s | 5.7 s | 6.1M | 11: 1, 13: 1, 14: 48 |
| `C8s+E6x24i` | 24.5 MB | 50/50 | 9.00 | 9.6e6 | 2.9e7 | 2.1 s | 5.6 s | 4.7M | 11: 1, 13: 1, 14: 48 |
| `C8s+E6x24+Ktsx3+Kfsx3+Ktfx3` | 27.8 MB | 50/50 | 8.92 | 1.2e7 | 3.1e7 | 2.1 s | 5.9 s | 5.8M | 11: 1, 13: 1, 14: 48 |
| `C8s@2+E6x8@2` | 12.3 MB | 50/50 | 8.90 | 1.8e7 | 4.4e7 | 1.6 s | 4.9 s | 11.2M | 11: 1, 13: 1, 14: 48 |
| `C8s@2+E6x24@2` | 12.3 MB | 50/50 | 8.92 | 1.2e7 | 3.4e7 | 2.2 s | 6.6 s | 5.5M | 11: 1, 13: 1, 14: 48 |
| `C8s@2+E6x24@2+Ktsx3@2+Kfsx3@2+Ktfx3@2` | 14.0 MB | 50/50 | 8.92 | 1.2e7 | 3.1e7 | 2.4 s | 6.8 s | 5.0M | 11: 1, 13: 1, 14: 48 |
| `C8s@2+E6x24@2+Ktsx3i+Kfsx3i+Ktfx3i` | 15.6 MB | 50/50 | 8.92 | 1.2e7 | 2.9e7 | 2.9 s | 7.7 s | 4.2M | 11: 1, 13: 1, 14: 48 |
| `C8s+E7x2` | 259 MB | 50/50 | 9.10 | 9.5e6 | 2.7e7 | 626.6 ms | 1.7 s | 15.2M | 11: 1, 13: 1, 14: 48 |
| `C8s+E7x8` | 259 MB | 50/50 | 9.20 | 4.9e6 | 1.7e7 | 591.8 ms | 1.8 s | 8.2M | 11: 1, 13: 1, 14: 48 |
| `C8s+E7x8i` | 259 MB | 50/50 | 9.28 | 3.8e6 | 1.4e7 | 563.3 ms | 1.8 s | 6.7M | 11: 1, 13: 1, 14: 48 |
| `C8s@2+P1x3@2` | 40.0 MB | 50/50 | 9.82 | 1.2e6 | 6.9e6 | 89.1 ms | 505.3 ms | 12.9M | 11: 1, 13: 1, 14: 48 |
| `C8s+P1x3i` | 76.8 MB | 50/50 | 9.94 | 6.2e5 | 3.5e6 | 71.7 ms | 339.2 ms | 8.6M | 11: 1, 13: 1, 14: 48 |
| `C8s+E6x8+P1x3i` | 98.1 MB | 50/50 | 9.94 | 6.2e5 | 3.5e6 | 132.0 ms | 530.1 ms | 4.7M | 11: 1, 13: 1, 14: 48 |
| `C8s+E7x2+P1x3` | 332 MB | 50/50 | 9.82 | 1.1e6 | 6.4e6 | 112.9 ms | 532.6 ms | 9.8M | 11: 1, 13: 1, 14: 48 |
| `C8s+E7x2i+P1x3i` | 332 MB | 50/50 | 9.94 | 6.1e5 | 3.5e6 | 103.0 ms | 480.8 ms | 5.9M | 11: 1, 13: 1, 14: 48 |
| `C8s+E7x8i+P1x3i` | 332 MB | 50/50 | 9.94 | 6.0e5 | 3.5e6 | 181.5 ms | 708.6 ms | 3.3M | 11: 1, 13: 1, 14: 48 |
| `C8s+E6x24i+E7x8i+P1x3i` | 354 MB | 50/50 | 9.94 | 6.0e5 | 3.5e6 | 384.3 ms | 1.7 s | 1.6M | 11: 1, 13: 1, 14: 48 |
| `C8s@2+E7x24@2+P1x3@2` | 168 MB | 50/50 | 9.82 | 1.0e6 | 5.8e6 | 421.3 ms | 1.8 s | 2.4M | 11: 1, 13: 1, 14: 48 |

### 16 random moves

| Floor set | Memory | Solved | Mean root floor | Mean nodes | Max nodes | Mean time | Max time | Nodes/s | Optimal lengths |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --- |
| `P1x3` | 73.6 MB | 50/50 | 9.80 | 2.1e8 | 5.3e8 | 14.9 s | 36.1 s | 14.2M | 14: 1, 15: 2, 16: 47 |
| `P1x3i` | 73.6 MB | 50/50 | 9.90 | 9.5e7 | 2.5e8 | 10.5 s | 26.1 s | 9.1M | 14: 1, 15: 2, 16: 47 |
| `C8s@2+E6x8@2` (capped at 6.0e8 nodes; finished solves only) | 12.3 MB | 7/50 | 8.92 | 3.5e8 | 5.6e8 | 30.7 s | 48.1 s | 11.3M | 14: 1, 15: 2, 16: 4 |
| `C8s@2+P1x3@2` | 40.0 MB | 50/50 | 9.84 | 1.6e8 | 3.9e8 | 12.7 s | 28.7 s | 12.9M | 14: 1, 15: 2, 16: 47 |
| `C8s+P1x3i` | 76.8 MB | 50/50 | 9.94 | 8.7e7 | 2.2e8 | 9.6 s | 22.7 s | 9.1M | 14: 1, 15: 2, 16: 47 |
| `C8s+E6x8+P1x3i` | 98.1 MB | 50/50 | 9.94 | 8.7e7 | 2.2e8 | 18.5 s | 42.9 s | 4.7M | 14: 1, 15: 2, 16: 47 |
| `C8s+E7x2+P1x3` | 332 MB | 50/50 | 9.84 | 1.6e8 | 3.8e8 | 17.0 s | 38.1 s | 9.3M | 14: 1, 15: 2, 16: 47 |
| `C8s+E7x2i+P1x3i` | 332 MB | 50/50 | 9.94 | 8.7e7 | 2.2e8 | 15.1 s | 34.9 s | 5.7M | 14: 1, 15: 2, 16: 47 |
| `C8s+E7x8i+P1x3i` | 332 MB | 50/50 | 9.94 | 8.5e7 | 2.1e8 | 25.0 s | 57.6 s | 3.4M | 14: 1, 15: 2, 16: 47 |
| `C8s+E6x24i+E7x8i+P1x3i` | 354 MB | 50/50 | 9.94 | 8.5e7 | 2.1e8 | 55.0 s | 2.1 min | 1.6M | 14: 1, 15: 2, 16: 47 |
| `C8s@2+E7x24@2+P1x3@2` | 168 MB | 50/50 | 9.84 | 1.4e8 | 3.5e8 | 60.3 s | 2.3 min | 2.4M | 14: 1, 15: 2, 16: 47 |

### Random state (cubing.js)

| Floor set | Memory | Solved | Mean root floor | Mean nodes | Max nodes | Mean time | Max time | Nodes/s | Optimal lengths |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --- |
| `C8s@2+E6x8@2` (capped at 7.5e8 nodes; finished solves only) | 12.3 MB | 0/20 | 8.90 | – | – | – | – | 0.0M |  |
| `C8s+P1x3i` (capped at 3.0e10 nodes; finished solves only) | 76.8 MB | 18/20 | 10.25 | 6.3e9 | 1.5e10 | 11.5 min | 27.9 min | 9.1M | 17: 2, 18: 16 |

### Capped runs, estimated

Every solve stops at a node cap. Phone sets would need hours per deep position, so on the 16-move and random-state sets they are capped low (600 and 750 million nodes); the desktop set's random-state cap is 30 billion. A capped solve still finishes some depth bounds. Its total is estimated by growing the last finished bound by the ratio of the last two, up to the scramble's optimal length (known from an uncapped run). The final bound is added at the fraction the uncapped run needed before its first solution (`estimate_solve` in `report.py`). Treat these as rough, within a factor of two.

- `C8s@2+E6x8@2`, 16 random moves: 7 of 50 solved within the cap of 6.0e8 nodes. With the capped ones estimated: mean 2.8e9 nodes, max 6.2e9; about 4.1 min per solve (max 9.1 min) on one thread at its measured 11.3M nodes/s.
- `C8s+P1x3i`, Random state (cubing.js): 18 of 20 solved within the cap of 3.0e10 nodes. Positions no run solved have no known length, so they cannot be estimated or averaged: #14 (proved to need at least 19 moves before the cap, after 3.0e10 nodes, 56.1 min); #18 (proved to need at least 19 moves before the cap, after 3.0e10 nodes, 58.3 min).
- `C8s@2+E6x8@2`, Random state (cubing.js): 0 of 20 solved within the cap of 7.5e8 nodes. With the capped ones estimated (18 of 20): mean 8.6e11 nodes, max 1.1e12; about 21.1 h per solve (max 27.2 h) on one thread at its measured 11.3M nodes/s. Positions no run solved have no known length, so they cannot be estimated or averaged: #14 (proved to need at least 16 moves before the cap, after 7.5e8 nodes, 66.4 s); #18 (proved to need at least 16 moves before the cap, after 7.5e8 nodes, 63.8 s).

### Random-state positions, one by one

Nodes / time on one thread. *est.* marks a capped solve, estimated as described under *Capped runs*.

| # | Optimal | `C8s+P1x3i` | `C8s@2+E6x8@2` |
| --- | --: | --: | --: |
| 0 | 18 | 2.1e9 / 3.8 min | est. 9.7e11 / 23.2 h |
| 1 | 18 | 1.5e10 / 27.0 min | est. 9.7e11 / 23.0 h |
| 2 | 18 | 4.4e9 / 8.0 min | est. 9.9e11 / 24.7 h |
| 3 | 18 | 1.5e10 / 27.9 min | est. 9.0e11 / 22.0 h |
| 4 | 17 | 1.9e9 / 3.5 min | est. 7.9e10 / 2.0 h |
| 5 | 18 | 3.9e9 / 7.1 min | est. 9.8e11 / 23.8 h |
| 6 | 18 | 4.2e9 / 7.8 min | est. 9.7e11 / 23.6 h |
| 7 | 17 | 3.0e8 / 33.2 s | est. 7.6e10 / 112.5 min |
| 8 | 18 | 5.6e9 / 10.3 min | est. 8.8e11 / 22.4 h |
| 9 | 18 | 6.6e9 / 12.1 min | est. 1.0e12 / 24.9 h |
| 10 | 18 | 2.7e9 / 4.9 min | est. 1.1e12 / 26.5 h |
| 11 | 18 | 2.8e9 / 5.0 min | est. 9.9e11 / 23.9 h |
| 12 | 18 | 4.2e9 / 7.9 min | est. 9.3e11 / 22.9 h |
| 13 | 18 | 6.7e9 / 12.4 min | est. 9.1e11 / 22.8 h |
| 14 | ≥ 19 | ≥ 19 proved, capped at 3.0e10 / 56.1 min | ≥ 16 proved, capped at 7.5e8 / 66.4 s |
| 15 | 18 | 1.0e10 / 19.1 min | est. 8.8e11 / 22.1 h |
| 16 | 18 | 8.7e9 / 15.8 min | est. 8.8e11 / 21.7 h |
| 17 | 18 | 5.5e9 / 10.1 min | est. 9.3e11 / 23.0 h |
| 18 | ≥ 19 | ≥ 19 proved, capped at 3.0e10 / 58.3 min | ≥ 16 proved, capped at 7.5e8 / 63.8 s |
| 19 | 18 | 1.3e10 / 23.6 min | est. 1.0e12 / 24.3 h |

### How deep a floor set can prove, by time

Median time on one thread, over the random-state positions, to finish depth bound *b*: after that the search has proved that no solution shorter than *b* + 1 exists. This is the number for a search view that runs until a time limit. A dash means fewer than half the positions finished that bound.

| Floor set | b = 13 | b = 14 | b = 15 | b = 16 | b = 17 | b = 18 |
| --- | --: | --: | --: | --: | --: | --: |
| `C8s+P1x3i` | 5.7 ms | 78.8 ms | 1.1 s | 14.9 s | 3.4 min | – |
| `C8s@2+E6x8@2` | 190.0 ms | 2.6 s | 34.5 s | – | – | – |

### Superflip

One solve on all four threads (the subtrees at depth 3 are shared out), so time is wall-clock on four cores. The first move is limited to one per orbit of superflip's 48 symmetries. The capped phone run is estimated like the capped benchmark runs: its last finished depth bound grown by the ratio of the last two up to 19, plus bound 20 at the fraction the desktop run needed before its first solution (`superflip_estimate` in `lab.py`).

| Floor set | Memory | Length | Root floor | Root symmetries | Nodes | Time | Solution | Estimated to finish (nodes / time) |
| --- | --: | --: | --: | --: | --: | --: | --- | --: |
| `C8s+P1x3i` | 76.8 MB | 20 | 10 | 48 | 5.1e10 | 24.9 min | U R U2 R F2 L U2 R F' B' R2 D R' L U2 F2 D2 F R2 D | – |
| `C8s@2+E6x8@2` | 12.3 MB | capped | 8 | 48 | 1.5e10 | 7.9 min | – | 3.2e12 / 27.4 h |

Nodes per depth bound:

- `C8s+P1x3i`: 10: 2, 11: 140, 12: 1.1e3, 13: 1.3e4, 14: 1.6e5, 15: 2.0e6, 16: 2.4e7, 17: 3.0e8, 18: 3.7e9, 19: 4.7e10, 20: 1.3e8
- `C8s@2+E6x8@2`: 8: 2, 9: 56, 10: 374, 11: 2.8e3, 12: 3.4e4, 13: 4.6e5, 14: 6.3e6, 15: 8.6e7, 16: 1.2e9, 17: 1.4e10

<!-- tables:end -->
