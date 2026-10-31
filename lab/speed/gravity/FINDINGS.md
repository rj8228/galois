# T3 Gravity on the 3×3: findings

Speed lab task T3 (issue #23, part of #20). The question: do stored downhill masks make the desktop set `C8s+P1x3i` faster? The masks skip the children that would be cut on arrival, without changing a single expansion. How to rerun: [README.md](README.md).

## Verdict

**Yes. Downhill masks make the desktop set about 1.5 times faster, and they fit in its memory budget once packed in 18 bits.** The search is the same: the same solutions, and the same expansions in every round on every solve.

- **Speed-up, one thread, down masks packed in 18 bits (331 MB):** 1.42× on the 14-move set, and 1.46× on the 16-move set (7.23 s → 4.97 s per solve). With uint32 masks (588 MB) it is 1.48× and 1.51×. On the two random states timed it is 1.59× (90 s → 56 s, uint32).
- **Full masks (down and up, 1.18 GB) give 1.63–1.68×.** That is the best time, but it is far over the 500 MB budget.
- **Two threads keep the gain.** With `CUBE3_SPLIT`, uint32 down masks are 1.53× faster (3.44 s → 2.25 s at 16 moves), and full masks 1.68×. The extra memory traffic doesn't eat the gain when two threads share it.
- **Why it pays:** the masks skip 75% of the children the baseline generates (86% with full masks), as T4 predicted. Instead of 87.2 million children per 16-move solve, the masked search generates 21.5 million and reads 13.0 million masks.
  - Each skipped child would have cost a cube multiply, a coordinate update and at least one table read.
  - The time saved (about 1.5×) is less than the count saved (about 4×). A tight node still needs its mask reads, which are random accesses, and the surviving children are read as before.
- **Cost: 331 MB and about 12 seconds.**
  - **Memory:** 18-bit masks take 331 MB. With the 76.8 MB floor that is 408 MB, inside the 500 MB budget. uint32 masks (661 MB in all) are over it.
  - **Speed of the packed layout:** it costs about 4% of speed against uint32 (1.46× instead of 1.51×). Unpacking is a shift and a mask.
  - **Build:** the masks build in 6.3 s on 4 threads and are written in 4.7 s. Packing to 18 bits takes about a second at load.
- **Memory spent on masks beats memory spent on a stronger floor.** In `lab/3x3/results/bench-moves-16.json`, the bigger desktop floors search 1–2% fewer nodes than `C8s+P1x3i`, but they are slower:
  - `C8s+E7x2i+P1x3i` (332 MB) takes 1.58× the time.
  - `C8s+E7x8i+P1x3i` (332 MB) takes 2.6× the time.

  Masks spend about the same memory and are 1.46× faster.
- **For the desktop set: yes.** Use the 18-bit down masks. Full masks would only make sense with a bigger budget, or packed into 36 bits (661 MB), which this run didn't test.
- **For the browser (T5):** the build is a single pass over the 141 million phase-1 entries, 18 neighbour reads each, and needs only the floor table. It could run in a web worker.
  - **Time:** single-threaded WebAssembly is untested here; a guess is 30–60 s, or the 331 MB could be downloaded instead.
  - **Memory:** 331 MB plus the floor is too much for a phone, and fine for a desktop browser tab.
  - **Still to measure:** the in-browser speed-up. WebAssembly's memory access pattern differs from native C.

## Results

<!-- tables:start -->
### Time per solve

Desktop set `C8s+P1x3i` (73.5 MB floor). Same binary, masks on or off; one process at a time on an idle 4-core machine. *Lookups*: children generated (lab/3x3's node count; each is read against the floor). *Skipped*: children the masks ruled out before generating them. *Speed-up*: baseline mean ms / this mean ms, and the geometric mean of the per-solve ratios.

| Set (solves), threads | Method | Mask memory | Mean ms | Median ms | Speed-up (mean, per-solve geomean) | Lookups per solve | Skipped | Mask reads per solve |
| --- | --- | --: | --: | --: | --: | --: | --: | --: |
| 12 moves (50), 1 | baseline | – | 1.1 | 0.6 | 1.00×, 1.00× | 13,344 | 0% | – |
| 12 moves (50), 1 | down masks (uint32) | 588 MB | 0.8 | 0.5 | 1.29×, 1.38× | 5,770 | 57% | 1,137 |
| 12 moves (50), 1 | full masks (down + up, 2 x uint32) | 1,176 MB | 0.8 | 0.5 | 1.36×, 1.43× | 3,778 | 72% | 2,027 |
| 12 moves (50), 1 | down masks packed (18 bits) | 331 MB | 1.0 | 0.6 | 1.05×, 1.10× | 5,770 | 57% | 1,137 |
| 14 moves (50), 1 | baseline | – | 49.1 | 42.5 | 1.00×, 1.00× | 616,532 | 0% | – |
| 14 moves (50), 1 | down masks (uint32) | 588 MB | 33.2 | 30.9 | 1.48×, 1.49× | 150,774 | 76% | 90,669 |
| 14 moves (50), 1 | full masks (down + up, 2 x uint32) | 1,176 MB | 30.1 | 26.1 | 1.63×, 1.65× | 83,013 | 87% | 156,602 |
| 14 moves (50), 1 | down masks packed (18 bits) | 331 MB | 34.6 | 30.0 | 1.42×, 1.44× | 150,774 | 76% | 90,669 |
| 16 moves (50), 1 | baseline | – | 7,231.1 | 7,921.9 | 1.00×, 1.00× | 87,239,984 | 0% | – |
| 16 moves (50), 1 | down masks (uint32) | 588 MB | 4,781.6 | 5,247.7 | 1.51×, 1.52× | 21,461,967 | 75% | 12,976,071 |
| 16 moves (50), 1 | full masks (down + up, 2 x uint32) | 1,176 MB | 4,317.0 | 4,680.9 | 1.68×, 1.69× | 11,833,724 | 86% | 22,531,184 |
| 16 moves (50), 1 | down masks packed (18 bits) | 331 MB | 4,965.4 | 5,175.6 | 1.46×, 1.47× | 21,461,967 | 75% | 12,976,071 |
| 16 moves (50), 2 | baseline | – | 3,444.6 | 3,693.9 | 1.00×, 1.00× | 87,258,184 | 0% | – |
| 16 moves (50), 2 | down masks (uint32) | 588 MB | 2,245.5 | 2,391.2 | 1.53×, 1.54× | 21,469,859 | 75% | 12,977,901 |
| 16 moves (50), 2 | full masks (down + up, 2 x uint32) | 1,176 MB | 2,049.5 | 2,114.1 | 1.68×, 1.68× | 11,841,078 | 86% | 22,534,528 |
| random states (2), 1 | baseline | – | 89,779.5 | 89,779.5 | 1.00×, 1.00× | 1,112,479,339 | 0% | – |
| random states (2), 1 | down masks (uint32) | 588 MB | 56,458.6 | 56,458.6 | 1.59×, 1.56× | 265,388,550 | 76% | 167,886,461 |

### Building and checking the masks

| Table | Entries | Build (4 threads) | Write | Down moves per entry | Up moves per entry | uint32 | 18-bit |
| --- | --: | --: | --: | --: | --: | --: | --: |
| corners_sym | 6,053,616 | 0.2 s | 0.2 s | 4.58 | 4.52 | 24 MB | 14 MB |
| phase1_sym | 140,908,410 | 6.1 s | 4.5 s | 3.89 | 3.89 | 564 MB | 317 MB |

**Mapping check:** 2,000,000 positions (half uniformly random, half random walks of 0–14 moves), 4 masked lookups each, 144,000,000 child lookups compared with the mapped masks: 0 wrong indices, 0 wrong down bits, 0 wrong up bits. Conjugating the wrong way round (`GRAV3_WRONG_FRAME=1`) gives 408,052 wrong down bits out of 14,400,000, so the check does catch a backwards map.

**Checks:** every solution replayed to solved; single-thread masked runs gave the baseline's solution, and per round children generated + skipped = the baseline's children generated, on every solve; 152 baseline node counts and 754 lengths equal lab/3x3's, 0 differences. Two-thread runs race in the final round, so only their proof rounds are compared: 50 baseline solves match lab/3x3 round by round, and masked runs' generated + skipped match the baseline's in every proof round. No run capped.
<!-- tables:end -->

## How the masks work

**Down mask.** For every entry e of `corners_sym` (6,053,616 entries) and `phase1_sym` (140,908,410), the 18-bit set of moves m whose neighbour in the table's own graph has value(e) − 1. The *up* mask (full masks only) holds the moves whose neighbour has value(e) + 1. The neighbour is the first entry `neighbours()` lists for m; the twins listed after it share its value. The build checks that no move changes a value by more than 1.

**Mapping a mask to the node's frame.** The search reads `corners_sym` at x through the class symmetry t of x's corner permutation. It reads `phase1_sym` along axis a (symmetry 0, 16 or 32), through the class symmetry t of the flip-slice coordinate seen along that axis. The entry then stands for Z = S_t Y S_t⁻¹, where Y = S_a x S_a⁻¹. Move m on x is move `AXMOVE[a][m]` on Y and `SYMMOVE[t][AXMOVE[a][m]]` on Z, because conjugation is a homomorphism and `SYMMOVE[t][k]` is the face turn S_t M_k S_t⁻¹. So bit m of x's mask is bit `SYMMOVE[t][AXMOVE[a][m]]` of the stored mask. For each of the 48 (a, t) pairs, three 64-entry tables map one 6-bit chunk each, so mapping a mask takes 3 lookups and 2 ORs.

**The search rule.** At every node with rem = bound − g ≥ 2 moves left:

- Every masked (direct) lookup with value rem contributes its mapped down mask, and the allowed moves are the AND of those masks.
- With full masks, every masked lookup with value rem − 1 also removes its mapped up mask.
- Only allowed moves are generated, in the usual order and with the usual face rules. Each one is read against all 7 lookups exactly as in lab/3x3's `dfs()`, group by group with prefetching.
- Each child's masked indices and frames are computed in that read anyway. They are kept, the masks of the survivors are prefetched, and the masks are read when the child is expanded.

**Why nothing that could survive is skipped.** The baseline keeps child y = x·m only if every lookup has v_l(y) ≤ rem − 1. A move changes a table value by at most 1, because the value is a distance in the table's graph and the move is one edge of it; the mask build asserts this on every entry. Take a masked lookup:

- **If v_l(x) = rem,** y survives only if v_l(y) = rem − 1. That holds exactly when m is in x's mapped down mask, because the mask holds the neighbours' values in the stored frame, and the mapping is checked below.
- **If v_l(x) = rem − 1,** y survives only if v_l(y) ≠ rem. That holds exactly when m is not in the mapped up mask.

So every child the masks skip is one the baseline generates and then cuts. Every child they let through is read in full, so its fate is the baseline's. The order is unchanged, so the search tree, the expansions and the solution are identical. The mask is well defined per entry, because every position that reads entry e has a Z with the same coordinate (class representative, twist). A move's effect on that coordinate, and so the neighbour's value, depends only on the coordinate. Inverse lookups get no masks (the move acts on the other side), and the last move (rem = 1, a test against solved) is unchanged.

## Caveats

- **Timing noise.** Each mode ran as its own process, one at a time, on a 4-core cloud VM. The modes took turns in chunks of 10 scrambles, so a drift in machine speed hits them alike. Each set was timed once, so a few percent between modes (uint32 against packed) is near the noise; the 1.4–1.7× gains are far above it.
- **The baseline is lab/3x3's `dfs()` in the same binary.** Its node counts equal lab/3x3's on every single-thread solve. On this idle machine it runs a 16-move solve in 7.2 s, against 9.6 s in lab/3x3's bench, which ran 4 solves at once. Comparisons with lab/3x3's other floors use ratios within that bench, not absolute times.
- **The 12-move set is too fast to time well.** Solves take about 1 ms, and times are stored to 0.1 ms.
- **Random states: only 2 solves, baseline and uint32 down masks.** They are lab/3x3's two cheapest desktop random states (#4 and #7). Full and packed masks were not timed on them.
- **Not tried:**
  - huge pages for the masks (transparent huge pages are opt-in on this machine)
  - packing full masks into 36 bits
  - masks for the inverse lookups, which can't have them
  - combining masks with a compass or with T6's ceiling race
