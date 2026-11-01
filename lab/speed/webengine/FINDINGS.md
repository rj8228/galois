# T8 Web engine: findings

Speed lab task T8 (issue #36, part of #20). How to rerun: [README.md](README.md). Everything was measured in headless Chromium under Playwright, on a 4-core Intel Xeon at 2.1 GHz (cloud, the same kind of machine as T5). The desktop floor `C8s+P1x3i` was used throughout. To compare like with like, T5's copy-per-worker engine was rerun on the same machine ("copies"); T5's own numbers are quoted too.

## Verdict

- **Memory: one table copy for every worker.** 4 workers use **94 MB of wasm memory instead of 370 MB**, and Chromium's PSS is **420 MB instead of 998 MB**, 578 MB less. Each extra worker costs about 3 MB of wasm memory (a 2 MB stack and its records) and 2–3 MB of PSS here. With copies it costs 93 MB of wasm memory and about 200 MB of PSS. The race (3 provers + 1 ceiling worker) adds 2 MB, for its phase-2 tables. Memory is now flat in the number of workers, so the app can run one worker per core.
- **Speed: at least as fast as T5, and much faster on short solves.** The node rate per worker is unchanged: 1 worker takes 12.4 s on the first ten 16-move scrambles, against 14.6 s in T5 on its machine. At 14 moves it takes 114.8 ms, against 112.4 ms for copies on this machine. Subtrees now come from an atomic counter in shared memory instead of a message each:
  - 4 workers are **4.08× faster than 1 at 16 moves** (T5: 3.36×). That is 3.05 s, against 3.27 s for copies here and 4.3 s in T5.
  - 4 workers are **3.4× faster than 1 at 14 moves**, where copies gained only 1.9× (33.5 ms against 57.8 ms here, and T5's 73.9 ms).
- **One stop flag ends the idle tail.** After a proven answer, every worker is idle within **0.1 ms on average and 1.7 ms at worst**, over 177 multi-worker solves. With copies, the tail averaged 8.5 s on two random states, and was 15.0 s on random state 0 (T5 measured 15.2 s).
- **The race pays in the browser.** 3 provers + 1 ceiling worker against 4 provers, the same 4 workers:
  - **16 moves (50): mean 1.89 s against 3.85 s (2.0×).** The median is 0.95 s against 4.1 s. 40 of 50 solves ended by the ceiling's certificate. The race was faster on 36 of 50; its worst case was 11.2 s, against 8.5 s.
  - **14 moves (50): 28.2 ms against 33.5 ms.**
  - **5 random states: mean 78.5 s against 132.4 s (1.7×).** 4 ended by the certificate and 1 by a prover. The race lost on the two states whose final round is short (state 0: 113 s against 100 s; state 7: 22 s against 18 s). It won 9× on state 4 and 1.8× on states 5 and 6.
- **Isolation works on a static host.** The test server sent no COOP or COEP headers, as on GitHub Pages. A 30-line service worker (`bench/coi-sw.js`) adds them. On the first visit the page reloads once, by itself. After that `crossOriginIsolated` is true and the shared engine runs; later visits need no reload. With the service worker off (`?nocoi`), the page falls back to T5's copies and still solves.
- **Correctness.**
  - Node counts per bound equal `lab/3x3`'s on 150 of 150 solves in Node: 12 and 14 moves on the desktop floor, and 12 moves on the phone floor.
  - In the browser, every 1-worker solve has native's node count: 60 of 60.
  - All 664 solutions in `results/runs/` replay with cubing.js, with 0 failures, and every length equals `lab/3x3`'s.
  - A ceiling certificate is only accepted when its length equals the proven bound; otherwise the page throws. That never happened.
- **Not done:** step 5, the masks in wasm (time box). The memory has room for them (2 GiB maximum; one copy of the 331 MB masks would be shared by every worker), but their build and speed in wasm remain unmeasured.

## Memory

wasm memory is the shared `WebAssembly.Memory` (shared), or the sum of the private ones (copies). PSS is every Chromium process, summed, after setup. Tables are 73.5 MB, and their index (symmetry classes) is 3.3 MB.

| Engine | Workers | wasm memory | Chromium PSS | Source |
|---|--:|--:|--:|---|
| shared | 1 | 84 MB | 412 MB | `shared-1w__…moves-14` |
| shared | 2 | 90 MB | 414 MB | `shared-2w__…moves-14` |
| shared | 4 | 94 MB | 420 MB | `shared-4w__…moves-14` |
| race | 3 + 1 ceiling | 96 MB | 423 MB | `race-3p1c__…moves-16` |
| copies (T5) | 1 | 89 MB | 407 MB | `copies-1w__…moves-14` |
| copies (T5) | 2 | 185 MB | 605 MB | `copies-2w__…moves-14` |
| copies (T5) | 4 | 370 MB | 998 MB | `copies-4w__…moves-14` |

Before setup, Chromium with the page loaded sat at 206 MB of PSS, so the shared engine adds about 210 MB whatever the number of workers. The wasm memory is about 90 MB of that; the rest is V8 and worker overhead, not measured separately. Setup from IndexedDB took 0.47 s for 4 shared workers (one IndexedDB read of 0.23 s, then one copy into shared memory). The race's phase-2 tables add 0.12 s. Building the tables on first use took 22.5 s, in T5's builder worker.

## Speed

Mean time to a proven answer, measured from the page.

| Set | Engine | 1 worker | 2 workers | 4 workers | Speed-up at 4 | T5, 4 workers |
|---|---|--:|--:|--:|--:|--:|
| moves-14 (50) | shared | 114.8 ms | 57.1 ms | **33.5 ms** | 3.43× | 73.9 ms |
| moves-14 (50) | copies, here | 112.4 ms | 89.4 ms | 57.8 ms | 1.94× | |
| moves-16, first 10 | shared | 12.45 s | 6.09 s | **3.05 s** | 4.08× | 4.34 s |
| moves-16, first 10 | copies, here | – | – | 3.27 s | | |
| moves-16 (50) | shared | – | – | 3.85 s | | |

The split is unchanged from T5: from the fourth round on, depth-2 subtrees are shared between the workers. The gain over copies comes from two places:
- no message round trip per subtree;
- no idle tail before the next round can start (copies wait for every worker).

At 16 moves the 4-worker run beats 1 worker by slightly more than 4×. Shared runs use about 1% more nodes than one worker, so this is within noise.

## Idle tail after the answer

| Run | Mean tail | Worst tail |
|---|--:|--:|
| shared, all multi-worker runs (177 solves) | 0.1 ms | 1.7 ms |
| race, all runs (115 solves; includes stopping the ceiling worker) | 1.1–2.7 ms | 5.1 ms |
| copies, moves-16 first 10, 4 workers | 107 ms | 190 ms |
| copies, random states 0 and 7, 4 workers | 8.5 s | 15.0 s |

Random states 0 and 7 on 4 workers took 51.3 s mean shared (88.5 s and 14.2 s), against 61.3 s with copies (103.3 s and 19.4 s; T5 measured 116.3 s and 18.9 s).

## The race in the browser

3 prover workers + 1 ceiling worker (T6's two-phase solver in trace mode, with the desktop floor as phase-1 pruning). The race ends when:
- the ceiling worker finds a solution no longer than the bound the provers have proven (T6's certificate; the ceiling raises the shared stop flag itself, mid-round), or
- a prover finds a solution first, or
- the round at the start of which the page sees ceiling ≤ bound is reached.

The comparison is 4 provers without a ceiling, on the same 4 workers.

| Set | 4 provers | Race 3p + 1c | Race / 4p | Ended by the ceiling |
|---|--:|--:|--:|--:|
| moves-14 (50) | 33.5 ms | 28.2 ms | 1.19× | 25 of 50 |
| moves-16 (50) | 3.85 s (median 4.10) | **1.89 s** (median 0.95) | **2.04×** | 40 of 50 |
| random states (5) | 132.4 s | **78.5 s** | **1.69×** | 4 of 5 |

| Random state | Length | 4 provers | Race | How the race ended | Ceiling reached the optimum at |
|--:|--:|--:|--:|---|--:|
| 0 | 18 | 100.3 s | 113.0 s | certificate | 73.1 s |
| 4 | 17 | 100.2 s | **11.4 s** | certificate | 11.4 s |
| 5 | 18 | 215.3 s | **122.3 s** | certificate | 2.0 s |
| 6 | 18 | 228.3 s | **123.7 s** | certificate | 1.1 s |
| 7 | 17 | 18.0 s | 22.0 s | prover (ceiling stuck at 18) | – |

- **Where the race loses.** When the final round is small (states 0 and 7, and 10 of the 50 sixteen-move positions), giving one core to the ceiling makes the proof a quarter slower, and the ceiling saves little.
- **Where it wins.** On the other states it skips a final round worth as much as the whole proof.
- **The tail fix** (the ceiling worker joins the provers once the proof ends; T6 and SYNTHESIS-2) would remove most of the loss. It was not built.
- **State 0's two 4-prover times.** It took 88.5 s in one run and 100.3 s in another. The runs differ only in the order work was handed out and in machine noise. Take differences under about 10% as noise.

## Isolation on a static host

`scripts/run-browser.mjs isolation` (`results/runs/isolation.json`): a fresh profile per case, on a server with no COOP or COEP.

| Case | Navigations | crossOriginIsolated | Engine used | Solve |
|---|--:|---|---|---|
| First visit | 2 (one automatic reload) | true after the reload | shared | verified |
| Second visit, same profile | 1 | true | shared | – |
| `?nocoi` (no service worker) | 1 | false, and no `SharedArrayBuffer` | copies (fallback) | verified |

**How it works.** `bench/coi.js` registers `bench/coi-sw.js` and reloads once if the page is not isolated. The service worker re-serves every response in its scope with:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

That includes the worker scripts and the wasm, which dedicated workers under COEP need too.

**For the app's own service worker (Vite PWA).** Two service workers cannot share a scope, so the app should not ship the shim alongside Workbox.
- Switch `vite-plugin-pwa` to `strategies: 'injectManifest'` with a small `src/sw.ts`. It calls `precacheAndRoute(self.__WB_MANIFEST)`, plus a Workbox plugin whose `handlerWillRespond` adds the two headers to every response (precached or fetched). It also handles navigations, so the HTML itself carries them.
- `clientsClaim` and `skipWaiting` stay, so the first visit can reload once into isolation.
- The app should not rely on it: before the service worker controls the page (the first visit, a private window, a browser that refuses service workers), use the copies engine.

**What the page must then load under COEP.**
- Everything same-origin is fine.
- Cross-origin resources need CORS or `Cross-Origin-Resource-Policy: cross-origin`. That covers fonts (Google Fonts sends CORS headers), any CDN script, and images.
- `credentialless` instead of `require-corp` is laxer for cross-origin images, but Safari does not support it.
- `window.open` popups to other origins lose their opener under COOP `same-origin`.

**Not tested.** Firefox, Safari and real phones. Only headless Chromium 153 was tested.

## For the app

**The engine's API** (`bench/shared-worker.js`, `bench/shared-pool.js`). The page creates one `WebAssembly.Memory({shared: true, maximum: 2 GiB})` and compiles `core-shared.wasm` once. It posts both to every worker. Messages are `{id, op, ...}` and replies are `{id, ok, ...}`.

| Role | Op | What it does |
|---|---|---|
| `loader` (first, alone) | `init` | Instantiates the module, runs `init()` (cube model, coordinates, control block) |
| | `load {tables, floor, ceiling, others}` | Copies each table from IndexedDB into shared memory once, sets the floor, builds the ceiling's phase-2 tables, allocates a stack for each other worker. Returns the control block's address and the stacks |
| `prover` (the loader is prover 0) | `init {stackTop}` | Instantiates on the same memory; sets its own `__stack_pointer` before running anything |
| | `root {scramble}` | Sets this worker's root; returns h0 |
| | `bound {bound}` | A whole round on this worker (the early rounds) |
| | `collect {bound, sd}` | Prover 0 only: the round's depth-sd subtrees, into shared memory |
| | `run {bound, sd}` | Takes subtrees from the shared counter until none are left or the stop flag is up |
| `ceiling` | `ceil {scramble, cap}` | Two-phase trace; publishes every shorter solution to the shared ceiling, raises the stop flag on a certificate |
| `builder` (T5) | `build {name, bits}` | First use only: builds a table into IndexedDB in a throwaway worker (its scratch memory goes with it) |

The control block (`CTL` in `bench/shared-engine.js`) holds the stop flag, the ceiling, the proven bound, the subtree counter and the winner's path. The page reads it with `Atomics` and can show each round as it is proven (`bound`), and the best solution so far (`ceiling`), while the search runs.

**A desktop needs:**
- about 210 MB of PSS for the engine whatever the core count (wasm memory: one table copy of 77 MB plus 3 MB per worker) (with masks, if they pay in wasm, add 331 MB);
- 22.5 s on one core to build the tables on first use, cached in IndexedDB, then 0.5 s to start;
- one worker per core: n − 1 provers and one ceiling worker;
- cross-origin isolation through the app's service worker.

From these measurements, a random state on this 4-core cloud machine takes about 80 s with the race, against 130 s without it.

**On a phone:**
- Use the phone floor `C8s@2+E6x8@2` (12 MB; 9.8 s to build) with no masks.
- Shared memory still helps: no table copies, and no idle tail.
- The ceiling worker needs the desktop floor's phase-1 table (`phase1_sym`, 70 MB). The race should therefore stay off on a phone, unless a phone-sized phase-1 table is built for it.
- A phone proves what T5 said it could: any 14-move scramble, and "no solution of 15 or fewer moves" for any position, within about a minute. It still should not promise optimal 18-move answers.

## How it was checked

- **Port.**
  - `scripts/node-check-shared.mjs` runs the threads build in Node on a shared memory, building the tables in place. Its node counts per bound equal `lab/3x3/results` on 50 of 50 solves each at 12 moves (desktop floor), 14 moves (desktop floor) and 12 moves (phone floor).
  - In Chromium, every 1-worker run equals native's total and length: 50 at 14 moves and 10 at 16 (`results/summary.json`).
- **Replay.**
  - Every solution is replayed inside wasm on the prover's root.
  - The ceiling replays each of its own solutions before publishing it, and stops the program if one fails.
  - All 664 solutions in `results/runs/` were replayed with cubing.js, with 0 failures (`results/cubing-check.json`).
  - Every length equals `lab/3x3`'s.
- **The certificate.**
  - The page stores the round's bound, then reads the ceiling. The ceiling worker stores the ceiling, then reads the bound. Both use sequentially consistent atomics, as in T6. So a solution no longer than the proven floor is always noticed by at least one side.
  - When the race ends by the ceiling, the page checks that the ceiling's length equals the proven bound, and throws otherwise.
- **Shared-memory pitfalls handled.**
  - Each instance sets its own `__stack_pointer`; the loader allocates the stacks before the others start.
  - There is no `__thread`.
  - The bump allocator takes a spinlock.
  - `init()` runs once, in the loader; data segments are initialised once by wasm-ld's start function.
  - `TextDecoder` cannot read a shared view, so strings are copied out first.

## Not done

- **Step 5, masks in wasm** (time box). The engine is ready for them: the masks would go into the shared memory once, built by the loader or by a builder worker into IndexedDB. Two things should be tested first:
  - the in-place build without T3's 563 MB of uint32 scratch (pack to 18 bits directly);
  - whether random mask reads pay in wasm.
- **The tail fix:** the ceiling worker joining the final round once the proof ends.
- **Other browsers, a real laptop and a phone.**
