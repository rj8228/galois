# Galois solver lab

Tests the ideas behind a guaranteed-optimal solver on the 2×2, where all 3,674,160 positions can be checked against the true answer.

The framework being tested:

- **Ceilings** (a solution you found) can come from anything, including a neural network.
- **Floors** (a proof that nothing shorter exists) must never be too high. Here they come from group theory: smaller puzzles seen through cosets, symmetry, and neural tables with a correction list.
- **The prover** (IDA*) closes the gap. When the floor meets the ceiling, the answer is certified optimal.

## Run

```sh
python3 exp1_truth.py               # truth table, entropy, symmetry (~10 s)
python3 exp2_floors.py              # group-theory floors and the best-per-byte search (~1.5 min)
python3 exp3_neural.py 6            # three neural floors + correction table (~4 min, numpy only)
python3 exp4_gravity_framework.py   # false valleys, rolling balls, IDA* prover, full framework
python3 exp5_finder.py 12           # scramble inputs + true labels: a working finder, then the framework again
python3 exp6_exhaustive.py          # the prover on all 3,674,160 positions, every solution replayed (~2 min)
python3 exp7_where_time_goes.py     # anatomy of a solve: proof vs find, wasted lookups, mirror lookups (~6 min)
python3 exp8_doors_and_compass.py   # shortest solutions per position, best-first ordering (~2 min)
```

The arrays in `data/` (about 200 MB) are not committed; the scripts rebuild them. Run the experiments in order on a fresh clone: exp1 writes the truth table and inverse map, exp2 the floors, exp3 networks A–C, exp5 networks D and E (exp8 needs D).

Results and what they mean: [FINDINGS.md](FINDINGS.md).

Needs Python 3.11+ and numpy. Results land in `results/*.json`; large arrays in `data/`.

## Files

- `cube2.py`: the 2×2 as a permutation group (corners, DBL fixed, U/R/F turns), move tables, BFS, inverse, features.
- `exp1_truth.py`: exact distances in both metrics, checked against published counts; entropy; inverse and rotation symmetry.
- `exp2_floors.py`: floors from tracking only twists, only the permutation, or only some corners; coset check; greedy search over 121 candidate floors under memory budgets.
- `exp3_neural.py`: networks trained on scramble length, on exact distance, and on exact distance with overestimates penalised; correction table.
- `exp4_gravity_framework.py`: false valleys per landscape, greedy and annealed rolling, IDA* with every heuristic, and the ceiling + floor + prover pipeline.
- `exp5_finder.py`: networks D (finder) and E (floor) trained on scramble inputs with true labels; beam search; the framework with a working finder.
- `exp6_exhaustive.py`: IDA* with the 400 KB floor on every position, each solution replayed and checked against the truth table.
- `exp7_where_time_goes.py`: where IDA*'s work goes (proof rounds against the final round, positions cut on arrival) and the mirror (inverse) lookup.
- `exp8_doors_and_compass.py`: how many shortest solutions every position has, and best-first ordering of children in the search.
- `nets.py`, `search.py`: the numpy network and the search routines shared by experiment 5.
