"""Sanity check: compiled IDA* reproduces exp8 (20 KB + mirror: move order 1,787 / 969; truth 873 / 55)."""
import time
from common import BUDGETS, dist, evaluate, floor
for B in BUDGETS:
    h = floor(B)
    assert (h <= dist).all()
    t = time.time()
    a = evaluate(h)
    b = evaluate(h, dist)
    print(B, round(a['mean_lookups']), round(a['mean_final_round_lookups']), '| truth', round(b['mean_lookups']),
          round(b['mean_final_round_lookups']), f'{time.time()-t:.1f}s')
