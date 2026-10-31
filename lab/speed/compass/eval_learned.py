"""Benchmark learned compasses (scores precomputed over all positions) on the four floors."""
import os
import sys

import numpy as np

from common import BUDGETS, DATA, FLOOR_NAME, dist, evaluate, floor

tags = sys.argv[1:]
for B in BUDGETS:
    h = floor(B)
    Lm = evaluate(h)['mean_lookups']
    Lp = evaluate(h, dist)['mean_lookups']
    for tag in tags:
        t = tag.replace('{B}', str(B))
        p = os.path.join(DATA, f'score_{t}.npy')
        if not os.path.exists(p):
            continue
        r = evaluate(h, np.load(p))
        print(f"{FLOOR_NAME[B]:<16} {t:<28} {r['mean_lookups']:>9,.0f} final {r['mean_final_round_lookups']:>8,.0f} "
              f"recovered {(Lm - r['mean_lookups']) / (Lm - Lp):6.1%}  evals {r['mean_key_evals']:,.0f}")
