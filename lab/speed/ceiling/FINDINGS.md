# T6 Ceiling race: findings

Speed lab task T6 (issue #29, part of #20). Question: if a two-phase solver hunts for a short solution while the prover proves, how often has it found the optimal one by the time the proof ends, and does racing the two on two threads beat simply splitting the prover over two threads? Measured with a new two-phase solver in C (`src/ceiling.inc`) and `lab/3x3`'s IDA\* on the desktop set `C8s+P1x3i`. How to rerun: [README.md](README.md).

## Verdict

**Yes, race.** The two-phase ceiling usually finds the optimal solution long before the prover's final round would, and often before the proof rounds even end. On 16-move positions the real two-thread race is **2.0× faster than the two-thread split and 4.2× faster than one thread**.

- **The ceiling reaches the optimum often, and fast.** Trace mode starts with no target and lowers it after every solution.
  - 14 moves: it reached the optimum on 50 of 50, median 0.05 s, worst 1.8 s.
  - 16 moves: 50 of 50, median 0.6 s, worst 53 s.
  - Random states (17–18 moves): 15 of 18 within a 250 s cap, median 8 s at 18 moves (all 16 known 18-movers: median 18 s). It reaches 19 moves in milliseconds and 18 moves in 0.1–250 s.
- **It usually beats the prover's own final round.** With the target set to the known optimum D, the two-phase search was faster than the prover's final round on 37 of 50 positions at 14 moves, 44 of 50 at 16 moves and 12 of 18 random states.
- **It usually finishes before the proof does.** That is the condition for the race to cost no more than the proof. It held on 18 of 50 positions at 14 moves (the proof takes only 12 ms there), 33 of 50 at 16 moves, and 14 of 18 random states (the proof takes about 220 s there).
- **The real race, one solve at a time, desktop floor:**

  | Set | One thread | Two-thread split | Two-thread race | Race against split | Ended by the ceiling |
  | --- | --: | --: | --: | --: | --: |
  | 14 moves (50) | 88 ms | 41 ms | 41 ms | 1.0× | 28 of 50 |
  | 16 moves (50) | 11.3 s (worst 26.3 s) | 5.4 s (worst 12.5 s) | **2.7 s** (worst 13.0 s) | **2.0×** | 46 of 50 |

  - At 14 moves the whole solve takes about 0.1 s, so the race only ties.
  - At 16 moves the final round is 85% of the work, and the race wins clearly. The split cuts every round in half. The race removes most of the final round, leaving the proof (1.7 s) plus a little.
  - The race loses to the split on 10 of the 50 positions. Four of those are positions where the prover found the solution itself before the ceiling did (then the race is just one thread). On the other six the ceiling won, but later than the split would have finished.
- **Random states (simulated from the duel traces, one prover thread):**
  - The mean over the 18 solved positions falls from 814 s to 315 s (**2.6×**).
  - The worst falls from 33 min to 22 min. That worst case is position 15, where the ceiling did not reach 18 moves within its 250 s cap. Positions 8 and 7 were also capped. For the rest, the solve becomes the proof: 198–336 s.
  - Times are this machine's: 7.71 M nodes per second, measured with two other cores busy. `lab/3x3` measured 9.1 M, so its 690 s mean is 814 s here.
  - **The two unfinished positions** (14 and 18) got 19-move ceilings after 0.007 s and 13.8 s. If they need 19 moves, the race ends the moment bound 18 is exhausted, about 47 min in `lab/3x3`'s run (65 min at this machine's speed). Without the ceiling, that is where the final round at bound 19 would begin, and it hit the node cap in `lab/3x3`.
  - **The real two-thread race on random states 0–2 confirms the simulation:** 222, 249 and 296 s, against 271, 1,937 and 569 s for the prover alone. All three were ended by the ceiling.
- **What is left is the proof.** With the race, an optimal 3×3 solve costs about the proof rounds plus a small tail. That is about 15% of today's single-thread work at 16 moves, and 27–40% on random states. The proof rounds are T3's target (downhill masks), and they are now nearly all of the time.

**Recommendation for the app's 3×3 engine:** run a two-phase ceiling on its own thread, a Web Worker, next to the prover. Have the prover stop when its bound reaches the ceiling. The ceiling needs 2 × 0.97 MB of phase-2 tables on top of the floor's phase-1 table, which it reuses. It also reuses the desktop floor itself as phase-1 pruning, and that halves its time on the hardest 16-move positions.

## Not done (time box)

- **More than two threads** (3 prover threads with 1 ceiling thread against a 4-thread split) was not measured. The commands support it (`race ceil run <file> race 4` and `split 4`) and `scripts/run.sh` lists the runs.
- **The variants from step 3** (switching the ceiling to target exactly D, the prover joining the hunt) were not tried.
- **Step 4** (the ceiling as a compass) and **step 5** (the twin check) were not run.

## Results

### Finder duel

For each position: *target D* is the two-phase search told the optimal length (first solution of length ≤ D, all six variants, capped). *Trace* starts at 22 with no target and lowers it after each solution; the time is when it first reached D. Prover times are per round. At 14 and 16 moves they come from our own one-thread runs (`run-*-1t1`). For random states they are `lab/3x3`'s node counts divided by 7.71 M nodes per second. Duel runs used four positions at a time (two for random states), so their times include some memory contention.

| Set | D | Target D found (cap) | Target D median | Trace reached D (cap) | Trace median, worst | Trace before proof end | Proof mean | Final round mean | Target faster than final round |
| --- | --- | --: | --: | --: | --: | --: | --: | --: | --: |
| 14 moves | 11–14 | 50/50 (30 s) | 0.013 s | 50/50 (30 s) | 0.05 s, 1.8 s | 18/50 | 0.012 s | 0.076 s | 37/50 |
| 16 moves | 14–16 | 50/50 (60 s) | 0.45 s | 50/50 (60 s) | 0.6 s, 53 s | 33/50 | 1.67 s | 9.6 s | 44/50 |
| Random states | 17 (2) | 1/2 (120 s) | – | 1/2 (250 s) | 8.2 s | 1/2 | 22 s | 122 s | – |
| Random states | 18 (16) | 12/16 (120 s) | – | 14/16 (250 s) | 18 s, 249 s | 13/16 | 245 s | 652 s | – |

Random state 7 (17 moves) is the clearest miss. Its proof takes 22 s and its final round 17 s, and the ceiling sat at 18 moves for 250 s. Short random states are where the two-phase solver struggles most. It has to find a 17-move solution, which is rare, in a very short proof window.

### Simulated race (random states)

The race ends at max(proof, time the trace reaches D) if that comes before the prover would finish alone; otherwise at the prover's total. One prover thread, seconds at 7.71 M nodes per second.

| # | D | Proof | Final round | Prover alone | Trace reaches D | Race |
| --: | --: | --: | --: | --: | --: | --: |
| 0 | 18 | 224 | 47 | 271 | 52.8 | 224 |
| 1 | 18 | 205 | 1,732 | 1,937 | 249.4 | 249 |
| 2 | 18 | 309 | 260 | 569 | 109.7 | 309 |
| 3 | 18 | 240 | 1,739 | 1,979 | 0.06 | 240 |
| 4 | 17 | 22 | 227 | 249 | 8.2 | 22 |
| 5 | 18 | 241 | 261 | 502 | 1.5 | 241 |
| 6 | 18 | 221 | 328 | 549 | 0.8 | 221 |
| 7 | 17 | 22 | 17 | 39 | > 250 | 39 |
| 8 | 18 | 208 | 519 | 727 | > 250 | 727 |
| 9 | 18 | 303 | 553 | 856 | 1.3 | 303 |
| 10 | 18 | 336 | 18 | 354 | 4.7 | 336 |
| 11 | 18 | 237 | 124 | 361 | 34.2 | 237 |
| 12 | 18 | 253 | 296 | 548 | 32.8 | 253 |
| 13 | 18 | 223 | 651 | 874 | 17.9 | 223 |
| 15 | 18 | 224 | 1,115 | 1,340 | > 250 | 1,340 |
| 16 | 18 | 198 | 931 | 1,129 | 1.6 | 198 |
| 17 | 18 | 232 | 486 | 718 | 8.3 | 232 |
| 19 | 18 | 273 | 1,379 | 1,652 | 184.2 | 273 |
| **mean** | | **221** | **593** | **814** | | **315** |

Positions 7, 8 and 15 were capped at 250 s. With a longer trace, positions 8 and 15 would have ended no later than their totals and probably far earlier, so 315 s is pessimistic.

### Real race (random states)

Two threads, one prover thread and one ceiling thread, one solve at a time, on the first three random states.

| # | D | Prover alone (simulated above) | Real race | Simulated race | Ended by | Ceiling reached D at |
| --: | --: | --: | --: | --: | --- | --: |
| 0 | 18 | 271 s | 222 s | 224 s | ceiling, when bound 18 began | 51.6 s |
| 1 | 18 | 1,937 s | 249 s | 249 s | ceiling, 49 s into the final round | 249.3 s |
| 2 | 18 | 569 s | 296 s | 309 s | ceiling, when bound 18 began | 104.9 s |

The real race agrees with the simulation to within 4%. Position 1 is 7.8× faster than the prover alone.

### Files

- `results/summary.json`: every number above.
- `results/traces.jsonl`: one line per position, with D, the trace, the proof and final-round times, the target-D time and the simulated race.
- `results/frontier.json`: `c-1t`, `c-2t-split`, `c-2t-race` rows (`mean_extra_work` is the ceiling's nodes).
- `results/raw/`: the solver's output.

## How it was checked

- **Every solution is replayed.** Every two-phase solution is replayed on the scrambled position inside the solver; one that does not solve the position aborts the run. Every race result is replayed again.
- **No ceiling solution was ever shorter than the known optimum.** Every duel row is checked against `lab/3x3`'s length (`shorter_than_D` is false on all 120). Every race length equals `lab/3x3`'s.
- **A ceiling certificate must have the proven floor's length.** The race asserts that the ceiling's length equals the prover's current bound whenever the ceiling ends a solve. It held on all 77 such solves.
- **Selftest.** `race ceil selftest` checks the phase-2 move tables, checks that both breadth-first tables reach every entry (maxima 14 and 12, as expected for phase 2), and solves random positions in trace mode, replaying each solution.
- **Caveats.**
  - The duel ran 2–4 positions at a time. The real-race comparisons (1t, split, race) ran one solve at a time, but alongside the random-state duel on the other two cores, so all three modes saw the same background load.
  - Random-state prover times are converted from node counts, not rerun, as the brief asked.
