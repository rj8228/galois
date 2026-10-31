# T3 Gravity on the 3×3: downhill masks

Do stored downhill masks make the desktop set `C8s+P1x3i` faster? The masks skip children that would be cut on arrival without generating them. Results: [FINDINGS.md](FINDINGS.md). Brief: [../T3-gravity.md](../T3-gravity.md) (issue #23, part of #20).

## What is here

| Path | What it is |
| --- | --- |
| `src/grav3.c` | A copy of `lab/3x3/src/cube3.c`, unchanged apart from one `#include` and four subcommands |
| `src/gravity.inc` | Mask build, mask check and the masked IDA* (`gdfs`, `gsolve`) |
| `scripts/run.sh` | The mask check and every timed run; writes `results/raw/*.jsonl` and skips files that already exist |
| `scripts/analyse.py` | Checks everything, then writes `results/gravity.json`, `results/frontier.json` and the tables in FINDINGS.md |
| `results/maskcheck*.json` | The mapping check, plus the same check with the conjugation deliberately backwards |

## Rerun

```sh
cd lab/speed/gravity
make
CUBE3_TABLES=data/tables ./grav3 build corners_sym phase1_sym   # 5 s, into data/tables (gitignored)
CUBE3_TABLES=data/tables ./grav3 masks corners_sym phase1_sym   # 7 s + 5 s to write 1.2 GB of masks
scripts/run.sh                                                  # about 45 minutes, one process at a time
python3 scripts/analyse.py
```

## Subcommands

- `grav3 masks <table>...`: for each entry, the 18-bit set of moves whose neighbour is one lower (`down32.bin`) and one higher (`up32.bin`), one `uint32_t` per entry. The build stops if any move changes a value by more than 1.
- `grav3 maskcheck <floor> <n>`: on n positions (half uniformly random, half random walks of 0–14 moves), maps each masked lookup's stored masks into the position's frame and compares every bit with a direct lookup of the child. `GRAV3_WRONG_FRAME=1` maps through the inverse symmetry instead, to show that the check catches a backwards map.
- `grav3 gsolve <floor> <scrambles> <maxnodes> <mode>`: like `cube3 solve`, plus `skipped` and `mask_reads` per solve, and `[generated, skipped]` per round.
  - Mode 0: lab/3x3's `dfs()`, unchanged (the baseline).
  - Mode 1: down masks, `uint32_t`.
  - Mode 2: full masks, down and up, two `uint32_t`.
  - Mode 3: down masks packed in 18 bits, built in memory from the `uint32_t` file at load.
  - `CUBE3_SPLIT=3` with `OMP_NUM_THREADS=2` runs each solve on two threads, as in lab/3x3.
