# T8 Web engine

The browser engine for the app's 3×3 Solver: `lab/3x3`'s solver as a threads build of WebAssembly. Every Web Worker runs on one shared `WebAssembly.Memory`, which holds one copy of the tables. A two-phase ceiling worker (T6) races the provers, and one stop flag in shared memory halts every worker as soon as an answer is proven. A small service worker gives a static host (GitHub Pages) the cross-origin isolation this needs. Without isolation it falls back to T5's private copies. Results: [FINDINGS.md](FINDINGS.md). Brief: [../T8-web-engine.md](../T8-web-engine.md) (issue #36, part of #20).

## What is here

| Path | What it is |
| --- | --- |
| `src/core.c` | T5's `browser/src/core.c` plus T6's two-phase solver (`ceiling/src/ceiling.inc`). Changes: a spinlock in the bump allocator, per-worker state in a `Ctx`, a shared control block (stop flag, ceiling, proven bound, subtree counter), the race's certificate on that block. The search code is unchanged |
| `bench/core-shared.wasm` | The threads build (60 KB): `-matomics -mbulk-memory`, linked with `--shared-memory --import-memory --max-memory=2 GiB`, `__stack_pointer` exported |
| `bench/core-t5.wasm`, `engine.js`, `worker.js`, `pool.js`, `store.js` | T5's engine, copied unchanged: the table builder (into IndexedDB) and the fallback without isolation |
| `bench/shared-engine.js` | One worker's instance on the shared memory: its own stack, scratch buffer and record |
| `bench/shared-worker.js` | Worker roles `loader` (copies the tables into shared memory once, then is prover 0), `prover`, `ceiling` |
| `bench/shared-pool.js` | The coordinator: rounds, the split, the race and its certificate |
| `bench/coi-sw.js`, `bench/coi.js` | The isolation service worker (adds COOP and COEP) and its one-time reload |
| `bench/index.html`, `bench/bench.js` | The page; `window.bench` is what the driver calls |
| `scripts/node-check-shared.mjs` | Port check in Node: node counts per bound against `lab/3x3/results` |
| `scripts/run-browser.mjs` | Playwright driver: `build`, `isolation`, `solve <shared\|race\|copies> <floor> <set> <provers> [count] [sd] [maxnodes] [cap]` |
| `scripts/run-all.sh` | Every browser run in FINDINGS, one at a time |
| `scripts/check-solutions.mjs` | Replays every solution in `results/runs/` with cubing.js |
| `scripts/summarize.py` | Checks the runs and writes `results/summary.json` and `results/frontier.json` |

## Rerun

Needs clang 18 with `wasm-ld`, Node 22, Playwright's Chromium, and `npm ci` at the repository root (for cubing.js).

```sh
cd lab/speed/webengine
make bench/core-shared.wasm
node scripts/node-check-shared.mjs 'C8s+P1x3i' moves-14     # port check, about 30 s
node scripts/run-browser.mjs build                         # tables into IndexedDB (data/chrome-profile)
node scripts/run-browser.mjs isolation                     # first visit, reload, fallback
scripts/run-all.sh                                         # about 45 minutes
cp data/browser/*.json results/runs/
node scripts/check-solutions.mjs
python3 scripts/summarize.py
```

The server (`scripts/serve.mjs`, T5's) sends no COOP or COEP headers, as on GitHub Pages; isolation comes from `bench/coi-sw.js` alone. To look at the page by hand: `node scripts/serve.mjs 8126`, open `http://127.0.0.1:8126/speed/webengine/bench/index.html`, then `await bench.build('C8s+P1x3i')`, `await bench.setup('C8s+P1x3i', 3, 'race')` and `await bench.solve("R U F ...")` in the console.
