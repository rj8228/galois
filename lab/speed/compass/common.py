"""Shared pieces for the compass experiments: data, floors (and their component tables), and a
compiled IDA* with exp8 counting and a pluggable child order.

Data comes from lab/2x2/data (rebuild with lab/2x2/exp1_truth.py and exp2_floors.py).
"""
import json
import os
import sys

import numba as nb
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
LAB2 = os.path.normpath(os.path.join(HERE, '..', '..', '2x2'))
sys.path.insert(0, LAB2)
from cube2 import N, NO, Cube2  # noqa: E402

DATA = os.path.join(HERE, 'data')
os.makedirs(DATA, exist_ok=True)
os.makedirs(os.path.join(HERE, 'results'), exist_ok=True)

BUDGETS = [2_000, 20_000, 100_000, 400_000]
FLOOR_NAME = {2_000: '2 KB + mirror', 20_000: '20 KB + mirror', 100_000: '100 KB + mirror', 400_000: '400 KB + mirror'}

cube = Cube2('htm')
dist = np.load(os.path.join(LAB2, 'data', 'dist_htm.npy'))
inv = np.load(os.path.join(LAB2, 'data', 'inverse_htm.npy'))
bench = np.random.default_rng(42).choice(N, 1000, replace=False)
PM = cube.pmove.astype(np.int32)
OM = cube.omove.astype(np.int32)
FACES = np.array(cube.faces, np.int32)
allS = np.arange(N, dtype=np.int64)


def neighbours(s):
    """(len(s), 9) array of children."""
    return PM[s // NO].astype(np.int64) * NO + OM[s % NO]


def floor(B):
    """The budget-B floor with the mirror lookup: max(h(x), h(x^-1))."""
    h = np.load(os.path.join(LAB2, 'data', f'floor_budget_{B}.npy'))
    return np.maximum(h, h[inv]).astype(np.int8)


# ---------- component tables (rebuilt, because exp2 saves only their max) ----------
_loc = None


def _locate_all():
    global _loc
    if _loc is None:
        loc = np.empty((N, 7), np.int8)
        cori = np.empty((N, 7), np.int8)
        for a in range(0, N, 500_000):
            loc[a:a + 500_000], cori[a:a + 500_000] = cube.locate(allS[a:a + 500_000])
        _loc = (loc, cori)
    return _loc


def _bfs_small(table, size):
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


def component(name):
    """Per-position floor from one named table of lab/2x2/exp2 (cached in data/)."""
    path = os.path.join(DATA, f'comp_{name.replace(" ", "_")}.npy')
    if os.path.exists(path):
        return np.load(path)
    if name == 'twists only':
        f = _bfs_small(cube.omove, NO)[allS % NO]
    elif name == 'permutation only':
        f = _bfs_small(cube.pmove, 5040)[allS // NO]
    else:
        T = [int(ch) for ch in name.split()[1]]
        newpos, addori = cube.slot_moves()
        k = len(T)
        pdb = np.full(21 ** k, -1, np.int8)
        start = sum((T[t] * 3) * 21 ** t for t in range(k))
        pdb[start] = 0
        fr = np.array([start], np.int64)
        pw = 21 ** np.arange(k)
        d = 0
        while fr.size:
            digits = (fr[:, None] // pw[None, :]) % 21
            lo, orr = digits // 3, digits % 3
            nxt = []
            for j in range(cube.nm):
                nl = newpos[j][lo]
                no = (orr + addori[j][lo]) % 3
                nxt.append(((nl * 3 + no) * pw[None, :]).sum(1))
            nxt = np.unique(np.concatenate(nxt))
            nxt = nxt[pdb[nxt] == -1]
            pdb[nxt] = d + 1
            fr = nxt
            d += 1
        loc, cori = _locate_all()
        keys = ((loc[:, T].astype(np.int64) * 3 + cori[:, T]) * pw[None, :]).sum(1)
        f = pdb[keys]
    f = f.astype(np.int8)
    assert (f <= dist).all() and (f >= 0).all()
    np.save(path, f)
    return f


def chosen_tables(B):
    res = json.load(open(os.path.join(LAB2, 'results', 'exp2_floors.json')))
    return next(c['chosen'] for c in res['collections'] if c['budget_bytes'] == B)


# ---------- compiled IDA* with exp8 counting ----------
# Order modes: 0 = move order; m >= 1 = static key per child (lower first; ties keep move order), applied only at
# nodes with at least m - 1 moves left in the budget (m = 1: everywhere).
# score_evals counts key evaluations, only at nodes with two or more surviving children
# (a lone survivor needs no ranking). Counts are split into all rounds and the final round.

@nb.njit
def _dfs(s, g, bound, lastface, h, key, mode, pm, om, faces, st, stack_t, stack_k, depth):
    if s == 0:
        return -1
    p = s // 729
    o = s % 729
    best = 99
    n = 0
    base = depth * 9
    for j in range(9):
        if faces[j] == lastface:
            continue
        t = pm[p, j] * 729 + om[o, j]
        st[0] += 1
        f = g + 1 + h[t]
        if f > bound:
            if f < best:
                best = f
            continue
        stack_t[base + n] = t
        stack_k[base + n] = j
        n += 1
    if mode >= 1 and n > 1 and bound - g >= mode - 1:
        st[1] += n
        # insertion sort by key, stable
        for a in range(1, n):
            tt = stack_t[base + a]
            jj = stack_k[base + a]
            kv = key[tt]
            b = a - 1
            while b >= 0 and key[stack_t[base + b]] > kv:
                stack_t[base + b + 1] = stack_t[base + b]
                stack_k[base + b + 1] = stack_k[base + b]
                b -= 1
            stack_t[base + b + 1] = tt
            stack_k[base + b + 1] = jj
    for i in range(n):
        t = stack_t[base + i]
        r = _dfs(t, g + 1, bound, faces[stack_k[base + i]], h, key, mode, pm, om, faces, st, stack_t, stack_k,
                 depth + 1)
        if r == -1:
            return -1
        if r < best:
            best = r
    return best


@nb.njit
def ida(s0, h, key, mode, pm, om, faces):
    """Returns (total lookups, final-round lookups, total key evals, final-round key evals, length)."""
    st = np.zeros(2, np.int64)
    stack_t = np.zeros(9 * 40, np.int64)
    stack_k = np.zeros(9 * 40, np.int64)
    st[0] += 1
    bound = h[s0]
    while True:
        b0 = st[0]
        e0 = st[1]
        r = _dfs(s0, 0, bound, -1, h, key, mode, pm, om, faces, st, stack_t, stack_k, 0)
        if r == -1:
            return st[0], st[0] - b0, st[1], st[1] - e0, bound
        bound = r


@nb.njit
def run_bench(states, h, key, mode, pm, om, faces):
    out = np.zeros((states.size, 5), np.int64)
    for i in range(states.size):
        a, b, c, d, L = ida(states[i], h, key, mode, pm, om, faces)
        out[i, 0] = a
        out[i, 1] = b
        out[i, 2] = c
        out[i, 3] = d
        out[i, 4] = L
    return out


def evaluate(h, key=None, states=None, min_left=0):
    """Run the benchmark. Asserts every length equals the truth table."""
    states = bench if states is None else states
    mode = 0 if key is None else 1 + min_left
    k = np.zeros(1, np.float32) if key is None else np.ascontiguousarray(key, dtype=np.float32)
    out = run_bench(states.astype(np.int64), h, k, mode, PM, OM, FACES)
    optimal = int((out[:, 4] == dist[states]).sum())
    assert optimal == len(states), 'non-optimal solution'
    return {'mean_lookups': float(out[:, 0].mean()), 'mean_final_round_lookups': float(out[:, 1].mean()),
            'mean_key_evals': float(out[:, 2].mean()), 'mean_final_round_key_evals': float(out[:, 3].mean()),
            'optimal': optimal, 'positions': len(states)}


# ---------- recording where the final round spends time ----------
@nb.njit
def _dfs_rec(s, g, bound, lastface, h, pm, om, faces, rec, nrec, stack_t, depth):
    if s == 0:
        return -1
    p = s // 729
    o = s % 729
    best = 99
    n = 0
    base = depth * 9
    for j in range(9):
        if faces[j] == lastface:
            continue
        t = pm[p, j] * 729 + om[o, j]
        f = g + 1 + h[t]
        if f > bound:
            if f < best:
                best = f
            continue
        stack_t[base + n] = j
        n += 1
    if n > 1 and nrec[0] < rec.shape[0]:
        k = nrec[0]
        rec[k, 0] = s
        rec[k, 1] = bound - g  # moves left in the budget at this node
        m = 0
        for i in range(n):
            m |= 1 << stack_t[base + i]
        rec[k, 2] = m  # mask of surviving moves
        nrec[0] += 1
    for i in range(n):
        j = stack_t[base + i]
        t = pm[p, j] * 729 + om[o, j]
        r = _dfs_rec(t, g + 1, bound, faces[j], h, pm, om, faces, rec, nrec, stack_t, depth + 1)
        if r == -1:
            return -1
        if r < best:
            best = r
    return best


@nb.njit
def record_final_rounds(states, h, pm, om, faces, cap):
    """Every node with two or more survivors, in the final round of IDA* (move order), over the given roots."""
    rec = np.zeros((cap, 3), np.int64)
    nrec = np.zeros(1, np.int64)
    stack_t = np.zeros(9 * 40, np.int64)
    for i in range(states.size):
        s0 = states[i]
        bound = h[s0]
        # find the final bound first (proof rounds are not recorded)
        while True:
            dummy = np.zeros((1, 3), np.int64)
            dn = np.ones(1, np.int64)  # full, so nothing recorded
            r = _dfs_rec(s0, 0, bound, -1, h, pm, om, faces, dummy, dn, stack_t, 0)
            if r == -1:
                break
            bound = r
        _dfs_rec(s0, 0, bound, -1, h, pm, om, faces, rec, nrec, stack_t, 0)
        if nrec[0] >= cap:
            break
    return rec[:nrec[0]]


def save_rows(rows, name):
    path = os.path.join(HERE, 'results', name)
    json.dump(rows, open(path, 'w'), indent=1)
