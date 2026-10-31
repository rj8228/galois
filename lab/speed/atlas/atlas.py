"""T1 search atlas: where the optimal solver spends its time, for every one of the 3,674,160 2×2 positions.

Needs the 2×2 lab's arrays (run lab/2x2 exp1, exp2 first). Writes per-position arrays to data/ (not committed)
and aggregates to results/aggregates.json and results/frontier.json.

Lookups are counted as in lab/2x2/exp7: one per position generated (each is one floor read); the IDA* rounds,
cut-on-arrival rule and tight-parent split are the same as exp7, rewritten as an iterative numba loop.
"""
import json
import os
import sys
import time

import numba as nb
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.normpath(os.path.join(HERE, '..', '..', '2x2'))
sys.path.insert(0, LAB)
from cube2 import NO, Cube2  # noqa: E402

DATA_IN = os.path.join(LAB, 'data')
DATA = os.path.join(HERE, 'data')
RES = os.path.join(HERE, 'results')
os.makedirs(DATA, exist_ok=True)
os.makedirs(RES, exist_ok=True)

c = Cube2('htm')
N = 5040 * NO
dist = np.load(os.path.join(DATA_IN, 'dist_htm.npy')).astype(np.int8)
inv = np.load(os.path.join(DATA_IN, 'inverse_htm.npy'))
sigma = np.load(os.path.join(DATA_IN, 'sigma_htm.npy'))
pmove = c.pmove.astype(np.int64)
omove = c.omove.astype(np.int64)
faces = np.array(c.faces, np.int64)
rng = np.random.default_rng(42)
bench = rng.choice(N, 1000, replace=False)
allS = np.arange(N, dtype=np.int64)
t0 = time.time()


def log(msg):
    print(f'[{time.time() - t0:6.0f}s] {msg}', flush=True)


# ---------------- Doors home and symmetry classes ----------------
doors = np.zeros(N, np.float64)
doors[0] = 1
for d in range(1, int(dist.max()) + 1):
    layer = allS[dist == d]
    acc = np.zeros(layer.size)
    for j in range(c.nm):
        nbr = c.nb(layer, j)
        down = dist[nbr] == d - 1
        acc[down] += doors[nbr[down]]
    doors[layer] = acc
assert (doors >= 1).all()

orbit = [allS, sigma, sigma[sigma], inv, sigma[inv], sigma[sigma[inv]], inv[sigma], inv[sigma[sigma]]]
cls = np.minimum.reduce(orbit)
n_classes = int(np.unique(cls).size)
same_d = all(bool((dist[o] == dist).all()) for o in orbit)
same_doors = all(bool((doors[o] == doors).all()) for o in orbit)
log(f'doors home done; {n_classes:,} symmetry classes; distance invariant {same_d}, doors invariant {same_doors}')
np.save(os.path.join(DATA, 'doors.npy'), doors)
np.save(os.path.join(DATA, 'class.npy'), cls)

# ---------------- Floors ----------------
FLOOR_FILES = {
    'twists only': ('floor_twists.npy', 729),
    'places only': ('floor_perm.npy', 5040),
    '2 KB': ('floor_budget_2000.npy', 2000),
    '20 KB': ('floor_budget_20000.npy', 20000),
    '100 KB': ('floor_budget_100000.npy', 100000),
    '400 KB': ('floor_budget_400000.npy', 400000),
}
floors = {}
for name, (fname, size) in FLOOR_FILES.items():
    h = np.load(os.path.join(DATA_IN, fname)).astype(np.uint8)
    hm = np.maximum(h, h[inv])
    assert (h <= dist).all() and (hm <= dist).all(), f'{name}: floor above the truth'
    floors[name] = (h, size)
    floors[name + ' + mirror'] = (hm, size)


# ---------------- IDA* anatomy, every position ----------------
@nb.njit(cache=True)
def solve_one(s0, h, pmove, omove, faces):
    """Returns length, total, final-round lookups, cut under tight parent, cut under loose parent, expansions, rounds."""
    st_state = np.empty(40, np.int64)
    st_move = np.empty(40, np.int64)
    st_last = np.empty(40, np.int64)
    st_tight = np.empty(40, np.bool_)
    bound = np.int64(h[s0])
    total = 0
    cut_t = 0
    cut_l = 0
    expd = 0
    rounds = 0
    while True:
        rounds += 1
        rnd = 1
        total += 1
        nxt = 1 << 30
        found = -1
        if s0 == 0:
            found = 0
        else:
            expd += 1
            depth = 0
            st_state[0] = s0
            st_move[0] = 0
            st_last[0] = -1
            st_tight[0] = h[s0] == bound
            while depth >= 0:
                if st_move[depth] >= 9:
                    depth -= 1
                    continue
                j = st_move[depth]
                st_move[depth] += 1
                if faces[j] == st_last[depth]:
                    continue
                s = st_state[depth]
                p = s // 729
                o = s - p * 729
                t = pmove[p, j] * 729 + omove[o, j]
                g = depth + 1
                total += 1
                rnd += 1
                ft = g + h[t]
                if ft > bound:
                    if st_tight[depth]:
                        cut_t += 1
                    else:
                        cut_l += 1
                    if ft < nxt:
                        nxt = ft
                    continue
                if t == 0:
                    found = g
                    break
                expd += 1
                depth += 1
                st_state[depth] = t
                st_move[depth] = 0
                st_last[depth] = faces[j]
                st_tight[depth] = ft == bound
        if found >= 0:
            return found, total, rnd, cut_t, cut_l, expd, rounds
        bound = nxt


@nb.njit(parallel=True, cache=True)
def solve_all(states, h, pmove, omove, faces):
    n = states.size
    out = np.empty((n, 7), np.int64)
    for i in nb.prange(n):
        r = solve_one(states[i], h, pmove, omove, faces)
        for k in range(7):
            out[i, k] = r[k]
    return out


COLS = ['length', 'total', 'final', 'cut_tight', 'cut_loose', 'expansions', 'rounds']
ATLAS_FLOORS = ['400 KB + mirror', '100 KB + mirror', '20 KB + mirror', '2 KB + mirror', '20 KB']
anatomy = {}
for name in ATLAS_FLOORS:
    h = floors[name][0]
    tt = time.time()
    a = solve_all(allS, h, pmove, omove, faces)
    ok = bool((a[:, 0] == dist).all())
    assert ok, f'{name}: a solution length differs from the truth table'
    anatomy[name] = a
    np.save(os.path.join(DATA, f'anatomy_{name.replace(" ", "_").replace("+", "plus")}.npy'), a)
    log(f'{name}: all {N:,} solves optimal; mean lookups {a[:, 1].mean():,.1f}; {time.time() - tt:.0f}s')

# The benchmark rows for every floor, so the frontier has the same 1,000 positions as exp7.
bench_rows = []
for name, (h, size) in floors.items():
    a = solve_all(bench, h, pmove, omove, faces)
    assert (a[:, 0] == dist[bench]).all()
    bench_rows.append((name, size, a))


# ---------------- Aggregates ----------------
def tail_shares(work):
    srt = np.sort(work)[::-1].astype(np.float64)
    tot = srt.sum()
    return {f'top_{p}': float(srt[: max(1, int(round(len(srt) * p / 100)))].sum() / tot) for p in (0.1, 1, 10, 50)}


def residual(x, groups):
    """x minus its group mean (for partial correlation controlling for distance)."""
    out = x.astype(np.float64).copy()
    for g in np.unique(groups):
        m = groups == g
        out[m] -= out[m].mean()
    return out


agg = {'positions': N, 'symmetry_classes': n_classes, 'distance_invariant_on_classes': same_d,
       'doors_invariant_on_classes': same_doors, 'floors': {}}
dists = range(int(dist.max()) + 1)
agg['doors_by_distance'] = {
    int(d): {
        'count': int((dist == d).sum()),
        'mean': float(doors[dist == d].mean()),
        'median': float(np.median(doors[dist == d])),
        'max': float(doors[dist == d].max()),
        'share_unique': float((doors[dist == d] == 1).mean()),
        'histogram': {int(k): int(v) for k, v in zip(*np.unique(np.minimum(doors[dist == d], 256).astype(int), return_counts=True))},
    }
    for d in dists
}
agg['share_unique_overall'] = float((doors == 1).mean())

for name in ATLAS_FLOORS:
    a = anatomy[name]
    h = floors[name][0]
    total, final = a[:, 1].astype(np.float64), a[:, 2].astype(np.float64)
    proof = total - final
    gap = (dist.astype(int) - h.astype(int))
    f = {
        'mean_lookups': float(total.mean()),
        'mean_proof': float(proof.mean()),
        'mean_find': float(final.mean()),
        'find_share_of_all_work': float(final.sum() / total.sum()),
        'cut_on_arrival_share': float((a[:, 3] + a[:, 4]).sum() / total.sum()),
        'cut_below_tight_parent_share': float(a[:, 3].sum() / total.sum()),
        'expansions_share': float(a[:, 5].sum() / total.sum()),
        'tail': tail_shares(total),
        'by_distance': {},
        'by_gap': {},
        'work_map': {},
    }
    for d in dists:
        m = dist == d
        if not m.any():
            continue
        f['by_distance'][int(d)] = {'mean_lookups': float(total[m].mean()), 'mean_proof': float(proof[m].mean()),
                                    'mean_find': float(final[m].mean()), 'work_share': float(total[m].sum() / total.sum())}
    for g in np.unique(gap):
        m = gap == g
        f['by_gap'][int(g)] = {'positions': int(m.sum()), 'mean_lookups': float(total[m].mean()),
                               'work_share': float(total[m].sum() / total.sum())}
    for d in dists:
        for g in np.unique(gap[dist == d]):
            m = (dist == d) & (gap == g)
            f['work_map'][f'{d},{g}'] = {'positions': int(m.sum()), 'mean_lookups': float(total[m].mean()),
                                         'work_share': float(total[m].sum() / total.sum())}
    # Gap law: fit log(mean work) against the starting gap, weighted by positions.
    gs = np.array(sorted(f['by_gap']), dtype=float)
    ws = np.array([f['by_gap'][int(g)]['mean_lookups'] for g in gs])
    cnt = np.array([f['by_gap'][int(g)]['positions'] for g in gs], dtype=float)
    slope, icpt = np.polyfit(gs, np.log(ws), 1, w=np.sqrt(cnt))
    f['gap_law_base'] = float(np.exp(slope))
    # Top 1%: what marks the most expensive positions.
    top = total >= np.quantile(total, 0.99)
    f['top1pct_profile'] = {'mean_distance': float(dist[top].mean()), 'mean_gap': float(gap[top].mean()),
                            'median_doors': float(np.median(doors[top])), 'share_unique_door': float((doors[top] == 1).mean())}
    f['overall_profile'] = {'mean_distance': float(dist.mean()), 'mean_gap': float(gap.mean()),
                            'median_doors': float(np.median(doors)), 'share_unique_door': float((doors == 1).mean())}
    # Few doors, slow find? Raw and partial (within-distance) correlation of log find cost with log doors.
    lf, ld = np.log(final + 1), np.log(doors)
    far = dist >= 1
    f['corr_find_doors_raw'] = float(np.corrcoef(lf[far], ld[far])[0, 1])
    f['corr_find_doors_within_distance'] = float(np.corrcoef(residual(lf[far], dist[far]), residual(ld[far], dist[far]))[0, 1])
    f['corr_find_doors_by_distance'] = {int(d): float(np.corrcoef(lf[dist == d], ld[dist == d])[0, 1])
                                        for d in range(5, int(dist.max()) + 1)}
    # Symmetry: the same class can cost very different amounts, because the tables are not symmetric.
    order = np.argsort(cls, kind='stable')
    cs, ts = cls[order], total[order]
    starts = np.r_[0, np.flatnonzero(np.diff(cs)) + 1]
    mx = np.maximum.reduceat(ts, starts)
    mn = np.minimum.reduceat(ts, starts)
    f['symmetry_spread'] = {'median_max_over_min': float(np.median(mx / mn)), 'mean_class_min_over_mean': float(
        mn.sum() / (ts.sum() / (len(ts) / len(starts))) / len(starts))}
    agg['floors'][name] = f
    log(f"{name}: find share {f['find_share_of_all_work']:.1%}, top 1% {f['tail']['top_1']:.1%}, top 10% {f['tail']['top_10']:.1%}, "
        f"gap base {f['gap_law_base']:.2f}, corr(find, doors) raw {f['corr_find_doors_raw']:+.2f} within-d {f['corr_find_doors_within_distance']:+.2f}, "
        f"symmetry max/min median {f['symmetry_spread']['median_max_over_min']:.2f}")

json.dump(agg, open(os.path.join(RES, 'aggregates.json'), 'w'), indent=1)

frontier = []
for name, size, a in bench_rows:
    total, final = a[:, 1].astype(float), a[:, 2].astype(float)
    frontier.append({'task': 'atlas', 'puzzle': '2x2', 'method': 'IDA* baseline' + (' + mirror' if 'mirror' in name else ''),
                     'floor': name, 'floor_bytes': size, 'extra_bytes': 0, 'positions': 1000,
                     'optimal': int((a[:, 0] == dist[bench]).sum()), 'lookups_counting': 'exp7',
                     'mean_lookups': float(total.mean()), 'mean_final_round_lookups': float(final.mean()),
                     'mean_extra_work': 0, 'extra_work_unit': None, 'mean_ms': None, 'impl': 'numba', 'notes': 'benchmark'})
for name in ATLAS_FLOORS:
    a = anatomy[name]
    total, final = a[:, 1].astype(float), a[:, 2].astype(float)
    frontier.append({'task': 'atlas', 'puzzle': '2x2', 'method': 'IDA* baseline' + (' + mirror' if 'mirror' in name else ''),
                     'floor': name, 'floor_bytes': floors[name][1], 'extra_bytes': 0, 'positions': N,
                     'optimal': int((a[:, 0] == dist).sum()), 'lookups_counting': 'exp7',
                     'mean_lookups': float(total.mean()), 'mean_final_round_lookups': float(final.mean()),
                     'mean_extra_work': 0, 'extra_work_unit': None, 'mean_ms': None, 'impl': 'numba', 'notes': 'every position'})
json.dump(frontier, open(os.path.join(RES, 'frontier.json'), 'w'), indent=1)
log('done')
