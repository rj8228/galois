"""Experiment 5: fix the training distribution, then run the framework with a working finder.

Uniform sampling almost never shows a network the few positions near solved (385 of 3.67 million
are within 3 moves), so network B collapsed to guessing the average. Here the inputs come from
random scrambles, which visit the narrow neck of the funnel often, and the labels are the TRUE
distance (DeepCubeA gets correct labels by value iteration; the 2x2 can use its table directly).
  D: squared error, used as the finder (ceilings)
  E: overestimates penalised 30x, plus a correction table, used as a floor
"""
import json
import sys
import time

import numpy as np

from cube2 import N, Cube2
from nets import predict, random_walk_set, train
from search import GaveUp, beam, ida, roll

c = Cube2('htm')
dist = np.load('data/dist_htm.npy')
allS = np.arange(N, dtype=np.int64)
rng = np.random.default_rng(5)
EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 12
bench = np.random.default_rng(42).choice(N, 1000, replace=False)  # same benchmark as experiment 4
out = {}

sW, _ = random_walk_set(c, rng, N, 14)
yW = dist[sW].astype(np.float32)
out['training_share_within_3_moves'] = {'scramble_inputs': float((yW <= 3).mean()),
                                        'uniform_inputs': float((dist <= 3).mean())}
print('training positions within 3 moves: scrambles', f"{(yW <= 3).mean():.1%}", 'vs uniform',
      f"{(dist <= 3).mean():.4%}")
netD = train(c, rng, sW, yW, 1.0, EPOCHS, 'D finder')
pD = predict(c, netD, allS)
pD[0] = 0.0
netE = train(c, rng, sW, yW, 30.0, EPOCHS, 'E floor')
pE = predict(c, netE, allS)
pE[0] = 0.0
np.save('data/raw_D.npy', pD)
np.save('data/raw_E.npy', pE)

out['mean_guess_by_true_distance'] = {
    t: [round(float(p[dist == k].mean()), 2) for k in range(12)]
    for t, p in [('B (uniform inputs)', np.load('data/raw_B.npy')), ('D', pD), ('E', pE)]}
for t, row in out['mean_guess_by_true_distance'].items():
    print(f'{t:<20}', ' '.join(f'{v:5.1f}' for v in row))

hD = np.clip(np.rint(pD), 0, 30).astype(np.int8)
hE = np.clip(np.floor(pE), 0, 30).astype(np.int8)
exc = np.nonzero(hE > dist)[0]
hEx = hE.copy()
hEx[exc] = dist[exc]
assert (hEx <= dist).all()
out['D'] = {'too_high_share': float((hD > dist).mean()), 'exact_share': float((hD == dist).mean()),
            'mean_abs_error': float(np.abs(pD - dist).mean())}
out['E + corrections'] = {'too_high_before': float((hE > dist).mean()), 'corrections': int(exc.size),
                          'bytes': netE.params() * 2 + exc.size * 4, 'mean_floor': float(hEx.mean()),
                          'exact_share': float((hEx == dist).mean())}
print('D:', out['D'])
print('E + corrections:', out['E + corrections'])

# Gravity on D's raw landscape
nbmin = np.min(np.stack([pD[c.nb(allS, j)] for j in range(c.nm)]), axis=0)
g = {'no_downhill_share': float(((allS != 0) & (nbmin >= pD)).mean())}
Dl = pD.tolist()
for heat in (False, True):
    res = [roll(c, Dl, s, rng, heat) for s in bench.tolist()]
    okL = [(L, dist[s]) for L, s in zip(res, bench.tolist()) if L is not None]
    g['with heat' if heat else 'pure gravity'] = {'reached_solved': len(okL) / len(bench),
                                                  'optimal_share_of_all': sum(L == d for L, d in okL) / len(bench)}
out['gravity_D'] = g
print('gravity D:', g)

# Finder quality: beam search guided by each network
finders = {}
for name, p in [('B (uniform inputs)', np.load('data/raw_B.npy')), ('D', pD)]:
    pl = p.tolist()
    for width in (8, 64):
        t0 = time.time()
        res = [beam(c, s, pl, width) for s in bench.tolist()]
        found = [(L, int(dist[s])) for L, s in zip(res, bench.tolist()) if L is not None]
        finders[f'{name}, width {width}'] = {
            'found_share': len(found) / len(bench),
            'optimal_share': sum(L == d for L, d in found) / len(bench),
            'mean_excess_when_found': float(np.mean([L - d for L, d in found])) if found else None,
            'seconds': round(time.time() - t0, 1)}
        print(f'beam {name}, width {width}:', finders[f'{name}, width {width}'], flush=True)
out['finders'] = finders

# Prover with the neural floor
floor20 = np.load('data/floor_budget_20000.npy')
for name, h in [('E + corrections', hEx), ('hybrid: E + corrections, max 20 KB floor', np.maximum(hEx, floor20))]:
    hb = bytes(h.astype(np.uint8).tolist())
    ns, opt = [], 0
    for s in bench.tolist():
        L, n, _ = ida(c, s, hb)
        ns.append(n)
        opt += L == dist[s]
    out[f'prover {name}'] = {'optimal_share': opt / len(bench), 'mean_nodes': float(np.mean(ns)),
                             'mean_floor': float(h.mean())}
    print(f'IDA* {name}:', out[f'prover {name}'])

# The framework: AI ceiling + math floor + prover, scored against the truth
floor = np.load('data/floor_budget_400000.npy')
fb = bytes(floor.astype(np.uint8).tolist())
Dw = pD.tolist()
rows = []
for s in bench.tolist():
    ceil = beam(c, s, Dw, 64)
    L0, n0, _ = ida(c, s, fb)
    if ceil is not None and ceil == floor[s]:
        L1, n1 = ceil, 0
    else:
        L1, n1, _ = ida(c, s, fb, ceiling=ceil)
    assert L0 == dist[s] and L1 == dist[s], 'a certificate disagreed with the truth table'
    rows.append((np.nan if ceil is None else ceil, int(floor[s]), int(dist[s]), n0, n1))
r = np.array(rows, dtype=float)
frame = {'positions': len(bench), 'ceiling_found_share': float(np.mean(~np.isnan(r[:, 0]))),
         'ceiling_optimal_share': float(np.mean(r[:, 0] == r[:, 2])),
         'instant_certificate_share': float(np.mean(r[:, 0] == r[:, 1])),
         'mean_gap_ceiling_minus_floor': float(np.nanmean(r[:, 0] - r[:, 1])),
         'mean_nodes_prover_alone': float(r[:, 3].mean()), 'mean_nodes_with_ceiling': float(r[:, 4].mean()),
         'all_certificates_match_truth': True}
out['framework'] = frame
print('framework:', frame)
json.dump(out, open('results/exp5_finder.json', 'w'), indent=1)
