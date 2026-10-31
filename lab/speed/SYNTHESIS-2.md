# Speed lab, round 2: what we found

Three tasks on the 3×3, stitched together: the ceiling race (T6, `ceiling/`), downhill masks (T3, `gravity/`) and browser speed (T5, `browser/`). Each folder's FINDINGS.md has the full tables and checks. Every task was rerun in part in the main session before it was merged; see "Checked before merging" below. Round 1 is in [SYNTHESIS.md](SYNTHESIS.md).

## In one paragraph

Round 1 found two kinds of waste in an optimal 3×3 solve:
- most of the work goes into the final round, hunting for the one shortest solution
- most floor reads go to children that are thrown away at once

Round 2 removed most of both:
- **The ceiling race.** A two-phase solver on a second thread usually finds the optimal solution before the prover's proof rounds end, so the prover only has to prove. At 16 moves this is 2.0× faster than splitting the prover over two threads.
- **Downhill masks.** 331 MB of them skip three quarters of the children without changing the search, which makes every round about 1.5× faster.
- **The browser.** The solver also runs there, at 0.55× native speed per core, and 4 workers are 3.4× faster than one.

Together, a random state on two native threads should take about 3.7 minutes on average, against 13.6 on one thread. That is an estimate from measured parts; the race and the masks have not yet been run together. What remains is the proof, clearing every bound below the optimum, and only more cores or stronger floors make that faster.

## The levers, measured

| Lever | What it removes | Measured | Cost | Status |
|---|---|---|---|---|
| **Ceiling race** (T6) | most of the final round | **16 moves: 2.0× faster than the two-thread split, 4.2× faster than one thread.** 14 moves: a tie (the whole solve takes 0.1 s). Random states: mean 814 s → 315 s with one prover thread plus the ceiling thread (2.6×, three traces capped). The real race on three random states agreed with the simulation within 4% | one thread, plus 2 × 0.97 MB of phase-2 tables | Verified. Ready for the app's engine |
| **Downhill masks** (T3) | reads of children cut on arrival, in every round | **1.42–1.46× with 18-bit masks** (1.48–1.51× uint32, 1.63–1.68× full masks), with the identical search | 331 MB packed (408 MB with the floor), built in about 12 s | Verified. Desktop only |
| **Browser** (T5) | – | **wasm at 0.55× native per core**, identical node counts. 4 workers 3.36× at 16 moves. Tables built in the browser in 11 s (phone) and 24 s (desktop), restarted from IndexedDB in 0.1 s and 0.5 s | 93 MB per desktop worker (private copies) | Verified harness. No race or masks in it yet |

## What they add up to on random states (estimate)

From T6's per-position traces, on T6's machine (7.71 M nodes/s per thread), with T3's 1.46× applied to the prover. The two have not been run together yet.

| Setup | Mean | Median | Worst |
|---|--:|--:|--:|
| One thread (today's `lab/3x3`) | 814 s | 643 s | 1,979 s |
| Two-thread split (ideal halving) | 407 s | 322 s | 990 s |
| **Race, two threads** (T6) | 315 s | 240 s | 1,340 s |
| **Race + masks, two threads** | **220 s** | **165 s** | 917 s |
| Proof rounds only, one thread with masks (the most a race can save) | 151 s | 156 s | 230 s |

Projected further, after the merge, from the same traces. These figures assume:
- split efficiency 0.85
- the ceiling thread joins the final round when it misses
- laptop cores 1.75× this machine's
- masks give the same 1.46× in wasm (not measured)

| Projected setup | Mean | Median | Worst |
|---|--:|--:|--:|
| Native, 4 threads: 3 provers + ceiling, masks | 96 s | 65 s | 285 s |
| Native, fast 8-core laptop | 33 s | 18 s | 127 s |
| Laptop browser, 8 workers, masks | 59 s | 33 s | 232 s |
| Laptop browser, 8 workers, no masks | 76 s | 43 s | 259 s |

Round 3 (T7, T8) measures the first and builds toward the third.

- **The race has a tail.** When the ceiling misses the optimum (3 of 18 random states within 250 s), the race is just one prover thread, slower than the split.
  - Position 15 is the worst case above.
  - The fix T6 suggested but did not try: once the proof ends, let the ceiling thread join the prover's final round.
- **The ceiling is fast at 18 moves, slow at 17.** It reached 18 moves in 0.1–250 s (median about 18 s, as T6 counts it), and 17 moves only once in two tries.
- **In a browser:**
  - T5 estimated a median of about 5 minutes per random state with 4 workers, without the race. That comes from `lab/3x3`'s node counts at its measured 4-worker rate; it measured two random states end to end, 116 s and 19 s.
  - It estimated 1.7 minutes if the final round were skipped, and 20–40 s with the race on a fast 8-core laptop.
  - Masks there are not measured yet. 331 MB per worker is too much without shared memory.

## Checked before merging (main session, a 2-core machine)

- **T6 ceiling race** (#32).
  - **Build and self-test:** rebuilt, and the self-test passed (phase-2 tables, every trace solution replayed).
  - **Real race:** on all 50 fourteen-move positions and the first 12 sixteen-move ones, in all three modes. At 16 moves the race was 1.9× faster than the split and 4.0× faster than one thread (the task measured 2.25× and 4.5× on the same 12, and 2.0× and 4.2× on all 50). At 14 moves it tied. Every length equals `lab/3x3`'s, and the single-thread node counts equal the task's.
  - **Ceiling traces:** four random states reached the optimum at 0.07, 0.9, 1.7 and 68 s (task: 0.06, 0.8, 1.5 and 53 s).
  - **Results:** `analyse.py` regenerates the committed results byte for byte.
  - **Code review:** the prover publishes its bound at each round start, and the ceiling stops it only when the ceiling is at or below that proven bound, with sequentially consistent atomics on both sides. So a race can't return a non-optimal answer.
  - **Fixed:** FINDINGS quoted 7.97 M nodes/s; its numbers use 7.71 M.
- **T3 downhill masks** (#33).
  - **Masks:** rebuilt; no move changed a table value by more than 1; 331 MB packed.
  - **Mapping check:** 21.6 M child lookups, 0 errors. The deliberately backwards map gives 86,000 errors, so the check works.
  - **Timing,** on the 14-move set and the first 12 of the 16-move set: packed masks 1.45× and 1.58×, uint32 1.81× and 1.59×, full masks 2.05× and 1.77×.
  - **Same search:** the same solutions, and generated + skipped equals the baseline's children in every one of 249 rounds at 14 moves, and in every round at 16.
  - **Fixed:** FINDINGS' results section was empty, because `analyse.py`'s regex could not fill the empty placeholder. The tables are now written from the task's own data.
- **T5 browser** (#31).
  - **Build:** `core.wasm` rebuilds byte for byte from `src/core.c`. Its search functions (`dfs`, lookups, coordinates, moves) are character for character `lab/3x3`'s.
  - **Port check:** in Node, 50 of 50 identical node counts per bound.
  - **Headless Chromium,** on the same 2-core machine:
    - Tables were built in 12 s (phone) and 28 s (desktop), and reloaded from IndexedDB in 0.13 s and 0.46 s.
    - Single-worker node counts equal native's on every scramble: 50 phone-set at 12 moves, 50 desktop-set at 14, and the first 10 desktop-set at 16.
    - At 16 moves wasm ran at 0.53× native speed (the task measured 0.55×), and two workers were 1.94× faster than one (task: 1.86×).
    - All 170 solutions were replayed with cubing.js, with 0 failures.
  - **Results:** `summarize.py` regenerates the committed results exactly.
  - **CI:** its first CI run failed only at the flaky Lighthouse step, and the rerun passed.

## What is left

1. **One native solver with the race and the masks,** measured on random states with 4 threads (3 provers + 1 ceiling) against a 4-thread split.
   - Also add the tail fix: the ceiling thread joins the final round once the proof ends.
2. **The race in the browser.**
   - The two-phase solver as a `ceiling` worker; T5 reserved the role.
   - A way to stop the other workers: restart them from IndexedDB, or a shared flag with cross-origin isolation.
3. **Masks in the browser** need one shared copy (SharedArrayBuffer and the coi-serviceworker shim), or a single prover worker. Measure whether they pay in wasm.
4. **The app's 3×3 Solver:** a proven-optimal solution for any scramble on a desktop, with the rounds shown as they are proven.
5. **Numbers from a real laptop and a phone.** All of the above is cloud machines.
