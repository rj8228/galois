# T5 Browser speed: how fast is optimal 3×3 solving in a browser?

**Branch** `speed-browser` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/browser/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules and the result format. Round 1's results are in [SYNTHESIS.md](SYNTHESIS.md).

## Why

`lab/3x3`'s timings are native C on one 2.1 GHz Xeon core:

| Floor set | Size | 14 moves | 16 moves | Random state |
|---|---|--:|--:|--:|
| Phone, `C8s@2+E6x8@2` | 12.3 MB | 1.6 s | about 4 min (estimated) | about 21 h (estimated) |
| Desktop, `C8s+P1x3i` | 77 MB | 72 ms | 9.6 s | 11.5 min |

The app runs in a browser. The claim we want to make, "optimal for any scramble, measured at X seconds in a laptop browser", needs real browser numbers.

Two other round-2 tasks may change the solver. **T6** runs a ceiling solver alongside the prover, so the final round can be skipped. **T3** adds downhill masks, about 331 MB, that skip reads. Build the browser harness so both can slot in later:
- a worker protocol with room for a second kind of worker (a ceiling worker)
- a table store with room for extra tables

## Goal

A benchmark harness, with no app UI, that runs `lab/3x3`'s solver in a browser. It should measure single-worker and multi-worker speed against native, on the same scrambles.

## Method

Priority: steps 1, 2 and 4 with one worker on both floor sets. Then step 3, then random states.

1. **Compile the solver core to WebAssembly.** That means table building, the two floor sets above, and IDA\*. Keep the C in your folder; don't modify `lab/3x3`.
   - **Toolchain:**
     - `clang` 18 with `--target=wasm32` and `wasm-ld` are installed.
     - There is no C library for wasm (no wasi-sysroot), so write the core freestanding: no stdio or malloc, memory from a static arena or `__builtin_wasm_memory_grow`, and do I/O in JavaScript.
     - Emscripten is not installed.
     - A plain TypeScript port is an acceptable fallback. `src/solver3` runs 19.4 M positions per second on weaker floors.
   - **Check the port:** the wasm build must give the same node counts as native on the 12-move set.
2. **Build tables on first use, inside a Web Worker,** and cache them in IndexedDB. `lab/3x3/FINDINGS.md` recommends building over downloading. Measure build time in the browser for each table.
3. **Split the search across workers.** Hand out subtrees after the first one or two moves, like `lab/3x3`'s `CUBE3_SPLIT`.
   - **Copies first:** start with one copy of the tables per worker. It is the simplest approach, and on a desktop four copies of 77 MB fit.
   - **Shared memory:** GitHub Pages cannot send the headers that unlock SharedArrayBuffer (COOP and COEP). If time allows, try the coi-serviceworker header shim and compare.
   - **Memory:** report what each approach uses.
4. **Benchmark in headless Chromium.** Playwright is preinstalled: `require('playwright')`, with no options needed for `chromium.launch()`.
   - **Scrambles:** the 12-, 14- and 16-move sets in `lab/3x3/scrambles`, plus a few random states with a time cap.
   - **Report:**
     - wasm against native for one worker, both built and run on this machine
     - scaling with 2, 4 and 8 workers, as far as the machine's cores allow (`nproc`)
   - **Replay** every solution with cubing.js, as `lab/3x3/scripts/check-solutions.mjs` does.
5. **Write down what this means for the app:**
   - which floor set suits which device
   - the expected time for a random state on a laptop, with and without T6's race (estimated from T6's numbers, if they are out)
   - what a phone can prove within a minute

## Results

`results/frontier.json` rows with `"puzzle": "3x3"`, `impl` set to `wasm-1w`, `wasm-4w` and so on, and `mean_ms` filled in.

## Done when

- Browser numbers exist for both floor sets on at least the 12- and 14-move sets.
- Worker scaling and memory are measured.
- The app recommendations are written.
- The pull request is open into `phase-8-speed-lab`.

**Time box: about 2 hours of session time.** Push checkpoints every hour. One-worker numbers on both floor sets, checked against native, are the core result; multi-worker and random states come after.
