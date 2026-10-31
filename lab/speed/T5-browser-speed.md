# T5 Browser speed (optional): how fast is optimal 3×3 solving in a browser?

**Branch** `speed-browser` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/browser/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules, baseline numbers and result format.

## Why

`lab/3x3`'s timings are native C on one 2.1 GHz Xeon core:

| Floor set | Size | 14 moves | 16 moves | Random state |
|---|---|--:|--:|--:|
| Phone, `C8s@2+E6x8@2` | 12.3 MB | 1.6 s | about 4 min (estimated) | about 21 h (estimated) |
| Desktop, `C8s+P1x3i` | 77 MB | 72 ms | 9.6 s | 11.5 min |

The app runs in a browser. The claim we want to make, "optimal for any scramble, measured at X seconds in a laptop browser", needs real browser numbers.

## Goal

A benchmark harness, with no app UI, that runs `lab/3x3`'s solver in a browser. It should measure single-worker and multi-worker speed against native, on the same scrambles.

## Method

1. **Compile the solver core to WebAssembly.** That means table building, the two floor sets above, and IDA\*. Use `clang --target=wasm32`, or Emscripten if you can install it. Keep the C in your folder; don't modify `lab/3x3`.
2. **Build tables on first use, inside a Web Worker,** and cache them in IndexedDB. `lab/3x3/FINDINGS.md` recommends building over downloading. Measure build time in the browser.
3. **Split the search across workers.** Hand out subtrees after the first one or two moves.
   - GitHub Pages cannot send the headers that unlock SharedArrayBuffer (COOP and COEP). Try a service-worker header shim, the coi-serviceworker approach, and compare it with a separate copy of the tables per worker.
   - Report the memory used by each approach.
4. **Benchmark in headless Chromium.** Playwright is preinstalled: `require('playwright')`, with no options needed for `chromium.launch()`.
   - Use the 12-, 14- and 16-move scrambles in `lab/3x3/scrambles`, plus a few random states with a time cap.
   - Report wasm against native for one worker, and the scaling with 2, 4 and 8 workers.
   - Replay every solution with cubing.js, as `lab/3x3/scripts/check-solutions.mjs` does.
5. **Write down what this means for the app:**
   - which floor set suits which device
   - the expected time for a random state on a laptop
   - what a phone can prove within a minute

## Results

`results/frontier.json` rows with `"puzzle": "3x3"`, `impl` set to `wasm-1w`, `wasm-4w` and so on, and `mean_ms` filled in.

## Done when

- Browser numbers exist for both floor sets on at least the 12- and 14-move sets.
- Worker scaling and memory are measured.
- The app recommendations are written.
- The pull request is open into `phase-8-speed-lab`.
