"""Best twin: symmetric copies of a position are equally far from solved, but the search can cost very different
amounts on each, because the floor tables are not symmetric. Solve the twin the floor sees best, then map the
solution back. Measured from the atlas's per-position work (every position), for an oracle and a cheap proxy."""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.normpath(os.path.join(HERE, '..', '..', '2x2'))
D = os.path.join(LAB, 'data')
dist = np.load(os.path.join(D, 'dist_htm.npy'))
inv = np.load(os.path.join(D, 'inverse_htm.npy'))
sigma = np.load(os.path.join(D, 'sigma_htm.npy'))
N = dist.size
allS = np.arange(N, dtype=np.int64)
orbit = np.stack([allS, sigma, sigma[sigma], inv, sigma[inv], sigma[sigma[inv]], inv[sigma], inv[sigma[sigma]]])
FL = {'400 KB + mirror': 'floor_budget_400000.npy', '100 KB + mirror': 'floor_budget_100000.npy',
      '20 KB + mirror': 'floor_budget_20000.npy', '2 KB + mirror': 'floor_budget_2000.npy', '20 KB': 'floor_budget_20000.npy'}
rows = {}
for name, f in FL.items():
    h = np.load(os.path.join(D, f)).astype(np.int64)
    if 'mirror' in name:
        h = np.maximum(h, h[inv])
    a = np.load(os.path.join(HERE, 'data', f"anatomy_{name.replace(' ', '_').replace('+', 'plus')}.npy"))
    work = a[:, 1].astype(np.float64)
    w_tw = work[orbit]                       # 8 × N, work of each twin
    oracle = w_tw.min(0)
    # Proxy: the twin with the highest floor at the start (first one wins ties); costs a few extra lookups.
    h_tw = h[orbit]
    pick = h_tw.argmax(0)
    proxy = w_tw[pick, allS]
    rows[name] = {'mean_work': float(work.mean()), 'oracle_best_twin': float(oracle.mean()),
                  'proxy_highest_floor_twin': float(proxy.mean()), 'proxy_extra_lookups': 8}
    print(f"{name:<16} plain {work.mean():>10,.1f}   best twin (oracle) {oracle.mean():>10,.1f} ({work.mean()/oracle.mean():.2f}x)   "
          f"highest-floor twin {proxy.mean():>10,.1f} ({work.mean()/proxy.mean():.2f}x)")
json.dump(rows, open(os.path.join(HERE, 'results', 'twins.json'), 'w'), indent=1)
