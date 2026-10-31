"""Compasses that are not learned, plus tiny tables. exp8 counting, 1,000 benchmark positions, four floors.

Every key is "lower is tried first"; ties keep move order. Key arrays are precomputed over all positions
for speed of the experiment; what a real solver would have to read per evaluation is counted in extra_reads.
"""
import json
import os
import sys

import numpy as np

from common import BUDGETS, FLOOR_NAME, LAB2, N, NO, allS, bench, chosen_tables, component, dist, evaluate, floor, \
    inv, neighbours, save_rows

rows_out = []
summary = {}


def mean_table(keys, size):
    """E[true distance | abstraction], over all positions, stored as one byte (x16 fixed point)."""
    s = np.bincount(keys, weights=dist.astype(np.float64), minlength=size)
    c = np.bincount(keys, minlength=size)
    m = np.where(c > 0, s / np.maximum(c, 1), 0)
    q = np.round(m * 16).clip(0, 255).astype(np.uint8)
    return q[keys].astype(np.float32) / 16, int((c > 0).sum())


# abstractions for tiny tables
twist_key = (allS % NO).astype(np.int64)
perm_key = (allS // NO).astype(np.int64)
M_twist, n_twist = mean_table(twist_key, NO)
M_perm, n_perm = mean_table(perm_key, 5040)
sys.path.insert(0, LAB2)
from common import _locate_all  # noqa: E402
loc, cori = _locate_all()


def corner_key(T):
    pw = 21 ** np.arange(len(T))
    return ((loc[:, T].astype(np.int64) * 3 + cori[:, T]) * pw[None, :]).sum(1)


M_c012, n_c012 = mean_table(corner_key([0, 1, 2]), 21 ** 3)
M_c0123, n_c0123 = mean_table(corner_key([0, 1, 2, 3]), 21 ** 4)

# second floor: twists-only and permutation-only, with mirror (5,769 entries, 4 bits each = 2.9 KB)
h_tp = np.maximum(component('twists only'), component('permutation only'))
h_tp = np.maximum(h_tp, h_tp[inv]).astype(np.float32)


def la_min(h):
    """Two-move look-ahead: smallest floor among the child's own children (9 extra reads)."""
    out = np.full(N, 127, np.int8)
    for a in range(0, N, 400_000):
        nb = neighbours(allS[a:a + 400_000])
        out[a:a + 400_000] = h[nb].min(1)
    return out.astype(np.float32)


for B in BUDGETS:
    h = floor(B)
    hraw = np.load(os.path.join(LAB2, 'data', f'floor_budget_{B}.npy')).astype(np.float32)
    comps = [component(n) for n in chosen_tables(B)]
    S = np.zeros(N, np.float32)
    for c in comps:
        S += c
    S = S + S[inv]
    hf = h.astype(np.float32)
    keys = {
        # name: (key, extra bytes, extra reads per evaluation, note)
        'move order (baseline)': (None, 0, 0, ''),
        'floor first': (hf, 0, 0, 'reads already done'),
        'sum of component floors': (S, 0, 0, 'component values already read for the floor'),
        'floor, then sum of components': (hf * 1000 + S, 0, 0, 'component values already read'),
        'mirror: h(x)+h(x^-1)': (hraw + hraw[inv], 0, 0, 'both sides already read'),
        'second floor (twists+perm, mirrored)': (hf * 100 + h_tp, 2884, 2, 'ties on floor broken by the second floor'),
        'two-move look-ahead min': (la_min(h) * 100 + hf, 0, 9, 'min floor over the child\'s 9 children'),
        'tiny table: mean distance by twists (729 B)': (M_twist + M_twist[inv], n_twist, 2, 'x and x^-1'),
        'tiny table: mean distance by permutation (5 KB)': (M_perm + M_perm[inv], n_perm, 2, 'x and x^-1'),
        'tiny table: mean distance by twists + permutation (5.8 KB)':
            (M_twist + M_twist[inv] + M_perm + M_perm[inv], n_twist + n_perm, 4, 'x and x^-1'),
        'tiny table: mean distance by corners 012 (8 KB)': (M_c012 + M_c012[inv], n_c012, 2, 'x and x^-1'),
        'tiny table: mean distance by corners 0123 (144 KB)': (M_c0123 + M_c0123[inv], n_c0123, 2, 'x and x^-1'),
        'truth first (perfect)': (dist.astype(np.float32), None, 0, 'upper bound on any compass'),
    }
    res = {}
    for name, (key, xb, xr, note) in keys.items():
        r = evaluate(h, key)
        res[name] = (r, xb, xr, note)
    Lm = res['move order (baseline)'][0]['mean_lookups']
    Lp = res['truth first (perfect)'][0]['mean_lookups']
    print(f'\n== {FLOOR_NAME[B]}: move order {Lm:,.0f}, perfect {Lp:,.0f}')
    for name, (r, xb, xr, note) in res.items():
        share = (Lm - r['mean_lookups']) / (Lm - Lp)
        extra = r['mean_key_evals'] * xr
        eff = (Lm - (r['mean_lookups'] + extra)) / (Lm - Lp)
        print(f"  {name:<58} {r['mean_lookups']:>9,.0f}  final {r['mean_final_round_lookups']:>8,.0f}  "
              f"recovered {share:>6.1%}  evals {r['mean_key_evals']:>7,.0f}  extra reads {extra:>7,.0f}  "
              f"net recovered {eff:>7.1%}")
        rows_out.append({
            'task': 'compass', 'puzzle': '2x2', 'method': name, 'floor': FLOOR_NAME[B], 'floor_bytes': B,
            'extra_bytes': xb, 'positions': r['positions'], 'optimal': r['optimal'], 'lookups_counting': 'exp8',
            'mean_lookups': r['mean_lookups'], 'mean_final_round_lookups': r['mean_final_round_lookups'],
            'mean_extra_work': r['mean_key_evals'] if name != 'move order (baseline)' else 0,
            'extra_work_unit': 'compass evaluations (children ranked at nodes with 2+ survivors, all rounds)',
            'mean_extra_reads': extra, 'mean_final_round_extra_work': r['mean_final_round_key_evals'],
            'recovered_share': share, 'net_recovered_share_after_extra_reads': eff,
            'mean_ms': None, 'impl': 'numba', 'notes': note})
save_rows(rows_out, 'static_compasses.json')
