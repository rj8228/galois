# Speed lab, round 3: what we found

Two tasks, stitched together: the combined native solver (T7, `combined/`) and the web engine (T8, `webengine/`). Each folder's FINDINGS.md has the full tables and checks. Both were rerun in part in the main session before merging; see "Checked before merging" below. Earlier rounds: [SYNTHESIS.md](SYNTHESIS.md) (round 1) and [SYNTHESIS-2.md](SYNTHESIS-2.md) (round 2).

## In one paragraph

Round 2 built the levers separately. Round 3 put them together, natively and in the browser.

**Native: one solver with the ceiling race, the downhill masks and a ceiling thread that helps prove.**
- **All 20 random states,** on 4 threads: mean 177 s, median 72 s, worst 738 s.
- **The 18 states with a known optimum:** mean 115 s and median 70 s, which is 10.6× and 13.8× faster than one thread on the same machine.
- **The two random states `lab/3x3` never finished** are now proven to need 19 moves, in about 12 minutes each.

**Browser: an engine the app can use.**
- **One shared copy of the tables:** 4 workers use 94 MB of wasm memory instead of 370 MB.
- **One stop flag:** every worker is idle within 2 ms of a proven answer.
- **The race as its own worker:** 2.0× faster than 4 provers at 16 moves. On 5 random states, 78.5 s against 132.4 s, on a 4-core cloud machine.
- **Works on a static host:** cross-origin isolation comes from a 30-line service worker.

The proof rounds are now nearly all of the time. The race ended 13 of the 20 random states by its certificate.

## Where this leaves the goal: any 3×3 scramble, proven optimal

| Random 3×3, time to a proven-optimal answer | Mean | Median | Worst | Notes |
|---|--:|--:|--:|---|
| Before the speed lab: native, 1 thread (`lab/3x3`) | 11.5 min | – | 28 min, and 2 of 20 unfinished | lab machine |
| **Native, 4 threads, race + masks + help** (T7, all 20) | **177 s** | **72 s** | **738 s** (a 19-mover) | T7's machine runs one thread at 0.67× T6's |
| **Browser, 4 workers, shared tables + race** (T8, 5 states) | **78.5 s** | – | 123.7 s | 4-core cloud Xeon; no masks yet |

- **In the browser.** Every piece of the app's engine is now built and measured in Chromium: one shared table copy, a ceiling worker, one stop flag, and isolation on a static host.
- **On a laptop (estimate, not measured).** A random state took about 80 s on a 4-core cloud machine. A current 8-core laptop has twice the cores, each perhaps 1.5–2× faster, so roughly 20–40 s. Masks would cut that further once they are measured in wasm.
- **Phones** stay where round 2 left them: short scrambles are proven in seconds, random states take hours.

## Checked before merging (main session, a 2-core machine)

- **T7 combined native solver** (#38).
  - **Copies:** `gravity.inc` is byte for byte T3's. `ceiling.inc` is T6's plus the help hook. `comb.c` is `lab/3x3`'s solver plus three includes and its commands.
  - **Code review:**
    - Free threads take subtrees from a shared atomic counter, so a ceiling thread can join a round under way.
    - The help rule is "ceiling ≤ bound + 1".
    - The certificate path is T6's, unchanged.
  - **The two 19-move proofs:**
    - On random states 14 and 18, every round up to bound 18 generated + skipped exactly `lab/3x3`'s independent node counts. That includes 23,622,174,450 and 23,130,199,281 nodes at bound 18.
    - Both 19-move solutions replay with cubing.js.
    - So bound 18 was cleared in full, and 19 is optimal.
  - **Rerun on 2 threads,** on the first 12 sixteen-move positions:
    - split 4.75 s
    - with masks 1.42× faster
    - race 1.92× faster
    - race + masks 2.52× faster
    - every answer optimal and replayed
  - **Help depends on the core count.** On 2 threads it improved the median (0.88 s against 1.30 s) but not the mean (2.07 s against 1.89 s): with one prover, sending the ceiling to help early cost some certificates. On 4 threads T7 measured +8%.
  - **Three random states** with race + masks + help on 2 threads: 85.6 s, 12.6 s and 22.9 s, all optimal (T7 on 4 threads: 54.5 s, 13.5 s and 9.8 s).
  - **Results:** `analyse.py` regenerates the committed results exactly.
- **T8 web engine** (#37).
  - **Build:** `core-shared.wasm` rebuilds byte for byte, and its fallback is T5's engine unchanged.
  - **Port check:** 50 of 50 identical node counts at 14 moves, in Node and with one worker in Chromium.
  - **Isolation:** on a server with no headers, the page reloads once by itself and runs shared; `?nocoi` falls back to copies.
  - **Memory with 2 workers:** 90 MB of wasm memory and 416 MB in total, against 186 MB and 605 MB with copies.
  - **Speed:** at 14 moves, 87.5 ms against 128 ms with copies.
  - **Race** (1 prover + 1 ceiling) against 2 provers at 16 moves: 2.08× faster. 9 of 10 solves ended by the certificate, each exactly at the proven floor.
  - **Replay:** 170 solutions replayed with cubing.js, with 0 failures.

## What is left

1. **The app's 3×3 Solver,** on T8's engine.
   - Paste any scramble and get a proven-optimal solution, with each round shown as it is proven, like the 2×2 Solver.
   - Desktop and laptop first.
   - It needs the app's service worker to add the isolation headers (T8 describes how), and T7's help rule in the ceiling worker.
2. **Masks in wasm:** 331 MB in shared memory, packed straight to 18 bits. Measure whether they pay in the browser.
3. **A stronger floor.** The proof is now almost all the time, and only a stronger floor makes it smaller. This is the route to seconds, and it is research.
4. **Numbers from a real laptop and a phone,** and from Firefox and Safari.
