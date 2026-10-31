"""Rank only near the root: apply the compass only at nodes with at least k moves left in the budget."""
import json
import os

import numpy as np

from common import BUDGETS, DATA, FLOOR_NAME, HERE, dist, evaluate, floor

timing = json.load(open(os.path.join(HERE, 'results', 'timing.json')))
out = []
for B in BUDGETS:
    h = floor(B)
    t = timing[FLOOR_NAME[B]]
    Lm, Lp = evaluate(h)['mean_lookups'], evaluate(h, dist)['mean_lookups']
    for name, key, cost in [('listwise ranker 64 + components', np.load(os.path.join(DATA, f'score_mlp_comp_64_{B}_w3.npy')),
                             t['ns_per_mlp64_eval'] / t['ns_per_floor_lookup']),
                            ('tiny table corners 0123 (144 KB)', None, None),
                            ('truth first (perfect)', dist.astype(np.float32), 0.0)]:
        if key is None:
            continue
        for k in [0, 4, 6, 8]:
            r = evaluate(h, key, min_left=k)
            eff = r['mean_lookups'] + r['mean_key_evals'] * cost
            row = {'floor': FLOOR_NAME[B], 'method': name, 'min_moves_left': k, 'mean_lookups': r['mean_lookups'],
                   'mean_evals': r['mean_key_evals'], 'recovered_share': (Lm - r['mean_lookups']) / (Lm - Lp),
                   'net_recovered_share_after_time': (Lm - eff) / (Lm - Lp)}
            out.append(row)
            print(f"{row['floor']:<16} {name:<34} left>={k}  lookups {r['mean_lookups']:>8,.0f}  evals {r['mean_key_evals']:>7,.1f}"
                  f"  recovered {row['recovered_share']:>6.1%}  net {row['net_recovered_share_after_time']:>7.1%}")
json.dump(out, open(os.path.join(HERE, 'results', 'near_root.json'), 'w'), indent=1)
