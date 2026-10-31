"""Collect every compass x floor into results/frontier.json, with time cost in floor-lookup equivalents.

Needs: static_compasses.py, learned_ranker.py (64 comp per floor, WBASE=3; 32 mirror all), distance_regressor.py 256 6,
timing.py. Effective lookups = lookups + evaluations x (time per evaluation / time per floor lookup).
Break-even = the most an evaluation may cost (in floor lookups) before the compass loses: (L_move - L_compass) / evals.
"""
import json
import os

import numpy as np

from common import BUDGETS, DATA, FLOOR_NAME, HERE, chosen_tables, dist, evaluate, floor

R = os.path.join(HERE, 'results')
timing = json.load(open(os.path.join(R, 'timing.json')))
rows = json.load(open(os.path.join(R, 'static_compasses.json')))
for B in BUDGETS:
    h = floor(B)
    for tag, name, xb in [(f'mlp_comp_64_{B}_w3', 'listwise ranker 64 hidden, inputs x, x^-1 one-hot + component floors', None),
                          ('mlp_mirror_32_all_w1', 'listwise ranker 32 hidden, inputs x, x^-1 one-hot', None),
                          ('reg_mirror_256', 'distance regressor 256 hidden, inputs x, x^-1 one-hot', None)]:
        p = os.path.join(DATA, f'score_{tag}.npy')
        if not os.path.exists(p):
            p = os.path.join(DATA, f'score_{tag.split("_all")[0]}.npy')
        r = evaluate(h, np.load(p))
        nin = 140 + (2 * len(chosen_tables(B)) * 12 if 'comp' in tag else 0)
        hid = int(tag.split('_')[2])
        rows.append({'task': 'compass', 'puzzle': '2x2', 'method': name, 'floor': FLOOR_NAME[B], 'floor_bytes': B,
                     'extra_bytes': (nin * hid + 2 * hid + 1) * 4, 'positions': r['positions'], 'optimal': r['optimal'],
                     'lookups_counting': 'exp8', 'mean_lookups': r['mean_lookups'],
                     'mean_final_round_lookups': r['mean_final_round_lookups'], 'mean_extra_work': r['mean_key_evals'],
                     'extra_work_unit': 'compass evaluations (children ranked at nodes with 2+ survivors, all rounds)',
                     'mean_extra_reads': 0, 'mean_final_round_extra_work': r['mean_final_round_key_evals'],
                     'mean_ms': None, 'impl': 'numba', 'notes': f'float32 weights; {tag}'})
out = []
for B in BUDGETS:
    fr = [r for r in rows if r['floor_bytes'] == B]
    Lm = next(r for r in fr if r['method'].startswith('move order'))['mean_lookups']
    Lp = next(r for r in fr if r['method'].startswith('truth'))['mean_lookups']
    t = timing[FLOOR_NAME[B]]
    lk, tiny, mlp = t['ns_per_floor_lookup'], t['ns_per_tiny_table_eval_x_and_inverse'], t['ns_per_mlp64_eval']
    for r in fr:
        m = r['method']
        if m.startswith('tiny table'):
            ntab = 2 if 'twists + permutation' in m else 1
            cost = ntab * float(np.mean(list(tiny.values()))) / lk
        elif m.startswith('second floor'):
            cost = 2 * float(np.mean(list(tiny.values()))) / lk
        elif m.startswith('two-move'):
            cost = 9.0
        elif 'ranker' in m or 'regressor' in m:
            hid = 64 if '64' in m else (32 if '32' in m else 256)
            cost = mlp * hid / 64 / lk
        else:
            cost = 0.0
        ev = r['mean_extra_work'] or 0
        eff = r['mean_lookups'] + ev * cost
        r['recovered_share'] = (Lm - r['mean_lookups']) / (Lm - Lp)
        r['eval_cost_in_lookups'] = cost
        r['effective_lookups'] = eff
        r['net_recovered_share_after_time'] = (Lm - eff) / (Lm - Lp)
        r['break_even_eval_cost_in_lookups'] = (Lm - r['mean_lookups']) / ev if ev else None
        r.pop('net_recovered_share_after_extra_reads', None)
        out.append(r)
        print(f"{r['floor']:<16} {m[:62]:<62} {r['mean_lookups']:>8,.0f} rec {r['recovered_share']:>6.1%} "
              f"cost/eval {cost:5.2f} net {r['net_recovered_share_after_time']:>7.1%}")
json.dump(out, open(os.path.join(R, 'frontier.json'), 'w'), indent=1)
