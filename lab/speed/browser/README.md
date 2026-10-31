# T5 Browser speed

`lab/3x3`'s optimal 3×3 solver compiled to WebAssembly and benchmarked in headless Chromium. It runs on one or more Web Workers, builds its tables in the browser and caches them in IndexedDB. Results: [FINDINGS.md](FINDINGS.md). Brief: [../T5-browser-speed.md](../T5-browser-speed.md).

## What is here

| Path | What it is |
| --- | --- |
| `src/core.c` | `lab/3x3/src/cube3.c` built freestanding for wasm32: no C library, bump allocator, JS imports for errors and logging. The search code is copied unchanged |
| `bench/core.wasm` | The built module (48 KB, committed so the page runs without a toolchain) |
| `bench/engine.js` | Wrapper around one wasm instance: build or load tables, set a floor, solve |
| `bench/worker.js` | Worker protocol. Roles: `builder` builds tables into the store and is then thrown away; `prover` runs IDA*, either a whole solve, one bound, or one subtree; `ceiling` is reserved for T6 |
| `bench/store.js` | Table store: IndexedDB, one record per table file keyed `<name>.<bits>`. Extra tables, such as T3's masks, are just more keys |
| `bench/pool.js` | Coordinator: N provers, each bound split into depth-`sd` subtrees handed out one at a time |
| `bench/index.html`, `bench/bench.js` | The page; `window.bench` is the API the driver calls |
| `scripts/run-browser.mjs` | Playwright driver: `build`, or `solve <floor> <set> <workers> [count] [sd] [maxnodes]` |
| `scripts/native.sh` | The native reference on the same machine (`lab/3x3`'s cube3, one thread) |
| `scripts/node-check.mjs` | Port check in Node: node counts per bound against `lab/3x3/results` |
| `scripts/check-solutions.mjs` | Replays every browser solution with cubing.js |
| `scripts/summarize.py` | Writes `results/summary.json`, `results/frontier.json` and FINDINGS' tables |
| `scrambles/` | The two subsets used (first 10 of moves-16; random states 0 and 7) |
| `results/runs/` | Every run: browser JSON, one solve per entry, plus the native JSONL |

## Rerun

Needs clang 18 with `wasm-ld`, gcc, Node 22, Playwright's Chromium, and `npm ci` at the repository root (for cubing.js).

```sh
cd lab/speed/browser
make                                                   # bench/core.wasm and build/cube3 (native)
node scripts/node-check.mjs 'C8s+P1x3i' moves-12       # port check, about 20 s
CUBE3_TABLES=data/tables build/cube3 build corners_sym edges6 phase1_sym
scripts/native.sh                                      # native reference, about 5 min
node scripts/run-browser.mjs build                     # tables into IndexedDB (data/chrome-profile)
node scripts/run-browser.mjs solve 'C8s+P1x3i' moves-14 4
cp data/browser/*.json results/runs/                   # then:
node scripts/check-solutions.mjs
python3 scripts/summarize.py
```

All runs in FINDINGS: `solve` with 1 worker for both floor sets on `moves-12` and `moves-14`, and the desktop set on `moves-16-first10`. Desktop with 2, 4 and 8 workers on `moves-14` and `moves-16-first10` (plus split depth 3), and phone with 4 workers on `moves-12` and `moves-14`. Random states: `random-idx0-idx7` on 4 workers with maxnodes 6e9. The subsets in `scrambles/` are the first 10 scrambles of `lab/3x3/scrambles/moves-16.txt`, and indices 0 and 7 of `random-state.txt`.

To look at the page by hand: `node scripts/serve.mjs`, then open the printed URL and call `bench.build('C8s+P1x3i')`, `bench.setup('C8s+P1x3i', 4)`, `bench.solve("R U F ...")` in the console.
