# T6 Ceiling race

A two-phase ceiling solver in C, raced against `lab/3x3`'s IDA\* prover: the prover only has to prove, the ceiling finds. Results: [FINDINGS.md](FINDINGS.md). Brief: [../T6-ceiling-race.md](../T6-ceiling-race.md).

## What is here

| Path | What it is |
| --- | --- |
| `src/race.c` | A copy of `lab/3x3/src/cube3.c`, unchanged apart from one `#include` and one subcommand (`ceil`) |
| `src/ceiling.inc` | The two-phase solver, the prover with a shared ceiling, and the `ceil` commands |
| `scripts/inputs.py` | Writes `data/in-*.txt` ("D scramble" per line, D from `lab/3x3/results/bench-*.json`) |
| `scripts/run.sh` | Every measurement, into `results/raw/*.jsonl` (skips files that exist) |
| `scripts/analyse.py` | Checks everything, writes `results/summary.json`, `results/traces.jsonl`, `results/frontier.json` |

## Rerun

```sh
cd lab/speed/ceiling
make
(cd ../../3x3 && make && CUBE3_TABLES=../speed/ceiling/data/tables ./cube3 build corners_sym phase1_sym)  # 10 s
CUBE3_TABLES=data/tables ./race ceil selftest 20    # phase-2 tables, 20 random positions, every solution replayed
scripts/run.sh
python3 scripts/analyse.py
```

## Commands

- `race ceil duel <file> <capD> <capT> [fullfloor]`: per position, the two-phase search with target D (stops at the first solution of length ≤ D, capped at `capD` seconds), then a trace from scratch (target 22, lowered after every solution, stops on reaching D or after `capT` seconds). Four positions at a time (OpenMP).
- `race ceil run <file> <1t|split|race> <k> <cap>`: one solve at a time. `1t`: the prover alone. `split k`: `lab/3x3`'s depth-3 split over k threads. `race k`: k − 1 prover threads (split when k − 1 > 1) and one ceiling thread in trace mode, sharing an atomic ceiling.

## How the two-phase solver works

- **Phase 1** reaches H = ⟨U, D, R2, L2, F2, B2⟩. For each phase-1 length a it lists the canonical move sequences of length a that end in H with a quarter turn of R, L, F or B, pruned by the exact phase-1 table (`phase1_sym`, the desktop set's own). It is also pruned by the whole desktop floor `C8s+P1x3i` against the target: a node after g moves must have floor ≤ T − g, the prover's own rule (this halves the time to the optimum on the hardest 16-move positions).
- **Phase 2** stays in H with the 10 moves of H, IDA\* from its floor up to T − a, pruned by two new breadth-first tables: corner permutation × UD-slice permutation and UD-edge permutation × UD-slice permutation (40,320 × 24 bytes each, built at start-up in about 0.1 s; maxima 14 and 12). Its first move follows the prover's move rules relative to phase 1's last move.
- **Completeness**: take any solution in canonical move order and cut it where its final run of H moves begins; the part before is a phase-1 sequence ending in a non-H move, the part after a phase-2 sequence. So with target T it finds a solution of length ≤ T whenever one exists.
- **Six variants**: x and x⁻¹, conjugated by symmetries 0, 16 and 32 to bring each axis onto U–D. They are interleaved by phase-1 length: length a for all six, then a + 1. Solutions are mapped back (conjugate each move, and reverse and invert for x⁻¹) and **replayed on x**; a solution that does not solve aborts the program.
- **Trace mode** starts at target 22 and sets the target to L − 1 after each solution of length L, continuing the same search (the part already searched held nothing of the old target, so nothing of the new one either). It stops when the target drops below the position's floor (then the ceiling has proven optimality itself), on a deadline, or when told to.

## How the race works

- The prover is `lab/3x3`'s `solve()` with three changes: an external stop flag, which its `dfs` already polls after every child; it publishes its current bound (the proven floor) at every round start; and at every round start it stops if the shared ceiling is ≤ the bound.
- The ceiling thread publishes every solution to the shared ceiling. If it is ≤ the prover's current bound it raises the stop flag: the proven floor equals the ceiling, which is the certificate. The prover's final round then stops within a few thousand nodes.
- When the prover finds a solution itself, it raises the stop flag and the ceiling thread stops.
- Every returned solution is replayed, its length is checked against the known optimum from `lab/3x3`, and a ceiling certificate whose length differs from the proven floor aborts the program.
