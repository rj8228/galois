# Speed lab T2: compass (learned move ordering)

Which child to try first in IDA*'s final round. See [FINDINGS.md](FINDINGS.md) for the verdict, tables and how to reproduce.

- `common.py`: data, floors and component tables, compiled IDA* (exp8 counting) with a pluggable child order, final-round recorder.
- `static_compasses.py`: non-learned compasses and tiny mean-distance tables.
- `learned_ranker.py`: listwise sibling ranker (numpy, hand-written backprop). `distance_regressor.py`: MLP distance regressor.
- `timing.py`, `make_frontier.py`, `near_root.py`: time per evaluation, the shared `results/frontier.json`, and ranking only near the root.
