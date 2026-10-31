"""Where does the optimal solver spend its time? And three quick ideas measured against today's record.

Same 1,000 uniformly random positions as exp4 (seed 42), same IDA*, floors from exp2.
For each floor budget we record, per solve:
  - nodes (positions generated, each one a floor lookup), per round
  - how many generated positions were cut on arrival (f > bound), split by whether the parent was
    "tight" (g + h = bound): at a tight parent only moves that lower the floor can survive, so a
    stored downhill-move mask could skip those lookups entirely (an upper bound on that saving)
Then two variants of the floor:
  - dual lookup: max(h(x), h(x^-1)), admissible because d(x) = d(x^-1)
  - perfect: the true distance (the best any floor can do)
"""
import json
import time

import numpy as np

from cube2 import NO, Cube2

c = Cube2('htm')
N = 5040 * NO
dist = np.load('data/dist_htm.npy')
inv = np.load('data/inverse_htm.npy')
rng = np.random.default_rng(42)
bench = rng.choice(N, 1000, replace=False)

floors = {
    'twists only': np.load('data/floor_twists.npy'),
    'places only': np.load('data/floor_perm.npy'),
    '2 KB': np.load('data/floor_budget_2000.npy'),
    '20 KB': np.load('data/floor_budget_20000.npy'),
    '100 KB': np.load('data/floor_budget_100000.npy'),
    '400 KB': np.load('data/floor_budget_400000.npy'),
}
faces, pm, om, nm = c.faces, c.pm, c.om, c.nm


def ida_stats(s0, hb):
    """IDA* with counters. Returns length, nodes per round, cut-on-arrival counts."""
    st = {'nodes': 0, 'cut_tight': 0, 'cut_loose': 0, 'kids_tight': 0}
    FOUND = -1
    path = []

    def dfs(s, g, bound, lastface, tight_parent):
        st['nodes'] += 1
        f = g + hb[s]
        if f > bound:
            st['cut_tight' if tight_parent else 'cut_loose'] += 1
            return f
        if s == 0:
            return FOUND
        tight = f == bound
        best = 99
        p, o = divmod(s, NO)
        pp, oo = pm[p], om[o]
        for j in range(nm):
            if faces[j] == lastface:
                continue
            if tight:
                st['kids_tight'] += 1
            path.append(j)
            r = dfs(pp[j] * NO + oo[j], g + 1, bound, faces[j], tight)
            if r == FOUND:
                return FOUND
            path.pop()
            if r < best:
                best = r
        return best

    bound = hb[s0]
    rounds = []
    while True:
        before = st['nodes']
        r = dfs(s0, 0, bound, -1, False)
        rounds.append(st['nodes'] - before)
        if r == FOUND:
            return len(path), rounds, st
        bound = r


def run(name, h):
    hb = bytes(h.astype(np.uint8).tolist())
    t0 = time.time()
    per, last_share, totals = [], [], {'nodes': 0, 'cut_tight': 0, 'cut_loose': 0, 'kids_tight': 0}
    optimal = 0
    for s in bench.tolist():
        L, rounds, st = ida_stats(s, hb)
        optimal += L == dist[s]
        per.append(sum(rounds))
        last_share.append(rounds[-1] / sum(rounds))
        for k in totals:
            totals[k] += st[k]
    per = np.array(per)
    srt = np.sort(per)[::-1]
    gap = dist[bench].astype(int) - h[bench].astype(int)
    by_gap = {int(g): float(per[gap == g].mean()) for g in np.unique(gap)}
    out = {
        'floor': name,
        'optimal': int(optimal),
        'mean_nodes': float(per.mean()),
        'median_nodes': float(np.median(per)),
        'top1pct_share': float(srt[:10].sum() / per.sum()),
        'top10pct_share': float(srt[:100].sum() / per.sum()),
        'last_round_share': float(np.mean(last_share)),
        'cut_on_arrival_share': (totals['cut_tight'] + totals['cut_loose']) / totals['nodes'],
        'cut_below_tight_parent_share': totals['cut_tight'] / totals['nodes'],
        'mean_nodes_by_start_gap': by_gap,
        'seconds': round(time.time() - t0, 1),
    }
    print(
        f"{name:<22} optimal {optimal}/1000  mean {out['mean_nodes']:>10,.0f}  median {out['median_nodes']:>8,.0f}  "
        f"top1% {out['top1pct_share']:5.1%}  top10% {out['top10pct_share']:5.1%}  last round {out['last_round_share']:5.1%}  "
        f"cut on arrival {out['cut_on_arrival_share']:5.1%} (below tight parent {out['cut_below_tight_parent_share']:5.1%})  "
        f"({out['seconds']}s)",
        flush=True,
    )
    return out


results = {'baseline': [], 'dual': [], 'perfect': None}
for name, h in floors.items():
    results['baseline'].append(run(name, h))
for name, h in floors.items():
    results['dual'].append(run(name + ' + inverse', np.maximum(h, h[inv])))
results['perfect'] = run('perfect (truth)', dist)
json.dump(results, open('results/exp7_where_time_goes.json', 'w'), indent=1)
