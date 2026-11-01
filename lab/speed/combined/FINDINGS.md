# T7 findings: race + masks + a ceiling thread that helps

Brief: [../T7-combined.md](../T7-combined.md) (issue #35). How to rerun: [README.md](README.md). Machine: 4 cores (`nproc` = 4), 15 GB, **5.14 M nodes/s per thread for lab/3x3's prover, 0.67× T6's machine** (7.71 M). All times below are this machine's.

## Verdict

- **Measured on all 20 random states, 4 threads (3 masked provers + a ceiling thread that helps): mean 177 s, median 72 s, worst 738 s.** On the 18 states whose optimum lab/3x3 knows: **mean 115 s, median 70 s, worst 398 s.** Every solve is optimal and verified; 13 ended by the ceiling's certificate, 6 by the prover's own find and 1 by the helping ceiling thread's find.
- **Against SYNTHESIS-2's estimate** (mean 96 s, median 65 s, worst 285 s on T6's machine, ≈ 144 / 98 / 428 s at this machine's speed): the 18 known states come in **below the estimate once machine speed is accounted for** (115 / 70 / 398 s). The two 19-move states are not in that picture. Each needs bound 18 cleared, 23–24 G nodes, and took 737 s and 738 s here. They are the whole difference between the 18-state and 20-state means.
- **Against one thread** (lab/3x3's node counts at 5.14 M nodes/s): the 18 known states would take a mean of 1,223 s (20 min) and a median of 966 s. The combined solver is **10.6× faster on the mean and 13.8× on the median**, on 4 threads.
- **What each lever adds** (16-move set, all 50, measured; random states, estimated from lab/3x3's node counts at rates measured here, checked against 3 measured states):

  | Configuration | 16-move mean | 16-move median | Random (18 known) mean | median | worst |
  |---|--:|--:|--:|--:|--:|
  | (a) 4-thread split | 3.75 s | 3.98 s | 270 s (est.) | 214 s | 657 s |
  | (b) 4-thread split + masks | 2.44 s | 2.54 s | 173 s (est.) | 137 s | 422 s |
  | (c) race, 3 provers + ceiling | 2.14 s | 1.04 s | 169 s (est.) | 106 s | 592 s |
  | (d) race + masks | 1.64 s | 0.82 s | 127 s (est.) | 70 s | 413 s |
  | **(e) race + masks + help** | **1.52 s** | 0.86 s | **115 s (measured)** | **70 s** | **398 s** |

  - Masks: 1.54× on the split at 16 moves (1.56× in baseline nodes per second on random states, 36.2 M against 23.2 M).
  - The race: 1.75× over the split at 16 moves, 1.6× on random states. It works by skipping the final round, so it pays most where the final round is big.
  - The two together: 2.3× at 16 moves, 2.1× on random states, close to the product of the two.
  - Help: another 8% at 16 moves and 10% on the random-state mean (127 → 115 s).
- **Help-when-stuck as the brief wrote it doesn't work.** The rule is "the ceiling has not improved for max(5 s, 25% of the elapsed time)". The ceiling reaches 19–20 moves within milliseconds and then often needs 10–60 s to reach 18, so the rule fires at exactly 5 s on every random state and throws away most of the race. A 60 s floor is worse in the other direction: it idles the thread through proof rounds when the ceiling already holds the optimum. **What works is a rule tied to the prover: help once ceiling ≤ bound + 1.** By then the ceiling either holds the optimum (the round is pure proof) or can only win by finding a solution of exactly the bound, which the prover is searching for anyway. This rule was used for (e).
- **Did help remove the tail? It shortened it but didn't remove it.** The tail is now the final round itself when the ceiling misses the optimum (states 0, 1, 2, 8, 15 and 19). The worst is 398 s: state 1, with 13.4 G nodes in round 18. Help runs that round on 4 threads instead of 3: state 1 is 398 s against an estimated 439 s without help, and state 15 is 291 s against 383 s.

## Random states, (e), one line each

Bound rule. "Ceiling at D" is when the ceiling thread first held an optimal solution; "help" is when it started taking subtrees. "1 thread" is lab/3x3's measured time on its own machine.

| # | D | Time | Ended by | Ceiling at D | Help from | lab/3x3, 1 thread |
|--:|--:|--:|---|--:|--:|--:|
| 0 | 18 | 71.0 s | prover find | – | 61.5 s | 229 s |
| 1 | 18 | 398.0 s | prover find | – | 55.7 s | 1,617 s |
| 2 | 18 | 142.9 s | prover find | – | 86.9 s | 477 s |
| 3 | 18 | 54.5 s | certificate | 0.1 s | 5.0 s | 1,675 s |
| 4 | 17 | 13.5 s | certificate | 13.5 s | – | 208 s |
| 5 | 18 | 49.7 s | certificate | 2.5 s | 5.3 s | 424 s |
| 6 | 18 | 48.3 s | certificate | 1.3 s | 4.8 s | 470 s |
| 7 | 17 | 9.8 s | prover find | – | 6.2 s | 33 s |
| 8 | 18 | 165.5 s | helper find | – | 56.2 s | 617 s |
| 9 | 18 | 72.4 s | certificate | 2.3 s | 7.2 s | 726 s |
| 10 | 18 | 79.5 s | certificate | 9.9 s | 9.9 s | 293 s |
| 11 | 18 | 68.9 s | certificate | 63.3 s | 63.3 s | 302 s |
| 12 | 18 | 72.0 s | certificate | 59.0 s | 59.0 s | 472 s |
| 13 | 18 | 58.5 s | certificate | 36.7 s | 36.7 s | 746 s |
| 14 | 19 | 737.0 s | certificate (bound 18 cleared) | 0.0 s | 79.5 s | unsolved in 3,363 s |
| 15 | 18 | 290.9 s | prover find | – | 62.3 s | 1,147 s |
| 16 | 18 | 38.5 s | certificate | 2.7 s | 3.4 s | 950 s |
| 17 | 18 | 53.6 s | certificate | 16.7 s | 16.7 s | 608 s |
| 18 | 19 | 737.9 s | certificate (bound 18 cleared) | 24.4 s | 69.4 s | unsolved in 3,500 s |
| 19 | 18 | 375.8 s | prover find | – | 77.6 s | 1,417 s |

- States 14 and 18 are the two that lab/3x3 never finished. **Both are now proven to need 19 moves**: bound 18 cleared, a 19-move ceiling solution replayed.
- With the brief's 5 s rule, states 10, 11, 12, 13 and 17 would have lost their certificate: the ceiling found 18 at 9.9–63 s, after the rule had already sent it to help.

## Help threshold, measured on the same states

| Rule | States 0–4: mean | median | States 0–7: mean |
|---|--:|--:|--:|
| max(5 s, 25% of elapsed), as in the brief | 136.0 s | 55.8 s | – |
| max(60 s, 25% of elapsed) | 145.5 s | 73.7 s | 109.8 s |
| **ceiling ≤ bound + 1** | 136.0 s | 71.0 s | **98.5 s** |

- On states 0–4 the bound rule ties the 5 s rule. The 5 s rule wins states 0–2, where the ceiling misses: one more thread through the proof saves 4–19 s. The bound rule wins state 4 (13.5 s against 53.1 s), where the ceiling finds 17 after the 5 s mark.
- Over all 20, the bound rule's advantage is the five certificates above. The 5 s rule was cut after 5 states to stay in the time box, so this rests on the per-state times: those five states would each have needed their final round instead, estimated at 25–120 s each.
- A better rule probably exists: help through the proof as well, if the ceiling's chances are low. Nothing here predicts those chances yet.
- The optional retarget (ceiling = B + 1 when the prover enters round B → retarget to exactly B) is already what T6's trace does: after a solution of length L its target is L − 1.

## How the ceiling thread's speed matters

- Next to three provers, the ceiling searches at about 5.8 M nodes/s, against 10.3 M/s in T6's duel. Its time to the optimum is about 1.65× T6's (median over 4 states where both reached it after 1 s).
- So the ceiling reaches 18 before the proof ends (about 50–60 s here) only when T6's trace had it there within about 35 s: 11 of the 18 known states ended by certificate.
- Masks in the ceiling's phase-1 pruning (step 5) and the 2-thread comparison were not done.

## Checks

- **Replay:** every returned solution is replayed by `comb` (it aborts otherwise): 20 + 13 random-state solves in the threshold runs, 6 more in (b) and (c), and 250 at 16 moves.
- **Lengths:** every length equals lab/3x3's where it is known (18 random states, all 50 at 16 moves).
- **Certificate:** every certificate's length equals the proven floor (`comb` aborts otherwise; `analyse.py` checks again).
- **Node counts:**
  - **Against lab/3x3:** every cleared proof round's count (generated + skipped) equals lab/3x3's single-thread count, in every configuration. That is 299 rounds per configuration at 16 moves, 155 rounds on the 20 random states with (e), and 95 more in the threshold runs.
  - **Masks:** in masked runs, generated + skipped equals the unmasked run's children in all 299 cleared rounds at 16 moves, for each of (b), (d) and (e).
  - **Against the OpenMP split:** before the runs, on 5 sixteen-move positions with and without masks, the pthread pool's counts per proof round equalled T3's `gsolve` with `CUBE3_SPLIT=3` on 4 OpenMP threads.
- **Helper path:** with the threshold forced to 0, the ceiling thread joins from the first pooled round, and solutions it finds are replayed and of the right length (5 positions).
- **Estimates:** the model behind the (a)–(d) random-state estimates uses lab/3x3's per-round node counts, the per-round rates measured here, and T6's traces scaled by the measured 1.65×. It predicts the measured runs on states 0, 3 and 4 closely: (b) 177.4 s against 180.0 s measured, (c) 72.9 s against 72.8 s.

## Caveats

- (b) and (c) were measured on 3 random states (0, 3, 4), not 5, to fit the time box. (a) and (d) on random states are estimates only.
- The one-thread rate (5.14 M nodes/s) comes from 5 sixteen-move solves. 4-thread rates are 4.5× that (split), so either this machine's single core was slow during that run, or the split scales slightly superlinearly here. Speedups against one thread may be overstated by up to about 10%.
- One machine, one run per configuration. The 16-move race times vary by tens of milliseconds between runs.
