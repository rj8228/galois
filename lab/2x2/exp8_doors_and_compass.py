"""Two follow-ups to exp7.

1. Doors home: how many different shortest solutions each position has (exact, every position),
   counted backwards over the BFS layers. A position with few doors is slow to find in the last round.
2. Compass: in IDA*, look up all children first, then try them best-first. Ordering never changes
   which positions are proven or the answer, only how soon the last round stumbles on a solution.
   Orders tried: the floor itself, network D's estimate, and the true distance (the best possible).
"""
import json

import numpy as np

from cube2 import NO, Cube2

c = Cube2('htm')
N = 5040 * NO
dist = np.load('data/dist_htm.npy')
inv = np.load('data/inverse_htm.npy')
rng = np.random.default_rng(42)
bench = rng.choice(N, 1000, replace=False)
faces, pm, om, nm = c.faces, c.pm, c.om, c.nm

# ---------------- 1. Doors home ----------------
doors = np.zeros(N, np.float64)
doors[0] = 1
allstates = np.arange(N, dtype=np.int64)
order = np.argsort(dist, kind='stable')
for d in range(1, int(dist.max()) + 1):
    layer = allstates[dist == d]
    acc = np.zeros(layer.size)
    for j in range(nm):
        nb = c.nb(layer, j)
        down = dist[nb] == d - 1
        acc[down] += doors[nb[down]]
    doors[layer] = acc
by_d = {int(d): {'median': float(np.median(doors[dist == d])), 'min': float(doors[dist == d].min()),
                 'max': float(doors[dist == d].max())} for d in range(int(dist.max()) + 1)}
unique_share = float((doors == 1).mean())
print('doors home by distance (median, min, max):', {d: (v['median'], v['min'], v['max']) for d, v in by_d.items()})
print(f'positions with exactly one shortest solution: {unique_share:.2%}', flush=True)


# ---------------- 2. Compass ----------------
def ida_ordered(s0, hb, key):
    """Lookups counted like exp7's nodes: one per generated position. key=None keeps move order."""
    st = {'lookups': 0}
    FOUND = -1

    def dfs(s, hs, g, bound, lastface):
        if s == 0:
            return FOUND
        p, o = divmod(s, NO)
        pp, oo = pm[p], om[o]
        kids = []
        best = 99
        for j in range(nm):
            if faces[j] == lastface:
                continue
            t = pp[j] * NO + oo[j]
            st['lookups'] += 1
            ht = hb[t]
            f = g + 1 + ht
            if f > bound:
                if f < best:
                    best = f
                continue
            kids.append((key[t] if key is not None else j, t, ht, faces[j]))
        if key is not None:
            kids.sort(key=lambda k: k[0])
        for _, t, ht, fc in kids:
            r = dfs(t, ht, g + 1, bound, fc)
            if r == FOUND:
                return FOUND
            if r < best:
                best = r
        return best

    st['lookups'] += 1
    h0 = hb[s0]
    bound = h0
    rounds = []
    while True:
        before = st['lookups']
        r = dfs(s0, h0, 0, bound, -1) if bound >= h0 else bound
        rounds.append(st['lookups'] - before)
        if r == FOUND:
            return rounds
        bound = r


h400 = np.load('data/floor_budget_400000.npy')
h20 = np.load('data/floor_budget_20000.npy')
netD = np.load('data/raw_D.npy')
results = {'doors_by_distance': by_d, 'unique_share': unique_share, 'compass': []}
for fname, h in [('20 KB + inverse', np.maximum(h20, h20[inv])), ('400 KB + inverse', np.maximum(h400, h400[inv]))]:
    hb = bytes(h.astype(np.uint8).tolist())
    for oname, key in [('move order', None), ('floor first', h.tolist()), ('network D first', netD.tolist()),
                       ('truth first (best possible)', dist.tolist())]:
        tot, last, lastw = [], [], []
        for s in bench.tolist():
            rounds = ida_ordered(s, hb, key)
            tot.append(sum(rounds))
            last.append(rounds[-1])
        tot, last = np.array(tot), np.array(last)
        corr = float(np.corrcoef(np.log(last + 1), np.log(doors[bench]))[0, 1])
        row = {'floor': fname, 'order': oname, 'mean_lookups': float(tot.mean()), 'mean_last_round': float(last.mean()),
               'last_share': float(last.sum() / tot.sum()), 'corr_log_last_round_vs_log_doors': corr}
        results['compass'].append(row)
        print(f"{fname:<18} {oname:<28} lookups {row['mean_lookups']:>8,.0f}  last round {row['mean_last_round']:>8,.0f} "
              f"({row['last_share']:5.1%})  corr(last round, doors) {corr:+.2f}", flush=True)
json.dump(results, open('results/exp8_doors_and_compass.json', 'w'), indent=1)
