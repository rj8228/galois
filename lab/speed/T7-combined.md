# T7 Combined native solver: race + masks + no idle thread

**Branch** `speed-combined` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/combined/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules and the result format. Round 2's results are in [SYNTHESIS-2.md](SYNTHESIS-2.md).

## Why

Round 2 built two levers separately, and both work:

- **The ceiling race** (T6, `lab/speed/ceiling/`). A two-phase solver on its own thread usually finds the optimal solution before the proof rounds end, so the prover only has to prove. At 16 moves it is 2.0× faster than the two-thread split.
- **Downhill masks** (T3, `lab/speed/gravity/`). 331 MB of 18-bit masks make every round 1.46× faster, with the search unchanged.

They have never run together, and the race has a weak spot:
- When the ceiling misses the optimum (3 of 18 random states within 250 s), its thread idles while the prover's final round runs on the other threads.
- And once the ceiling holds the optimal solution, its thread searches in vain for one move shorter until the proof catches up.

SYNTHESIS-2's estimate for 4 threads with both levers and that weak spot fixed: random states at a mean of about 96 s and a median of about 65 s, against 814 s on one thread (T6's machine). This task measures it.

## Goal

One native solver with the race, the masks and a ceiling thread that helps prove when it stops improving. Measure it on all 20 random states with 4 threads.

## Method

Priority: steps 1–4, and the random states in step 4. Step 5 only if time is left.

1. **Combine the code** in your folder.
   - Start from a copy of `lab/3x3/src/cube3.c`. Include T3's `gravity.inc` (mask build, packed masks, `gdfs`) and T6's `ceiling.inc` (two-phase solver, shared ceiling, certificate).
   - Make the race's prover use `gdfs` with packed masks instead of `dfs`.
   - Keep every check both tasks had:
     - solutions replayed
     - the certificate's length equals the proven floor
     - masked proof rounds generate + skip exactly the baseline's children
2. **A split that a thread can join late.** OpenMP's `parallel for` has a fixed team, so a ceiling thread can't join a running round.
   - Use pthreads with a shared task list per round: the subtrees at depth 2 or 3, as `collect()` builds them, and an atomic next-task counter.
   - Any thread that is free takes the next subtree.
   - Check that the node counts per proof round equal the OpenMP split's.
3. **The ceiling thread's policy.** It starts as T6's trace (target 22, lowered after each solution). Then:
   - **Help when stuck.** If the ceiling has not improved for max(5 s, 25% of the elapsed time), the thread takes subtrees from the prover's current round instead. That covers both cases:
     - it already holds the optimum and can't improve
     - it missed and the final round is running
   - **Keep the certificate.** The shared ceiling and the stop rule stay as T6 has them. A helping thread stops like the others.
   - Try the threshold as written and one other value. Report which is better.
   - Optional, if cheap: when the prover enters round B and the ceiling is B + 1, retarget the ceiling to exactly B.
4. **Measure on 4 threads** (`nproc` should be 4; if it is not, say so and use what there is).
   - Configurations:
     - (a) 4-thread split
     - (b) 4-thread split with masks
     - (c) race, 3 provers + ceiling (T6's `race 4`)
     - (d) race with masks
     - (e) race with masks and help-when-stuck
   - **16-move set (50):** all five.
   - **All 20 random states:** (e). Cap each at 30 min. The two that need 19 moves should end once bound 18 is cleared, estimated at 10–15 min.
   - **5 random states:** (b) and (c), for a measured comparison. Estimate the rest from `lab/3x3`'s node counts, as T6 did.
   - Report the mean, median and worst per configuration, and how each solve ended: the ceiling's certificate, the prover's own find, or a helping thread's find.
5. **If time is left:**
   - masks in the ceiling's phase-1 pruning
   - 2 threads (1 + 1) on the random states, to compare with T6's 315 s

## Setup

Build the desktop tables and the masks as `lab/speed/gravity/README.md` describes: about 25 s, and 1.2 GB of disk for the uint32 masks, which packing reads. Point `CUBE3_TABLES` at a git-ignored `data/` folder.

## Results

- **`results/frontier.json`** rows:
  - `"puzzle": "3x3"`
  - `impl` set to `c-4t-split`, `c-4t-split-masks`, `c-4t-race`, `c-4t-race-masks` and `c-4t-race-masks-help`
  - `mean_ms` filled in
  - mask bytes in `extra_bytes`
- **`results/random-states.jsonl`:** one line per solve: D, time, how it ended, and nodes per round.
- **`FINDINGS.md`,** verdict first:
  - the measured random-state times against SYNTHESIS-2's estimate
  - what each lever added
  - whether help-when-stuck removed the tail

## Done when

- The combined solver is verified: replay, lengths against `lab/3x3`, the certificate check, and masked rounds equal to the baseline's.
- All 20 random states are measured with (e).
- The comparison on the 16-move set is done.
- The pull request is open into `phase-8-speed-lab`.

**Time box: about 2 hours of session time.** Push checkpoints every hour. Run the random states early, in the background, while you write up the rest.
