"""Experiment 4: gravity (false valleys) and the full bounds framework.

Gravity: treat each heuristic as a landscape and drop a ball. Count, over every position,
the false valleys (no neighbour strictly lower, yet not solved), then roll balls from 1,000
random positions, with and without heat (simulated annealing). Networks are rolled on their
raw, unrounded outputs, which is how a finder would use them.

Prover: IDA* with every heuristic. Heuristics that can be too high get a node limit, because
overestimates near the goal make IDA* keep raising its bound and the work explodes.

Framework: a network-guided beam search proposes a ceiling, the best math floor proves it,
and every answer is scored against the truth table.
"""
import json
import math
import time

import numpy as np

from cube2 import N, NO, Cube2

c = Cube2('htm')
dist = np.load('data/dist_htm.npy')
allS = np.arange(N, dtype=np.int64)
floors = {
    'floor: twists only': np.load('data/floor_twists.npy'),
    'floor: permutation only': np.load('data/floor_perm.npy'),
    'floor: best tables, 2 KB': np.load('data/floor_budget_2000.npy'),
    'floor: best tables, 20 KB': np.load('data/floor_budget_20000.npy'),
    'floor: best tables, 100 KB': np.load('data/floor_budget_100000.npy'),
    'floor: best tables, 400 KB': np.load('data/floor_budget_400000.npy'),
}
nets_int = {
    'net A: scramble labels': np.load('data/h_A.npy'),
    'net B: exact, squared error': np.load('data/h_B.npy'),
    'net C: exact, overestimates x30': np.load('data/h_C.npy'),
    'net C + correction table': np.load('data/h_Cx.npy'),
}
nets_int['hybrid: net C + table, max 20 KB floor'] = np.maximum(nets_int['net C + correction table'],
                                                                floors['floor: best tables, 20 KB'])
nets_raw = {
    'net A raw: scramble labels': np.load('data/raw_A.npy'),
    'net B raw: exact, squared error': np.load('data/raw_B.npy'),
    'net C raw: exact, overestimates x30': np.load('data/raw_C.npy'),
}
rng = np.random.default_rng(42)
bench = rng.choice(N, 1000, replace=False)
out = {'benchmark_true_mean': float(dist[bench].mean())}

# ---------------- Gravity ----------------
landscapes = {'true distance': dist, **floors, **nets_raw, 'net C + correction table': nets_int['net C + correction table']}
nbs = [c.nb(allS, j) for j in range(c.nm)]


def roll(h, s, rng, heat=False, steps=300):
    """Steepest descent (ties random). With heat: Metropolis moves under a cooling temperature."""
    path = [s]
    for t in range(steps):
        if s == 0:
            break
        p, o = divmod(s, NO)
        nb = [c.pm[p][j] * NO + c.om[o][j] for j in range(c.nm)]
        if heat:
            T = 1.5 * (1 - t / steps) + 0.05
            cand = nb[rng.integers(c.nm)]
            dlt = float(h[cand]) - float(h[s])
            if dlt <= 0 or rng.random() < math.exp(-dlt / T):
                s = cand
        else:
            vals = [h[x] for x in nb]
            m = min(vals)
            if m >= h[s]:
                break  # stuck: a false valley or a flat plateau
            s = nb[rng.choice([i for i, v in enumerate(vals) if v == m])]
        path.append(s)
    if s != 0:
        return None
    seen, clean = {}, []  # drop loops so the move count is honest
    for x in path:
        if x in seen:
            clean = clean[:seen[x] + 1]
            seen = {y: i for i, y in enumerate(clean)}
        else:
            seen[x] = len(clean)
            clean.append(x)
    return len(clean) - 1


gravity = {}
for name, h in landscapes.items():
    nbmin = np.min(np.stack([h[nb] for nb in nbs]), axis=0)
    stuck = (allS != 0) & (nbmin >= h)
    g = {'no_downhill_share': float(stuck.mean()), 'no_downhill': int(stuck.sum())}
    hl = h.tolist()
    for heat in (False, True):
        ok, opt, excess = 0, 0, []
        for s in bench.tolist():
            L = roll(hl, s, rng, heat)
            if L is not None:
                ok += 1
                opt += L == dist[s]
                excess.append(L - int(dist[s]))
        g['with heat' if heat else 'pure gravity'] = {
            'reached_solved': ok / len(bench), 'optimal_share_of_all': opt / len(bench),
            'mean_excess_moves': float(np.mean(excess)) if excess else None}
    gravity[name] = g
    print(f"{name:<38} no downhill {g['no_downhill_share']:7.2%}  roll ok {g['pure gravity']['reached_solved']:6.1%} "
          f"(optimal {g['pure gravity']['optimal_share_of_all']:6.1%})  heat ok {g['with heat']['reached_solved']:6.1%}",
          flush=True)
out['gravity'] = gravity


# ---------------- Prover: IDA* ----------------
class GaveUp(Exception):
    pass


def ida(s0, h, cap=None, ceiling=None):
    """IDA*. Returns (length, nodes, bounds). With a ceiling, stop as soon as the bound reaches it:
    every shorter length has then been ruled out, so the ceiling itself is proven optimal."""
    faces, pm, om = c.faces, c.pm, c.om
    path, bounds = [], []
    nodes = 0
    FOUND = -1

    def dfs(s, g, bound, lastface):
        nonlocal nodes
        nodes += 1
        if cap and nodes > cap:
            raise GaveUp
        f = g + h[s]
        if f > bound:
            return f
        if s == 0:
            return FOUND
        best = 99
        p, o = divmod(s, NO)
        pp, oo = pm[p], om[o]
        for j in range(9):
            if faces[j] == lastface:
                continue
            path.append(j)
            r = dfs(pp[j] * NO + oo[j], g + 1, bound, faces[j])
            if r == FOUND:
                return FOUND
            path.pop()
            if r < best:
                best = r
        return best

    bound = h[s0]
    while True:
        if ceiling is not None and bound >= ceiling:
            return ceiling, nodes, bounds
        bounds.append(bound)
        r = dfs(s0, 0, bound, -1)
        if r == FOUND:
            return len(path), nodes, bounds
        bound = r


prover = {}
for name, h in {**floors, **nets_int}.items():
    admissible = bool((h <= dist).all())
    hb = bytes(h.astype(np.uint8).tolist())
    # Heuristics that can be too high get 20,000 nodes per position, on the first 300 positions.
    cap = None if admissible else 20_000
    pos = bench if admissible else bench[:300]
    t0 = time.time()
    nodes, opt, gave_up = [], 0, 0
    for s in pos.tolist():
        try:
            L, n, _ = ida(s, hb, cap)
            nodes.append(n)
            opt += L == dist[s]
        except GaveUp:
            gave_up += 1
    prover[name] = {'admissible': admissible, 'positions': len(pos), 'node_cap': cap,
                    'optimal_share': opt / len(pos), 'gave_up_share': gave_up / len(pos),
                    'mean_nodes_when_finished': float(np.mean(nodes)) if nodes else None,
                    'mean_floor_on_benchmark': float(h[bench].mean()), 'seconds': round(time.time() - t0, 1)}
    p = prover[name]
    print(f"IDA* {name:<38} optimal {p['optimal_share']:6.1%}  gave up {p['gave_up_share']:6.1%}  "
          f"mean nodes {p['mean_nodes_when_finished'] or 0:>10,.0f}  admissible {admissible}  ({p['seconds']}s)",
          flush=True)
out['prover'] = prover
out['blind_nodes_to_prove'] = {d: 1 + 9 * (6 ** (d - 1) - 1) // 5 for d in range(1, 12)}


# ---------------- Framework: AI ceiling + math floor + prover ----------------
def beam(s0, h, width=64, maxdepth=20):
    """Network-guided beam search (the CayleyPy / EfficientCube style of finder)."""
    if s0 == 0:
        return 0
    layer = {s0: -1}  # state -> last face
    for depth in range(1, maxdepth + 1):
        nxt = {}
        for s, lastface in layer.items():
            p, o = divmod(s, NO)
            for j in range(9):
                if c.faces[j] == lastface:
                    continue
                t = c.pm[p][j] * NO + c.om[o][j]
                if t == 0:
                    return depth
                nxt.setdefault(t, c.faces[j])
        keep = sorted(nxt, key=lambda t: h[t])[:width]
        layer = {t: nxt[t] for t in keep}
    return None


finder = nets_raw['net B raw: exact, squared error'].tolist()
floor = floors['floor: best tables, 400 KB']
fb = bytes(floor.astype(np.uint8).tolist())
rows = []
t0 = time.time()
for s in bench.tolist():
    ceil = beam(s, finder)
    L0, n0, _ = ida(s, fb)  # prover alone
    if ceil == floor[s]:
        L1, n1 = ceil, 0  # floor meets ceiling: proven with no search at all
    else:
        L1, n1, _ = ida(s, fb, ceiling=ceil)
    assert L0 == dist[s] and L1 == dist[s]
    rows.append((ceil, int(floor[s]), int(dist[s]), n0, n1))
rows = np.array(rows, dtype=float)
frame = {
    'positions': len(bench),
    'ceiling_found_share': float(np.mean(~np.isnan(rows[:, 0]))),
    'ceiling_optimal_share': float(np.mean(rows[:, 0] == rows[:, 2])),
    'instant_certificate_share': float(np.mean(rows[:, 0] == rows[:, 1])),
    'mean_gap_ceiling_minus_floor': float(np.mean(rows[:, 0] - rows[:, 1])),
    'mean_nodes_prover_alone': float(rows[:, 3].mean()),
    'mean_nodes_with_ceiling': float(rows[:, 4].mean()),
    'all_answers_match_truth': True,
    'seconds': round(time.time() - t0, 1),
}
deep = int(bench[np.argmax(dist[bench])])
_, n, bounds = ida(deep, fb)
frame['trace'] = {'true': int(dist[deep]), 'ceiling_from_network': beam(deep, finder), 'floor_at_start': int(floor[deep]),
                  'floor_steps': [int(b) for b in bounds], 'nodes': n}
out['framework'] = frame
print('framework:', json.dumps(frame), flush=True)
json.dump(out, open('results/exp4_gravity_framework.json', 'w'), indent=1)
