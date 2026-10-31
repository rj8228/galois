# T3 Gravity: downhill maps that skip reads cut on arrival

**Branch** `speed-gravity` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/gravity/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules, baseline numbers and result format.

## Why

Think of the floor as a landscape. On the 2×2, 81–83% of positions IDA\* generates are discarded on arrival, because g + h > bound. About three quarters of all generated positions sit under a parent exactly on the bound, a tight parent. There, only children whose floor drops can survive. The search still reads the floor for every child. Each read is a memory access, and on the 3×3 those accesses are the slow part. A stored map of which moves go downhill could skip them.

## Goal

Build downhill maps for the 2×2 floors and measure what they save in reads and time, against their memory cost. Compare against spending the same memory on a stronger floor.

## Method

1. **Components.** The 2 KB, 20 KB, 100 KB and 400 KB floors are maxima of component tables: twists, places, and corner-subset tables. `lab/2x2/exp2_floors.py` and `lab/2x2/results/exp2_floors.json` list the chosen ones.
   - Check that each component is consistent: one move changes it by at most 1.
   - Per abstract state, compute a 9-bit mask of moves that go down and a mask of moves that stay level.
2. **Search rule at a tight node** (g + h(y) = bound, with h = max over components h_k):
   - A child can survive only if every component at the maximum goes down, and every component at maximum − 1 does not go up.
   - Generate only the moves allowed by AND-ing those masks. At other nodes, generate as usual.
   - Prove in FINDINGS that this never skips a child that could survive.
   - Verify it: the same expansions and the same optimal solutions as the baseline on all 1,000 benchmark positions, and on every position if time allows.
3. **Mirror lookups.** The inverse of x·m is m⁻¹·x⁻¹: the move acts on the other side, so the masks do not apply to the mirror read directly. Measure the method with and without mirror. Explain how to combine them, for example masks for the direct read and ordinary reads for the mirror, or masks built for moves applied on the left.
4. **Measure:**
   - floor reads, mask reads and expansions per solve
   - wall time per solve in a compiled implementation (numba or C), because the gain is time, not positions searched
   - memory overhead, including packing options such as 16 bits per entry for a 4-bit distance plus a 9-bit down mask
   - a comparison against a stronger floor of the same total bytes, from the exp2 budget frontier
5. **Carrying it to the 3×3:**
   - Estimate the costs. The 3×3 has 18 moves, so masks are 18 bits. Table entry counts for C8s, E6x8 and phase 1 are in `lab/3x3/FINDINGS.md`.
   - Say whether masks could pay off there.
   - If time allows, prototype masks for the 3×3 corner table in a copy of `lab/3x3`'s C code inside your folder. Measure them on the 12- and 14-move benchmark scrambles.

## Results

`results/frontier.json` rows for each floor with and without masks, and with and without mirror, including `mean_extra_work` for mask reads and `mean_ms`.

## Done when

- The proof and the verification are written up.
- Reads, time and memory are measured against the equal-memory alternative.
- A clear yes or no is given for the 3×3.
- The pull request is open into `phase-8-speed-lab`.
