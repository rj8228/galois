# T5 Browser speed: findings

## Verdict

- **The solver runs in the browser at about 0.55× native speed per core.** `lab/3x3`'s C core compiles to a 48 KB WebAssembly module with clang 18 and no C library. On one worker it takes 1.7–1.8× as long as native C on the same machine. It visits exactly the same nodes: 210 of 210 solves have identical node counts per bound, on both floor sets.
- **Building the tables in the browser is cheap.** The phone set builds in 11 s and the desktop set in 24 s, on one worker. After that, a start from the IndexedDB cache takes 0.1 s (phone) or 0.5 s (desktop). This confirms `lab/3x3/FINDINGS.md`'s advice to build tables rather than download them.
- **Workers scale where the work is big.** On the 16-move set with the desktop floors, 2 workers give 1.86× and 4 workers give 3.36×. 8 workers on this 4-core machine give no more (3.07×). Solves under about 100 ms don't gain, because handing out subtrees costs a message round trip each. So the app should split only the later rounds.
- **Copying the tables per worker works, but memory adds up.** Each desktop worker holds 93 MB of wasm memory, so 4 workers use 370 MB. Chromium's whole footprint (PSS) was 982 MB, because the bytes read from IndexedDB stay in each worker's JavaScript heap until garbage collection runs. Shared memory (SharedArrayBuffer) was not tried; see the last section.
- **A random state on this machine:** 4 workers on the desktop set do 18 M nodes/s. From `lab/3x3`'s per-scramble node counts, that means a median of about **5 minutes** and a mean of **over 8 minutes** per random state. If T6's ceiling race lets the prover skip the final round, the median drops to about **1.7 minutes**. Two random states were measured end to end, at 116 s and 19 s.
- **Phone:** on the phone set, a phone proves any 14-move scramble within a few seconds. In one minute it proves that no solution of 15 moves or fewer exists, for any position. It cannot prove a typical 16–18-move optimum within a minute.

Everything here was measured in headless Chromium 153 under Playwright, on a 4-core Intel Xeon at 2.1 GHz. That is the same kind of machine as `lab/3x3`'s numbers, not a laptop. Native C means `lab/3x3/src/cube3.c` built with gcc `-O3 -march=native` and run with one thread (`OMP_NUM_THREADS=1`), one solve at a time.

## One worker against native

| Floor set | Scrambles | Native, 1 thread | wasm, 1 worker | wasm / native | M nodes/s native → wasm | Same nodes |
|---|---|--:|--:|--:|--:|--:|
| phone `C8s@2+E6x8@2` | moves-12 (50) | 13.5 ms | 23.1 ms | 1.71× | 9.6 → 5.6 | 50/50 |
| phone `C8s@2+E6x8@2` | moves-14 (50) | 1.7 s | 3.0 s | 1.79× | 10.7 → 6.0 | 50/50 |
| desktop `C8s+P1x3i` | moves-12 (50) | 1.4 ms | 3.4 ms | 2.43× | 9.6 → 4.0 | 50/50 |
| desktop `C8s+P1x3i` | moves-14 (50) | 73.7 ms | 135.0 ms | 1.83× | 8.4 → 4.6 | 50/50 |
| desktop `C8s+P1x3i` | moves-16, first 10 | 8.4 s | 14.6 s | 1.74× | 8.1 → 4.7 | 10/10 |

Times are means over the solves, measured from the page: they include the round trip to the worker. That fixed cost is why the 1.4 ms solves come out at 2.4×. "Same nodes" means the total node count and the length both equal native's, for every scramble. The phone set's 16-move solves (43 of 50 run past 3 billion nodes natively) and its random states were not run in the browser.

## Workers

Each worker is a separate wasm instance with its own copy of the tables. From the third round on, every worker collects the same list of subtrees at depth 2 (as `CUBE3_SPLIT=2` does). The page hands out their indices one at a time to whichever worker is free. The first two rounds run on one worker.

| Floor set | Scrambles | Workers | Mean time to answer | Speed-up | Mean nodes | wasm memory | Chromium PSS |
|---|---|--:|--:|--:|--:|--:|--:|
| phone | moves-12 | 1 | 23.1 ms | 1.00× | 129,910 | 34 MB | 239 MB |
| phone | moves-12 | 4 | 24.3 ms | 0.95× | 135,962 | 134 MB | 363 MB |
| phone | moves-14 | 1 | 3.0 s | 1.00× | 17,903,127 | 34 MB | 239 MB |
| phone | moves-14 | 4 | 902.7 ms | 3.31× | 18,112,477 | 134 MB | 364 MB |
| desktop | moves-14 | 1 | 135.0 ms | 1.00× | 616,532 | 89 MB | 393 MB |
| desktop | moves-14 | 2 | 113.0 ms | 1.19× | 619,776 | 185 MB | 590 MB |
| desktop | moves-14 | 4 | 73.9 ms | 1.83× | 628,452 | 370 MB | 982 MB |
| desktop | moves-16, first 10 | 1 | 14.6 s | 1.00× | 68,185,769 | 89 MB | 393 MB |
| desktop | moves-16, first 10 | 2 | 7.9 s | 1.86× | 68,894,241 | 185 MB | 589 MB |
| desktop | moves-16, first 10 | 4 | 4.3 s | 3.36× | 69,758,465 | 370 MB | 982 MB |
| desktop | moves-16, first 10 | 4 (split depth 3) | 4.7 s | 3.10× | 68,341,202 | 370 MB | 982 MB |
| desktop | moves-16, first 10 | 8 (on 4 cores) | 4.8 s | 3.07× | 71,812,996 | 740 MB | 1766 MB |

- **Answer time and idle time.** Without shared memory, a found solution cannot stop subtrees already running on other workers. So the answer time is taken when the first solution reaches the page. For the 18-move random state, the last worker went idle 15 s after the answer (131.6 s against 116.3 s), because one depth-2 subtree of the final round is about 10⁸ nodes. The app needs a way to stop: end the workers and restart them from IndexedDB (0.5 s), check a budget inside the search, or use a shared stop flag where cross-origin isolation is available.
- **Split depth 3** gives 12 times more, smaller tasks. Here it was slower (4.7 s against 4.3 s), because every task costs a message round trip.
- **Memory.** A desktop worker's wasm memory is the 73.5 MB of tables, plus 3.3 MB of index (symmetry classes), 8 MB of stack, 4 MB of task list and 2 MB of move tables. The renderer's PSS grows by about 200 MB per desktop worker. The other 100 MB is the bytes read from IndexedDB, still in the worker's JavaScript heap when PSS was read. Dropping them right after the copy, or never holding them (build in place, or stream into wasm memory), would save that.

## Random states

Only two of `lab/3x3`'s 20 random states were run in the browser, on the desktop set with 4 workers (one 18-move and one 17-move, chosen for time). The rest is estimated from `lab/3x3`'s native per-scramble node counts, which are machine-independent: the split adds about 1–3% nodes. The rate used is the 18 M nodes/s measured on those two.

| Random state (`lab/3x3` index) | Length | Nodes, browser 4 workers | Nodes, native | Time to answer |
|---|--:|--:|--:|--:|
| 0 | 18 | 2,090,445,680 | 2,090,445,452 | 116.3 s |
| 7 | 17 | 328,254,408 | 303,649,101 | 18.9 s |

| Over all 20 random states, desktop set | Nodes | 4 workers here (18 M/s) | 1 worker here (4.7 M/s) |
|---|--:|--:|--:|
| Median, whole solve | 5.6 × 10⁹ | 5.2 min | 20 min |
| Mean, whole solve (two 19-move states counted at their 3 × 10¹⁰ cap) | ≥ 8.7 × 10⁹ | ≥ 8 min | ≥ 31 min |
| Median, without the final round (T6's race) | 1.8 × 10⁹ | 1.7 min | 6.4 min |
| Mean, without the final round (two 19-move states need bounds ≤ 18: about 2.5 × 10¹⁰ each) | 4.1 × 10⁹ | 3.8 min | 14 min |

T6's results are not out yet. The race rows assume a ceiling solver hands the prover a solution of the optimal length early, so the prover only has to clear the rounds below it. That is an upper bound on the gain. The final round is 73% of all nodes on these solves.

## What this means for the app

- **Which floor set for which device.**
  - Desktop and laptop: `C8s+P1x3i`. Build it in a worker on first use (about 25 s on one core, faster on a laptop), cache it in IndexedDB (73.5 MB), and start from the cache in 0.5 s.
  - Phone: `C8s@2+E6x8@2`. It takes 11 s to build, 12 MB to cache and 0.1 s to start.
  - The desktop set needs about 90 MB per worker. With private copies, run `min(cores, memory / 100 MB)` workers. On a phone, 2–4 workers of 34 MB each are fine.
- **A random state on a laptop.** Measured here: 4 workers, about 5 minutes median and over 8 minutes mean. A current laptop core is perhaps 1.5–2× faster than this 2.1 GHz Xeon, and it has 8 or more cores. 8 workers there would plausibly give about **1–2 minutes median**, or **20–40 s** with T6's race. These are estimates, not measurements. The honest claim for now is "optimal for any scramble, typically a few minutes in a laptop browser".
- **What a phone can prove in a minute.** Assume a phone does 4 M nodes/s per worker and about 12 M/s on 4 workers, a little below this machine (an assumption, not measured on a phone). One minute is then about 0.7 × 10⁹ nodes.
  - Every 14-move scramble: the slowest needs 4.4 × 10⁷ nodes.
  - 7 of the 50 sixteen-move scrambles.
  - For any position, that no solution of 15 moves or fewer exists: clearing bound 15 takes about 4 × 10⁸ nodes, from `lab/3x3`'s phone random-state runs. Bound 16 takes about 13× more, so it is out of reach.
- **The split should start late.** Only use workers once a round is big (say, over 10⁷ nodes expected). For short solves, one worker answers as fast.

## How it was checked

- **Port.** `src/core.c` is `lab/3x3/src/cube3.c` with the C library, OpenMP and file input/output replaced. The search code is a straight copy. Before anything else, the wasm build was run in Node (the same V8 engine as Chromium) on the 12-move set: 50 of 50 solves had identical node counts per bound to `lab/3x3/results/bench-moves-12.json`, for both floor sets (`scripts/node-check.mjs`).
- **Same nodes.** In the browser, every one-worker run has the same total node count and length as the native run on the same machine: 210 of 210 (`results/summary.json`, `node_check`).
- **Replay.** Each solution is replayed twice. Inside wasm, the root plus the path must give the solved cube. Then all 452 browser solutions in `results/runs/` (including the multi-worker ones) are replayed with cubing.js: 0 failures (`results/cubing-check.json`).
- **Lengths.** Multi-worker runs find a different solution of the same length. Every length equals native's.

## Not done

- **Shared memory.** SharedArrayBuffer with one table copy, plus the coi-serviceworker shim, was not tried. That needs a threads build of the core (shared wasm memory, atomics, one stack per worker). On memory alone it would hold one 77 MB copy plus about 15 MB per worker: about 135 MB for 4 desktop workers, against 370 MB of wasm memory with copies. It would also give a shared stop flag, which removes the idle tail after a solution is found. Node rate per worker should not change. The search reads the tables and writes nothing shared.
- **Speed tuning of the wasm build.** None was done. Two things to try: the lab's `__builtin_prefetch` does nothing in wasm, and 64-bit index arithmetic could become 32-bit.
- **Phone set on 16 moves and random states in the browser.** Not run. The node counts from `lab/3x3` plus the measured rates answer the questions above.
- **A real laptop or phone.** All numbers are from this cloud machine.
