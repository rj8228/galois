# T3 Gravity on the 3×3: downhill masks that skip reads cut on arrival

**Branch** `speed-gravity` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/gravity/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules and the result format. Round 1's results are in [SYNTHESIS.md](SYNTHESIS.md).

*Rescoped after round 1.* The first version of this brief started on the 2×2. T4 has since counted the 3×3 directly, and the 2×2 is already fast, so this task goes straight to a prototype on the 3×3 desktop set.

## Why

T4's findings (`anatomy3/FINDINGS.md`) cover the desktop set `C8s+P1x3i` (73.5 MB). It has 7 lookups: corners, phase 1 along three axes, and phase 1 along three axes on the inverse.

- **Most reads are wasted.** 92% of children are generated under a **tight** parent, one exactly on the bound (g + h = bound). At a tight parent, 97–98% of the children are cut on arrival.
- **Masks could skip them.** At a tight parent, a child can survive only if every lookup at the parent's maximum goes down by one. A down-mask stores, per table entry, the 18-bit set of moves that go down. With down-masks on the direct lookups, only 18–25% of children would be read, which skips 58–75% of all lookups without changing a single expansion.
  - Full masks, which also check that lookups at the maximum − 1 don't go up, would skip 67–85%.
  - Memory: 331 MB down-only, 661 MB full, on top of the 73.5 MB floor. That is inside the 500 MB desktop budget.
- **Spending the memory on stronger floors didn't pay.** In `lab/3x3/results/bench-moves-16.json`:
  - `C8s+E7x8i+P1x3i` (329 MB) searches 2% fewer nodes than the desktop set but takes 25.0 s instead of 9.6 s, because every node reads more tables.
  - Masks spend memory on fewer reads instead.
- **The catch: the baseline is already careful with memory.** `dfs()` reads the lookups group by group. For each group it computes and prefetches every child's entry before pruning, and a child cut by the corner table never touches phase 1.
  - So whether skipped reads become time has to be measured. Skipping a child also saves computing its coordinates.

T6 (ceiling race) attacks the final round. If it works, the proof rounds are what is left, and gravity speeds up every round.

## Goal

Build down-masks for the desktop set's tables and measure wall time per solve against the baseline, with identical expansions and solutions. Then give a clear yes or no.

## Method

Priority: steps 1–6 with down-only masks on the 14- and 16-move sets. Then step 7, then full masks and packing.

1. **Copy the solver.** Copy `lab/3x3/src/cube3.c` (or `lab/speed/anatomy3/src/anat3.c`, which counts more) into your folder.
2. **Build the masks** for the two tables the desktop set reads:
   - **C8s:** 6,053,616 entries, corner-permutation classes × twist.
   - **P1:** 140,908,410 entries, flip-slice classes × twist.
   - **What a mask holds.** For each entry e, the mask holds the moves m whose neighbour has value(e) − 1.
     - The table's own graph is in `neighbours()`.
     - For symmetry tables it also lists twin entries after each move's neighbour. Take the first entry per move; the twins share its value.
   - **Storage.** Store one `uint32_t` per entry first (about 590 MB) for simplicity. Measure a packed layout (18 bits, or 3 bytes) once it works.
   - Keep the masks in a git-ignored `data/` folder and time the build.
3. **Map masks to the node's frame.**
   - **How the search reads the tables.** It reads C8s through the class symmetry of the corner permutation. It reads P1 along three axes (moves mapped by `AXMOVE`) and through the class symmetry of flip-slice (moves mapped by `SYMMOVE`).
   - **Mapping a mask.** The mask that applies to node x is the stored mask with its bits permuted by those maps. Precompute bit-permutation tables, for example three 6-bit chunks per symmetry and axis, so that mapping a mask takes a few lookups.
   - **Check the mapping first.** Before using it in the search, check it against direct child lookups on a few million random positions; the direction of each conjugation is easy to get backwards.
4. **The search rule at a tight node** (moves left = h(x)).
   - **Allowed moves.** They are the AND of the mapped masks of the direct lookups whose value equals h(x). Generate only those children, plus the usual face rules.
   - **Inverse lookups can't use masks,** because the move acts on the other side of the position. Children the masks let through are read in full as usual.
   - **At other nodes,** generate every child as before.
   - **Keep the indices.** Keep each surviving child's direct lookup indices, which the search computes anyway. Then its masks can be read, and prefetched, when it is expanded.
   - **Prove it in FINDINGS.md:** no child that could survive is ever skipped.
5. **Verify.**
   - **Same expansions:** the children let through, plus those skipped, account exactly for the baseline's lookups.
   - **Same solutions** on the 12-, 14- and 16-move sets.
   - **Lengths** equal `lab/3x3`'s results.
6. **Measure.**
   - **Setup:** one thread, the same machine, and the same binary with masks on and off.
   - **Sets:** ms per solve on the 14- and 16-move sets (50 each), plus 2–3 random states, capped.
   - **Counts:** lookups, mask reads and expansions.
   - **Two threads too.** Also measure with two threads (`CUBE3_SPLIT`), because masks add memory traffic and the threads share it.
7. **Compare and carry over.**
   - **Masks against the bigger floors:** against the bigger desktop floors already timed in `lab/3x3/results`, say whether the memory is better spent on masks or on a stronger floor.
   - **Full masks** if time allows.
   - **For the browser (T5):** mask memory, build time, and whether they could be built in a browser.

## Results

- **`results/frontier.json`** rows:
  - `"puzzle": "3x3"`
  - one row per variant: baseline, down-only masks, full masks, packed
  - `mean_ms` filled in, mask reads in `mean_extra_work`, mask memory in `extra_bytes`
- **`FINDINGS.md`,** verdict first:
  - the speed-up in time, if any
  - what it costs in memory and build time
  - yes or no for the desktop set

## Done when

- The masks are built and the mapping is verified.
- Identical expansions and solutions are shown.
- Time is measured against the baseline on the 14- and 16-move sets.
- A clear yes or no is written down.
- The pull request is open into `phase-8-speed-lab`.

**Time box: about 2 hours of session time.** Push checkpoints every hour. A verified down-only prototype with honest timings is a complete result; full masks and packing are extras.
