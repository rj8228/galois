# T8 Web engine: shared memory, a ceiling worker and one stop for all

**Branch** `speed-webengine` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/webengine/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules and the result format. Round 2's results are in [SYNTHESIS-2.md](SYNTHESIS-2.md).

## Why

T5 (`lab/speed/browser/`) put `lab/3x3`'s solver in a browser: 48 KB of WebAssembly at 0.55× native speed per core, with identical node counts. Three things keep it from being the app's engine:

- **Every worker holds its own copy of the tables.** That is 93 MB per desktop worker, and Chromium's footprint was 982 MB with 4 workers. T3's 331 MB of masks can't be copied per worker at all.
- **A found solution can't stop the other workers.** On one random state, workers kept running for 15 s after the answer.
- **There is no ceiling worker.** T6's race is the biggest lever, and T5 only reserved the role.

All three need SharedArrayBuffer: one wasm memory shared by every worker. That needs cross-origin isolation (COOP and COEP headers), which GitHub Pages cannot send. A service worker can add them.

## Goal

A threads build of the wasm core that shares one copy of the tables (and, if it fits, the masks) between workers. It runs T6's two-phase ceiling as its own worker and stops every worker through one shared flag. Measure it in headless Chromium against T5's harness.

## Method

Priority: steps 1–4. Step 5 if time is left; step 6 is a short write-up either way.

1. **Threads build of the core.** Copy T5's `src/core.c` and add T6's two-phase solver (`lab/speed/ceiling/src/ceiling.inc`) to it.
   - Build with `clang --target=wasm32 -matomics -mbulk-memory`, linking with `--shared-memory --import-memory --max-memory=<N>`, plus T5's flags.
   - JavaScript creates one `WebAssembly.Memory({ shared: true, ... })` and every worker instantiates the module on it.
   - **Pitfalls:**
     - Each instance has its own `__stack_pointer` global. Export it (`-Wl,--export=__stack_pointer`) and give each worker its own stack region before it runs anything.
     - Avoid `__thread` (thread-local storage needs more setup than this build has).
     - Make the bump allocator safe to share: atomic, or used only while tables are built.
     - Data segments are initialised once (wasm-ld guards this); globals in C are shared by every worker.
   - **Check the port:** node counts per bound equal native's on the 12- and 14-move sets, as T5's `scripts/node-check.mjs` does.
2. **One copy of the tables, built or loaded once into shared memory,** from T5's IndexedDB store when it is there.
   - Hand out subtrees through an atomic counter in shared memory instead of a message per subtree; T5 measured that each message costs a round trip.
   - Put the stop flag and T6's shared ceiling in shared memory. Every worker polls them in its search, as `dfs` already polls a stop flag.
   - **Measure:**
     - memory with 1, 2 and 4 workers (wasm memory and Chromium's PSS)
     - speed on the 14- and 16-move sets against T5's numbers
     - the idle tail after a solution
3. **The race in the browser:** 3 prover workers plus 1 ceiling worker, with T6's certificate rule (the prover stops when its proven bound reaches the ceiling).
   - Run the 16-move set and 3–5 random states, each capped.
   - Report time to answer, how each solve ended, and the comparison with 4 provers alone.
4. **Cross-origin isolation on a static host.**
   - Serve the page with no special headers.
   - Add a minimal service worker that adds `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`) to its responses. Either write one (about 40 lines) or vendor gzuidhof/coi-serviceworker (MIT, with its license file).
   - Confirm that `crossOriginIsolated` is true after the first reload and that the shared build runs.
   - Write down how the app's own service worker (Vite PWA) should add the same headers, and what else the page must then load with CORP headers.
   - **Without isolation,** for example on the first visit before the reload, fall back to T5's copy-per-worker mode.
5. **Masks in wasm** (if time is left). Build T3's packed down-masks (331 MB) into shared memory and measure:
   - their build time in a worker
   - the speed-up on one worker and on 4, against T3's native 1.46×
   - Chromium's footprint, with the floor's 77 MB and the masks
6. **For the app,** write down:
   - the engine's API, as `bench/worker.js` roles and messages
   - what a desktop needs (memory, first-use build time)
   - what to do on a phone (no masks, phone tables, and no race unless it pays there)

## Results

- **`results/frontier.json`** rows:
  - `"puzzle": "3x3"`
  - `impl` set to `wasm-shared-1w`, `wasm-shared-4w`, `wasm-race-3p1c` and so on
  - `mean_ms` filled in
- **`FINDINGS.md`,** verdict first:
  - memory saved
  - speed against T5
  - what the race does in a browser
  - whether isolation works on a static host
  - what the app needs

## Done when

- The shared build is checked against native: node counts and replay with cubing.js.
- Memory and speed are measured against T5.
- The race runs in the browser on at least the 16-move set.
- The isolation test is written up.
- The pull request is open into `phase-8-speed-lab`.

**Time box: about 2 hours of session time.** Push checkpoints every hour. A working shared build with one table copy and a shared stop is the core result; the race and the masks build on it.
