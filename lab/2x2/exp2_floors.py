"""Experiment 2: floors from group theory.

Every floor here comes from looking at the cube through a smaller group: only the twists,
only the permutation, or only some corners. Group theory says (a) such a floor can never be
higher than the truth and (b) its value equals the smallest true distance among all positions
that look the same through that lens (they form a coset). Both are checked on every position.
Then a greedy search picks the best floors per byte, in the spirit of Haslum et al. (2007).
"""
import itertools
import json
import time

import numpy as np

from cube2 import N, NO, NP, Cube2

c = Cube2('htm')
dist = np.load('data/dist_htm.npy')
allS = np.arange(N, dtype=np.int64)


def bfs_small(table, size):
    """BFS on a coordinate that moves on its own (twists alone, or permutation alone)."""
    d = np.full(size, -1, np.int8)
    d[0] = 0
    fr = np.array([0])
    k = 0
    while fr.size:
        nxt = np.unique(table[fr].ravel())
        nxt = nxt[d[nxt] == -1]
        d[nxt] = k + 1
        fr = nxt
        k += 1
    return d


cands = {}
d_ori = bfs_small(c.omove, NO)
d_perm = bfs_small(c.pmove, NP)
cands['twists only'] = (d_ori[allS % NO], NO)
cands['permutation only'] = (d_perm[allS // NO], NP)

newpos, addori = c.slot_moves()
loc = np.empty((N, 7), np.int8)
cori = np.empty((N, 7), np.int8)
for a in range(0, N, 500_000):
    loc[a:a + 500_000], cori[a:a + 500_000] = c.locate(allS[a:a + 500_000])


def tracked_pdb(T):
    """Exact distances in the smaller puzzle where only corners T are tracked (slot and twist)."""
    k = len(T)
    size = 21 ** k
    pdb = np.full(size, -1, np.int8)
    start = sum((T[t] * 3) * 21 ** t for t in range(k))
    pdb[start] = 0
    fr = np.array([start], np.int64)
    pw = 21 ** np.arange(k)
    d = 0
    while fr.size:
        digits = (fr[:, None] // pw[None, :]) % 21
        lo, orr = digits // 3, digits % 3
        nxt = []
        for j in range(c.nm):
            nl = newpos[j][lo]
            no = (orr + addori[j][lo]) % 3
            nxt.append(((nl * 3 + no) * pw[None, :]).sum(1))
        nxt = np.unique(np.concatenate(nxt))
        nxt = nxt[pdb[nxt] == -1]
        pdb[nxt] = d + 1
        fr = nxt
        d += 1
    keys = ((loc[:, list(T)].astype(np.int64) * 3 + cori[:, list(T)]) * pw[None, :]).sum(1)
    return pdb, keys


coset_checks = []
t0 = time.time()
for k in range(1, 6):
    for T in itertools.combinations(range(7), k):
        pdb, keys = tracked_pdb(T)
        floor = pdb[keys]
        entries = int((pdb >= 0).sum())
        # Coset claim: the small puzzle's distance = min true distance over positions that look the same.
        mins = np.full(pdb.size, 127, np.int8)
        np.minimum.at(mins, keys, dist)
        seen = mins < 127
        coset_checks.append(bool((mins[seen] == pdb[seen]).all()) and bool((pdb[~seen] == -1).all()))
        cands[f'corners {"".join(map(str, T))}'] = (floor, entries)
print(f'built {len(cands)} floors in {time.time() - t0:.0f}s; coset claim holds for all tracked floors:',
      all(coset_checks))

rows = []
for name, (floor, entries) in cands.items():
    assert (floor >= 0).all()
    rows.append({'name': name, 'entries': entries, 'never_too_high': bool((floor <= dist).all()),
                 'mean': float(floor.mean()), 'exact_share': float((floor == dist).mean())})
assert all(r['never_too_high'] for r in rows)
print('every floor is never too high, on all 3,674,160 positions:', all(r['never_too_high'] for r in rows))

best_by_size = {}
for r in rows:
    key = r['entries']
    if key not in best_by_size or r['mean'] > best_by_size[key]['mean']:
        best_by_size[key] = r
for e in sorted(best_by_size):
    r = best_by_size[e]
    print(f"  {r['name']:<18} {e:>8,} entries  mean floor {r['mean']:.2f}  exact on {r['exact_share']:.1%}")

# Greedy search for the best collection under a memory budget (4 bits per entry).
names = list(cands)
F = np.stack([cands[n][0] for n in names])
size_bytes = np.array([cands[n][1] / 2 for n in names])
budgets = [2_000, 20_000, 100_000, 400_000]
rng = np.random.default_rng(7)
sample = rng.choice(N, 300_000, replace=False)  # choose on a sample, score on everything
Fs = F[:, sample]


def greedy(B, seed=None):
    """Add the floor with the best gain per byte until the budget is spent."""
    cur = np.zeros(sample.size, np.int8)
    used, chosen = 0.0, []
    if seed is not None:
        chosen, used, cur = [seed], size_bytes[seed], Fs[seed].copy()
    while True:
        best, best_gain = None, 0
        base = cur.mean()
        for i in range(len(names)):
            if i in chosen or used + size_bytes[i] > B:
                continue
            gain = (np.maximum(cur, Fs[i]).mean() - base) / size_bytes[i]
            if gain > best_gain:
                best, best_gain = i, gain
        if best is None:
            return chosen, used
        chosen.append(best)
        used += size_bytes[best]
        cur = np.maximum(cur, Fs[best])


collections = []
for B in budgets:
    # Plain greedy is myopic (it never buys one big table), so also try seeding it with the
    # strongest single table of each size that fits.
    seeds = [None]
    for e in sorted(set(cands[n][1] for n in names)):
        fits = [i for i in range(len(names)) if cands[names[i]][1] == e and size_bytes[i] <= B]
        if fits:
            seeds.append(max(fits, key=lambda i: Fs[i].mean()))
    best_run = None
    for sd in seeds:
        chosen, used = greedy(B, sd)
        m = np.max(Fs[chosen], axis=0).mean()
        if best_run is None or m > best_run[2]:
            best_run = (chosen, used, m, sd)
    chosen, used, _, sd = best_run
    cur = np.max(F[chosen], axis=0)
    exact = float((cur == dist).mean())
    collections.append({'budget_bytes': B, 'chosen': [names[i] for i in chosen], 'used_bytes': used,
                        'seeded_with': None if sd is None else names[sd], 'mean': float(cur.mean()),
                        'exact_share': exact, 'mean_gap': float((dist - cur).mean())})
    np.save(f'data/floor_budget_{B}.npy', cur)
    print(f'budget {B:>7,} B: {len(chosen)} tables, {used:,.0f} B, seed {collections[-1]["seeded_with"]} '
          f'-> mean floor {cur.mean():.2f}, exact on {exact:.1%}')

json.dump({'floors': rows, 'coset_claim_holds': all(coset_checks), 'collections': collections,
           'truth_mean': float(dist.mean())}, open('results/exp2_floors.json', 'w'), indent=1)
np.save('data/floor_twists.npy', cands['twists only'][0])
np.save('data/floor_perm.npy', cands['permutation only'][0])
