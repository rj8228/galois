# T4 3×3 anatomy: does the 2×2 picture hold at scale?

**Branch** `speed-3x3-anatomy` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/anatomy3/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules, baseline numbers and result format.

## Why

On the 2×2:

- the final round is 54–75% of the work
- 81–83% of generated positions are cut on arrival
- a perfect move order halves the work
- a third of positions have a single shortest solution

The 3×3 has about 13.35 sensible choices per move instead of about 6, so these shares may be quite different. They decide which lever is worth the most: mirror, compass or gravity. `lab/3x3` (C, from PR #18) is our fastest 3×3 solver. Its FINDINGS lists the floor sets, benchmarks and timings.

## Goal

Measure the same anatomy on the 3×3 with `lab/3x3`'s solver, plus the upper bound for a perfect compass.

## Method

Copy what you need from `lab/3x3` into your folder. Don't modify `lab/3x3`. Its tables build in under a minute (see its README).

1. **Instrument IDA\*.** Record:
   - lookups per round, and the final round's share
   - lookups cut on arrival, split by whether the parent was tight (g + h = bound)
   - expansions

   Run it with the phone set `C8s@2+E6x8@2` and the desktop set `C8s+P1x3i`. Use the 12-, 14- and 16-move benchmark scrambles in `lab/3x3/scrambles`. Add as many random-state scrambles as your time budget allows, with the desktop set; its random states took 11.5 minutes each on one thread, and you can run four at a time.
2. **Perfect-compass bound.** After a solve, run the final round again. At every node on the found optimal solution's path, try that solution's next move first. Report final-round and total lookups.
   - This bound is for that particular solution. With the same floor, any order that reaches the solution can do no better on that path.
   - Also try cheap orders: by the floor, and by the mirror floor.
3. **Doors home.** For the 12- and 14-move sets, count all shortest solutions per position by continuing the final round after the first solution. Relate the cost of finding a solution to that count.
4. **Compare with the 2×2.** Report how the proof, find and cut-on-arrival shares change from the 2×2 to the 3×3. Say what that means for each lever, with numbers.

## Checks

- Replay every solution on the cube.
- Lengths must match `lab/3x3`'s results for the same scrambles and floor sets.
- If a scramble hits a cap, say so. Never report a capped run as complete.

## Results

`results/frontier.json` rows with `"puzzle": "3x3"`, where positions are scrambles and the floor is the set name. Take `floor_bytes` from `lab/3x3/results/sizes.json`.

## Done when

- The anatomy table is measured for both floor sets on at least the 12-, 14- and 16-move sets.
- The compass bound and the doors-home counts are reported.
- There is a clear paragraph ranking the three levers for the 3×3.
- The pull request is open into `phase-8-speed-lab`.
