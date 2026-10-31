# T3 Gravity on the 3×3: findings

Speed lab task T3 (issue #23, part of #20). The question: do stored downhill masks make the desktop set `C8s+P1x3i` faster? The masks skip the children that would be cut on arrival, without changing a single expansion. How to rerun: [README.md](README.md).

## Verdict

VERDICT

## Results

<!-- tables:start -->
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

CAVEATS
