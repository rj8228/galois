"""Time per evaluation, measured in a compiled (numba) loop, against the time of one floor lookup.

A floor lookup here means what a real solver does: read every component table of the collection for x and for
x^-1 (the mirror). We time random reads from tables of each component's size, then a compass evaluation:
tiny-table reads, or the sparse MLP (28 active one-hot inputs + component one-hots, H hidden units).
"""
import json
import os
import time

import numba as nb
import numpy as np

from common import BUDGETS, FLOOR_NAME, HERE, chosen_tables

res = json.load(open(os.path.join(os.path.dirname(HERE), '..', '2x2', 'results', 'exp2_floors.json')))
entries = {r['name']: r['entries'] for r in res['floors']}
rng = np.random.default_rng(0)
R = 4_000_000
idx_src = rng.integers(0, 1 << 30, R)


@nb.njit
def reads(tables, sizes, idx, reps):
    acc = 0
    for r in range(reps):
        for t in range(len(sizes)):
            acc += tables[t][idx[r] % sizes[t]]
    return acc


def ns_per_lookup(names):
    tabs = nb.typed.List([np.ones(max(1, entries[n] // 2), np.uint8) for n in names])
    sz = np.array([len(t) for t in tabs], np.int64)
    reads(tabs, sz, idx_src, 1000)
    t = time.perf_counter()
    reads(tabs, sz, idx_src, R)
    return (time.perf_counter() - t) / R * 1e9 * 2  # x and x^-1


@nb.njit
def mlp(W1, b1, W2, active, reps):
    H = W1.shape[1]
    acc = 0.0
    h = np.empty(H, np.float32)
    for r in range(reps):
        for k in range(H):
            h[k] = b1[k]
        for a in range(active.shape[1]):
            row = active[r % active.shape[0], a]
            for k in range(H):
                h[k] += W1[row, k]
        s = 0.0
        for k in range(H):
            if h[k] > 0:
                s += h[k] * W2[k]
        acc += s
    return acc


out = {}
for B in BUDGETS:
    names = chosen_tables(B)
    lk = ns_per_lookup(names)
    tiny = {}
    for nm, size in [('729 B', 729), ('5 KB', 5040), ('144 KB', 143640)]:
        tabs = nb.typed.List([np.ones(size, np.uint8)])
        reads(tabs, np.array([size]), idx_src, 1000)
        t = time.perf_counter()
        reads(tabs, np.array([size]), idx_src, R)
        tiny[nm] = (time.perf_counter() - t) / R * 1e9 * 2
    D = 140 + 2 * len(names) * 12
    W1 = rng.standard_normal((D, 64)).astype(np.float32)
    act = rng.integers(0, D, (4096, 28 + 2 * len(names)))
    mlp(W1, W1[0], W1[1], act, 1000)
    t = time.perf_counter()
    mlp(W1, W1[0], W1[1], act, R // 4)
    m = (time.perf_counter() - t) / (R // 4) * 1e9
    out[FLOOR_NAME[B]] = {'tables': len(names), 'ns_per_floor_lookup': lk,
                          'ns_per_tiny_table_eval_x_and_inverse': tiny, 'ns_per_mlp64_eval': m,
                          'mlp64_multiply_adds': (28 + 2 * len(names)) * 64 + 64}
    print(FLOOR_NAME[B], json.dumps(out[FLOOR_NAME[B]]))
json.dump(out, open(os.path.join(HERE, 'results', 'timing.json'), 'w'), indent=1)
