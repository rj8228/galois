# T6 Ceiling race: let the ceiling find, so the prover only proves

**Branch** `speed-ceiling` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/ceiling/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules and the result format. Round 1's results are in [SYNTHESIS.md](SYNTHESIS.md).

## Why

An optimal solve has two jobs. The proof rounds show that nothing shorter than D moves exists. The final round then searches for a D-move solution. On the 3×3 the final round is most of the work: 82–86% at 14–16 moves, and 76% on random states (`anatomy3/FINDINGS.md`).

The framework already has a way to finish without the final round. A **ceiling** is any solution, and once it is as short as the proven floor, it is optimal. The app's 3×3 engine (`src/solver3`) stops this way when its bound reaches the cubing.js ceiling. But that ceiling is about 20 moves, so the final round still runs. `lab/3x3`'s solver has no ceiling at all.

So run a strong ceiling solver alongside the prover. If, by the time the proof rounds end, the ceiling has found a solution of the proven length, the solve is over.

`lab/3x3/results/bench-random-state.json` shows what is at stake. It covers 20 random states on the desktop set `C8s+P1x3i`, one thread per solve, 9.1 M nodes per second:

| Random states | Proof rounds | Final round | Whole solve |
|---|--:|--:|--:|
| 18 moves (16 of them) | 168–285 s (mean 208 s) | 15–1,473 s | up to 28 min |
| 17 moves (2) | 19 s | 14 s and 192 s | 33 s and 211 s |
| 19 or more (2) | bound 18 ran out after 46–47 min | bound 19 hit the node cap | not finished |

- **If the ceiling always won in time,** the mean over the 18 solved positions would fall from 690 s to 187 s, which is 3.7×. The worst case would fall from 28 minutes to under 5.
- **The two unfinished positions would finish in about 47 minutes,** if they need 19 moves. Nearly every such position does: only about 490 million positions need 20. A two-phase solver finds 19 moves in milliseconds; only the proof is hard.

**The open question is how fast a two-phase solver reaches the optimal length.** csTimer's min2phase averages 19.1 moves on random states after 36 ms, and 18.6 moves with ten times more search ([source](https://cuberoot.me/code/algorithms/min2phase)). So 18 moves may take seconds, and 17 much longer. The proof leaves it about 200 s for an 18-move position, but only about 19 s for a 17-move one. Our ceiling can also use the lab's exact phase-1 table, which min2phase doesn't have.

## Goal

Build a two-phase ceiling solver in C and measure how fast it reaches the optimal length. Then measure the race: the prover and the ceiling on two threads, against one thread and against the two-thread split `lab/3x3` already has.

## Method

Priority: steps 1–3. Do steps 4 and 5 only if time is left.

1. **A two-phase solver in C,** in your folder, built on a copy of `lab/3x3/src/cube3.c`. That file already has the cube model, moves, symmetries (`SYMMOVE`, `AXMOVE`), the phase-1 coordinates, and the 16-symmetry-reduced phase-1 table (`phase1_sym`), which holds the exact phase-1 distance.
   - **Phase 1** reaches H = ⟨U, D, R2, L2, F2, B2⟩, pruned by the exact phase-1 table.
     - For each phase-1 length a, from the phase-1 distance up to the target T, list the phase-1 sequences of length a that end in H.
     - Their last move must not be in H, so it is a quarter turn of R, L, F or B. That avoids repeats.
     - Optional and safe: also prune phase 1 by the full desktop floor against the target, h(node) ≤ T − g. This is the prover's own rule and should help most near optimal targets.
   - **Phase 2** stays inside H, using new tables built by breadth-first search with the 10 moves of H:
     - corner permutation × UD-slice permutation (40,320 × 24)
     - UD-edge permutation × UD-slice permutation (40,320 × 24)
     - Its first move must avoid the face of phase 1's last move.
   - **Completeness.** This finds a solution of length ≤ T whenever one exists, given time. Cut any solution where its final run of H moves begins: the part before is a phase-1 solution whose last move is not in H.
   - **Six variants:** x and x⁻¹, each along the three axes. Conjugate by symmetry 16 or 32 to put the axis on U–D, then map the solution back. Interleave the variants so each gets a fair share; min2phase does this.
   - **API:** `ceiling(x, T, deadline)` returns a solution of length ≤ T or fails. A **trace mode** starts with no target and lowers it after each solution (22, then 21, and so on), logging the time and length each time.
   - **Checks:**
     - Replay every solution to solved.
     - No solution may ever be shorter than the known optimum from `lab/3x3/results`. A shorter one means a bug in one of the two solvers.
2. **Finder duel: two-phase against the final round.** For each position with a known optimal length D:
   - Time the two-phase search with target D (all six variants, capped).
   - Compare it with the prover's final round at bound D and with its proof rounds (all bounds below D).
   - Also run the trace from scratch, with no target, and record when it first reaches D.
   - The proof/final split is already measured; convert nodes to seconds with nodes per second measured on your machine:
     - `lab/3x3/results/bench-*.json` (`nodes_per_bound`, desktop set)
     - `lab/speed/anatomy3/results/raw/*.jsonl` (lookups per round)
   - Don't rerun the 2-hour random-state benchmark.
   - **Sets:** 14 and 16 moves (50 each), and the 20 random states in `lab/3x3/scrambles/random-state.txt`.
3. **The race, simulated and then real.**
   - **Simulated from step 2's traces** (the ceiling doesn't know D). The race ends at max(proof time, time the ceiling reaches D) if that comes before the prover would finish alone; otherwise it ends at the prover's own total.
   - **Real.** One thread runs `lab/3x3`'s IDA\*, and another runs the trace-mode two-phase; they share an atomic ceiling.
     - The prover stops when its bound reaches the ceiling: the proven floor equals the ceiling, which is the certificate.
     - It checks at round boundaries and, during the final round, every few thousand nodes. `dfs` already polls a stop flag in split mode.
     - Run it on the 14- and 16-move sets and on a few random states, each with a cap.
   - **Compare** against one thread and against `lab/3x3`'s two-thread split (`CUBE3_SPLIT`, OpenMP), on the same machine. Expect the race to beat the split when the final round is more than half the work.
   - **If the machine has more cores** (`nproc`), also try k − 1 prover threads with one ceiling thread against a k-thread split.
   - **Variants, if cheap:**
     - Once the proof ends, switch the ceiling to target exactly D.
     - Let the prover's thread join the hunt instead of running the final round itself.
4. **The ceiling as a compass** (if time is left).
   - At the first one or two levels of the final round, probe each surviving child with a short two-phase budget (1, 10 and 100 ms). Try the children in order of probe length.
   - Stop early if a probe meets the remaining bound.
   - Report:
     - the rank of the child that lies on the found solution's path (anatomy3's perfect-compass data has the path)
     - the final round's lookups and time, with the probes included
5. **Twin check** (if cheap).
   - The desktop floor gives a position and all 96 of its symmetric and inverse twins the same value, because it reads every table along all three axes and on the inverse.
   - So conjugates search the same tree, only in a different move order. Only x⁻¹ searches a different one.
   - On the 14- and 16-move sets, compare the proof cost of x with that of x⁻¹, and say whether racing them could beat a plain split.

## Setup

`make` and `./cube3 build corners_sym phase1_sym` in a copy of `lab/3x3` builds the desktop tables in under a minute. Point `CUBE3_TABLES` at a git-ignored `data/` folder, as `lab/speed/anatomy3/README.md` does. The random-state solves take minutes each, so cap them and run two at a time if you have the cores.

## Results

- **`results/frontier.json`** rows:
  - `"puzzle": "3x3"` and `"floor": "C8s+P1x3i"`
  - `impl` set to `c-1t`, `c-2t-split`, `c-2t-race` and so on, with `mean_ms` filled in
  - the ceiling's work in `mean_extra_work`, in milliseconds or nodes
- **`results/traces.jsonl`:** one line per position with the trace, D, and the proof and final times.
- **`FINDINGS.md`,** verdict first:
  - how often and how fast the ceiling reaches the optimum, by distance
  - the race against the split
  - what a random state's solve time becomes, mean and worst
  - what is left: the proof rounds, which is T3's target

## Done when

- The two-phase solver is verified.
- The finder duel and the race are measured on the 14- and 16-move sets and on the random states (with caps).
- A clear yes or no on the race is written down.
- The pull request is open into `phase-8-speed-lab`.

**Time box: about 2 hours of session time.** Push checkpoints every hour. If the random states run long, report what finished, with caveats.
