# T4 3×3 anatomy

Where an optimal 3×3 solve spends its work, measured with `lab/3x3`'s C solver, and what that means for the three speed levers (mirror, compass, gravity). Results: [FINDINGS.md](FINDINGS.md). Brief: [../T4-3x3-anatomy.md](../T4-3x3-anatomy.md).

## What is here

| Path | What it is |
| --- | --- |
| `src/anat3.c` | A copy of `lab/3x3/src/cube3.c` (unchanged apart from one `#include` and one subcommand) |
| `src/anatomy.inc` | The instrumented IDA*: `anat3 anat <floor> <scrambles> <maxnodes> <modes> [mirror-floor]` |
| `scripts/run.sh` | Runs every measurement, writes `results/raw/*.jsonl` (skips files that exist) |
| `scripts/analyse.py` | Checks everything, writes `results/anatomy.json`, `results/frontier.json` and the tables in FINDINGS.md |
| `results/raw/` | One JSON line per scramble: per-round counts and every rerun |

## Rerun

```sh
cd lab/speed/anatomy3
make
CUBE3_TABLES=data/tables ./anat3 build corners_sym edges6 phase1_sym   # 10 s, into data/tables (gitignored)
scripts/run.sh                                                         # about 1 hour on 4 threads
python3 scripts/analyse.py
```

## What the instrumented search counts

The search is `lab/3x3`'s `dfs()`, with the same move rules, lookups and group-by-group pruning, so its node counts equal `lab/3x3`'s exactly (checked on all 50 twelve-move scrambles for both floor sets before anything else was run). Per round it records:

- **lookups**: generated children (one evaluation of the whole floor set each; one move from the end, a compare with solved, also listed separately as *tests*). All children of a node are read before the search descends, the 2×2 lab's exp8 counting.
- **cut on arrival**: children with g + h > bound, split by whether their parent was **tight** (g + h(parent) = bound, where h(parent) is the max over all the set's lookups, known exactly even for 2-bit tables).
- **expansions**: nodes whose children were generated.

Modes rerun the final round at the found length:

- `c` **perfect compass**: at every node on the found solution's path, that solution's next move is tried first.
- `f` **by floor**: surviving children tried in ascending floor.
- `m` **by mirror floor**: ascending max(h(x), h(x⁻¹)), ties by h(x) + h(x⁻¹). The phone set's 2-bit tables can't be read on the inverse, so it reads 4-bit `C8s+E6x8i` for this (extra memory and reads, reported separately).
- `n` **count**: keep going after the first solution and count every shortest solution, both canonical (the search's opposite-face order) and all move sequences (each adjacent opposite-face pair counts twice).
- `g` **gravity**: at every tight node, counts which children downhill masks on the direct lookups would let through, by computing exactly what the masks would contain.
