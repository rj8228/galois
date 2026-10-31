"""Experiment 1: the truth table, entropy, and symmetry.

Builds the exact distance of all 3,674,160 positions, checks it against the published
counts, then tests the entropy and symmetry claims exhaustively.
"""
import json
import math
import os
import time

import numpy as np

from cube2 import N, NO, Cube2

os.makedirs('data', exist_ok=True)  # large arrays live here and are not committed

KNOWN = {
    'htm': [1, 9, 54, 321, 1847, 9992, 50136, 227536, 870072, 1887748, 623800, 2644],
    'qtm': [1, 6, 27, 120, 534, 2256, 8969, 33058, 114149, 360508, 930588, 1350852, 782536, 90280, 276],
}
out = {}

for metric in ['htm', 'qtm']:
    t = time.time()
    c = Cube2(metric)
    dist, parent, pmv, levels = c.bfs()
    counts = np.bincount(dist).tolist()
    assert (dist >= 0).all(), 'unreached positions'
    assert counts == KNOWN[metric], (metric, counts)
    out[metric] = {'counts': counts, 'gods_number': len(counts) - 1, 'seconds': round(time.time() - t, 1)}
    np.save(f'data/dist_{metric}.npy', dist)
    if metric == 'htm':
        np.save('data/parent_htm.npy', parent)
        np.save('data/pmv_htm.npy', pmv)
        htm, dist_h, levels_h = c, dist, levels
    print(metric, 'matches published counts; God\'s number', len(counts) - 1, f'({out[metric]["seconds"]}s)')

# ---------- Entropy ----------
c, dist = htm, dist_h
counts = out['htm']['counts']
shells = []
for d, n in enumerate(counts):
    shells.append({'d': d, 'count': n, 'share': n / N, 'bits': math.log2(n),
                   'growth': (n / counts[d - 1]) if d else None})
rim = (counts[9] + counts[10]) / N
mean_d = float((np.arange(len(counts)) * np.array(counts)).sum() / N)

# Counting floor: canonical sequences never turn the same face twice in a row,
# so there are 9 of length 1 and 6 choices per step after that.
reach, k = 1, 0
while reach < N:
    k += 1
    reach += 9 * 6 ** (k - 1)
counting_floor = k

# Do random scrambles make honest labels? Scramble k moves (never the same face twice
# in a row) and compare k with the true distance of where you land.
rng = np.random.default_rng(1)
scramble = []
for k in range(1, 21):
    s = np.zeros(20000, np.int64)
    last = np.full(20000, -1)
    for _ in range(k):
        j = rng.integers(0, 9, size=s.size)
        same = (j // 3) == last
        while same.any():  # re-roll moves that repeat the previous face
            j[same] = rng.integers(0, 9, size=same.sum())
            same = (j // 3) == last
        s = c.pmove[s // NO, j].astype(np.int64) * NO + c.omove[s % NO, j]
        last = j // 3
    true = dist[s]
    scramble.append({'k': k, 'mean_true': float(true.mean()), 'label_too_high': float((true < k).mean())})
out['entropy'] = {'shells': shells, 'share_at_9_or_10': rim, 'mean_distance': mean_d,
                  'total_bits': math.log2(N), 'counting_floor_gods_number': counting_floor,
                  'scramble_labels': scramble}
print(f'rim share (9-10 moves) {rim:.3f}, mean distance {mean_d:.2f}, counting floor {counting_floor}')
for row in scramble:
    if row['k'] in (3, 5, 8, 11, 14, 20):
        print(f"  scramble {row['k']:2d}: true mean {row['mean_true']:.2f}, label too high {row['label_too_high']:.1%}")

# ---------- Symmetry ----------
allS = np.arange(N, dtype=np.int64)
inv = np.empty(N, np.int64)
for a in range(0, N, 500_000):
    inv[a:a + 500_000] = c.inverse(allS[a:a + 500_000])
inverse_ok = bool((dist[inv] == dist).all())
inverse_involution = bool((inv[inv] == allS).all())

# The 120 degree turn of the whole cube about the URF-DBL diagonal relabels U->R->F->U.
# Build that relabelling along the BFS tree, then check it against EVERY edge of the graph:
# if it always commutes with the moves it is a genuine symmetry of the group.
parent = np.load('data/parent_htm.npy')
pmv = np.load('data/pmv_htm.npy')
results_sym = {}
for name, mapmove in {'U->R->F': np.array([3, 4, 5, 6, 7, 8, 0, 1, 2]),
                      'U->F->R': np.array([6, 7, 8, 0, 1, 2, 3, 4, 5])}.items():
    sigma = np.full(N, -1, np.int64)
    sigma[0] = 0
    for lv in levels_h[1:]:
        ps = sigma[parent[lv]]
        js = mapmove[pmv[lv]]
        sigma[lv] = c.pmove[ps // NO, js].astype(np.int64) * NO + c.omove[ps % NO, js]
    ok = True
    for j in range(9):
        lhs = sigma[c.nb(allS, j)]
        rhs = c.pmove[sigma // NO, mapmove[j]].astype(np.int64) * NO + c.omove[sigma % NO, mapmove[j]]
        ok &= bool((lhs == rhs).all())
    results_sym[name] = {'commutes_with_every_move': ok, 'bijective': bool(np.unique(sigma).size == N),
                         'preserves_distance': bool((dist[sigma] == dist).all())}
    if name == 'U->R->F':
        sig = sigma
# Classes under the 6-element group {rotations by 0/120/240} x {inverse or not}
cands = [allS, sig, sig[sig]]
cands += [inv[x] for x in cands]
rep = np.minimum.reduce(cands)
classes = int(np.unique(rep).size)
out['symmetry'] = {'inverse_same_distance': inverse_ok, 'inverse_is_involution': inverse_involution,
                   'rotation': results_sym, 'classes_under_6_symmetries': classes,
                   'compression': N / classes}
np.save('data/sigma_htm.npy', sig)
np.save('data/inverse_htm.npy', inv)
print('inverse keeps distance:', inverse_ok, '| rotations:', results_sym)
print(f'classes under 6 symmetries: {classes:,} (x{N / classes:.2f} smaller)')

json.dump(out, open('results/exp1_truth.json', 'w'), indent=1)
