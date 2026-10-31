# T7 Combined native solver: race + masks + no idle thread

One native solver with T6's ceiling race, T3's downhill masks and a ceiling thread that helps prove once it stops improving, measured on 4 threads. Results: [FINDINGS.md](FINDINGS.md). Brief: [../T7-combined.md](../T7-combined.md) (issue #35, part of #20).

## What is here

| Path | What it is |
| --- | --- |
| `src/comb.c` | A copy of `lab/3x3/src/cube3.c`, unchanged apart from three `#include`s and the subcommands below |
| `src/gravity.inc` | T3's file, unchanged: mask build, mask check, packed masks, `gdfs`, `gsolve` |
| `src/ceiling.inc` | T6's file plus one hook: `ceil_check` asks an optional `yield` callback whether to stop and help |
| `src/combined.inc` | The pthread pool, the combined prover and `comb run` |
| `scripts/inputs.py` | Writes `data/in-*.txt` ("D scramble" per line, D from `lab/3x3/results/bench-*.json`; 0 = unknown) |
| `scripts/run.sh` | Every measurement, into `results/raw/*.jsonl`, one process at a time (skips files that exist) |
| `scripts/analyse.py` | Checks everything, writes `results/random-states.jsonl`, `results/frontier.json`, `results/summary.json` |

## Rerun

```sh
cd lab/speed/combined
make
CUBE3_TABLES=data/tables ./comb build corners_sym phase1_sym   # 8 s, into data/tables (gitignored)
CUBE3_TABLES=data/tables ./comb masks corners_sym phase1_sym   # 20 s, 1.2 GB of uint32 masks (packing reads the down masks)
scripts/run.sh                                                 # about 2 hours on 4 cores
python3 scripts/analyse.py
```

## `comb comb run <file> <split|race> <k> <masks 0|1> <help 0|1> <cap_s>`

- **Rounds.** lab/3x3's IDA* rounds. A round above depth 4 is split into the depth-3 subtrees that `collect()` builds. A pthread pool takes them from a shared list with an atomic next-task counter: any free thread takes the next subtree, and a thread can join a round that is already running (OpenMP's `parallel for` has a fixed team, so it cannot).
- **`split k`:** k prover threads (the main thread plus k − 1 pool threads). No ceiling.
- **`race k`:** k − 1 prover threads and T6's ceiling thread (trace from target 22, lowered after each solution), with T6's shared ceiling and stop rule unchanged: at every round start the prover publishes its bound and stops if the ceiling is ≤ it, and a ceiling solution ≤ the published bound raises the stop flag. The certificate: proven floor = ceiling.
- **`masks 1`:** every subtree runs T3's `gdfs` with the 18-bit packed down masks (mode 3), 331 MB.
- **`help 1`:** once the ceiling has not improved for max(`COMB_HELP_MIN`, `COMB_HELP_FRAC` × elapsed) seconds (defaults 5 and 0.25; checked every 20,000 ceiling nodes), the ceiling thread stops searching and joins the pool: it takes subtrees from the prover's current round and every later one. It stops on the same flag as the provers.
- Every solve is capped at `cap_s` by a watchdog thread. Every solution is replayed (abort if it doesn't solve), a certificate whose length differs from the proven floor aborts, and so does a length that differs from lab/3x3's.
- Output: one JSON line per solve with `ended` (`certificate`, `prover_find`, `helper_find` or `timeout`), `nodes_per_bound` as `[generated, skipped]`, `round_secs`, `helper_nodes_per_bound` as `[nodes, subtrees]`, `helped_at` (seconds, −1 if never) and the ceiling's trace `[seconds, length, nodes]`.

`comb gsolve` (T3's command, OpenMP split with `CUBE3_SPLIT=3`) is kept to check that the pool's node counts per proof round equal the OpenMP split's.
