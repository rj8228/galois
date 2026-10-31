"""Plain tables to compare against, per byte: partial corner tables and the symmetry-reduced table.

A k-corner table records, for k chosen corners, their slots and twists (8!/(8-k)! * 3^k entries),
built by its own BFS. Each is a true floor for the 8-corner puzzle. The max of several is too.

The symmetry-reduced table stores one entry per (corner-permutation class, twist) under the 48
symmetries: 984-ish permutation classes * 2187 twists, plus a 40320-entry perm -> (class, sym) map.
"""

import json
import os
from math import perm

import numpy as np
from numba import njit, prange

import cube

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


@njit(cache=True)
def partial_index(slots, twists, k):
    """Rank of the ordered slot tuple (8Pk) times 3^k plus the twists."""
    used = np.zeros(8, np.int64)
    r = 0
    for i in range(k):
        c = 0
        for v in range(slots[i]):
            if used[v] == 0:
                c += 1
        r = r * (8 - i) + c
        used[slots[i]] = 1
    t = 0
    for i in range(k):
        t = t * 3 + twists[i]
    return r * 3 ** k + t


@njit(cache=True)
def _partial_bfs(home, mcp, mco, size):
    k = home.shape[0]
    # slot j moves to slot dest[m, j] with twist added tw[m, j]
    dest = np.zeros((18, 8), np.int64)
    tw = np.zeros((18, 8), np.int64)
    for m in range(18):
        for jp in range(8):
            dest[m, mcp[m, jp]] = jp
            tw[m, mcp[m, jp]] = mco[m, jp]
    dist = np.full(size, 255, np.uint8)
    q = np.zeros(size, np.int64)
    qs = np.zeros((size, k), np.int8)
    qt = np.zeros((size, k), np.int8)
    slots = home.copy()
    twists = np.zeros(k, np.int64)
    i0 = partial_index(slots, twists, k)
    dist[i0] = 0
    q[0] = i0
    qs[0, :] = slots
    qt[0, :] = 0
    head, tail = 0, 1
    ns = np.zeros(k, np.int64)
    nt = np.zeros(k, np.int64)
    while head < tail:
        d = dist[q[head]]
        for m in range(18):
            for i in range(k):
                ns[i] = dest[m, qs[head, i]]
                nt[i] = (qt[head, i] + tw[m, qs[head, i]]) % 3
            j = partial_index(ns, nt, k)
            if dist[j] == 255:
                dist[j] = d + 1
                q[tail] = j
                qs[tail, :] = ns
                qt[tail, :] = nt
                tail += 1
        head += 1
    return dist


def partial_table(subset):
    mcp, mco = cube.move_cubies()
    k = len(subset)
    return _partial_bfs(np.array(subset, np.int64), mcp, mco, perm(8, k) * 3 ** k)


def subset_name(subset):
    return "c" + "".join(map(str, subset))


# ---------------------------------------------------------------- symmetry-reduced plain table
@njit(cache=True)
def _perm_classes(scp, sco, icp, ico, use_inverse):
    """For each corner permutation p: the smallest permutation it maps to under the 48
    symmetries (and, if use_inverse, also from p's inverse), with the symmetry that does it."""
    cls_rep = np.full(40320, -1, np.int64)
    sym_of = np.zeros(40320, np.int64)
    inv_of = np.zeros(40320, np.int64)
    cp = np.zeros(8, np.int64); z = np.zeros(8, np.int64)
    a = np.zeros(8, np.int64); b = np.zeros(8, np.int64)
    ocp = np.zeros(8, np.int64); oco = np.zeros(8, np.int64)
    ip = np.zeros(8, np.int64)
    for p in range(40320):
        cube.perm_unrank(p, cp)
        for i in range(8):
            ip[cp[i]] = i
        best, bs, bi = p, 0, 0
        for v in range(2 if use_inverse else 1):
            src = ip if v == 1 else cp
            for s in range(48):
                cube.conj(src, z, s, scp, sco, icp, ico, a, b, ocp, oco)
                r = cube.perm_rank(ocp)
                if r < best:
                    best, bs, bi = r, s, v
        cls_rep[p] = best
        sym_of[p] = bs
        inv_of[p] = bi
    return cls_rep, sym_of, inv_of


@njit(cache=True)
def sym_plain_index(idx, cls_id, sym_of, inv_of, scp, sco, icp, ico):
    cp = np.zeros(8, np.int64); co = np.zeros(8, np.int64)
    a = np.zeros(8, np.int64); b = np.zeros(8, np.int64)
    ocp = np.zeros(8, np.int64); oco = np.zeros(8, np.int64)
    p = idx // 2187
    cube.decode(idx, cp, co)
    if inv_of[p] == 1:  # use the inverse position, which is the same distance from solved
        for i in range(8):
            a[cp[i]] = i
            b[cp[i]] = (3 - co[i]) % 3
        cp[:] = a
        co[:] = b
    cube.conj(cp, co, sym_of[p], scp, sco, icp, ico, a, b, ocp, oco)
    return cls_id[p] * 2187 + cube.twist_coord(oco)


@njit(cache=True)
def _fill_sym(dist, cls_id, sym_of, inv_of, scp, sco, icp, ico, table):
    bad = 0
    for i in range(dist.shape[0]):
        j = sym_plain_index(i, cls_id, sym_of, inv_of, scp, sco, icp, ico)
        if table[j] == 255:
            table[j] = dist[i]
        elif table[j] != dist[i]:
            bad += 1
    return bad


def sym_plain(dist, use_inverse=False):
    scp, sco, icp, ico = cube.symmetries()
    cls_rep, sym_of, inv_of = _perm_classes(scp, sco, icp, ico, use_inverse)
    reps = np.unique(cls_rep)
    cls_id = np.searchsorted(reps, cls_rep)
    table = np.full(len(reps) * 2187, 255, np.uint8)
    bad = _fill_sym(dist, cls_id, sym_of, inv_of, scp, sco, icp, ico, table)
    assert bad == 0, bad
    return table, cls_id, sym_of, inv_of, len(reps)


SUBSETS = {
    "k3": [[0, 1, 2]],
    "k4": [[0, 1, 2, 3]],
    "k4x2": [[0, 1, 2, 3], [4, 5, 6, 7]],
    "k5": [[0, 1, 2, 3, 4]],
    "k5x2": [[0, 1, 2, 3, 4], [3, 4, 5, 6, 7]],
    "k6": [[0, 1, 2, 3, 4, 5]],
    "k6x2": [[0, 1, 2, 3, 4, 5], [2, 3, 4, 5, 6, 7]],
}


def build():
    out = {}
    for subset in sorted({tuple(s) for v in SUBSETS.values() for s in v}):
        t = partial_table(subset)
        assert (t != 255).all()
        np.save(os.path.join(DATA, f"partial_{subset_name(subset)}.npy"), t)
        out[subset_name(subset)] = {"entries": int(t.size), "max": int(t.max())}
        print(subset, t.size, flush=True)
    dist = np.load(os.path.join(DATA, "corner.npy"))
    for name, use_inverse in (("symplain", False), ("syminv", True)):
        table, cls_id, sym_of, inv_of, n_cls = sym_plain(dist, use_inverse)
        np.save(os.path.join(DATA, f"{name}.npy"), table)
        np.save(os.path.join(DATA, f"{name}_cls.npy"), cls_id)
        np.save(os.path.join(DATA, f"{name}_sym.npy"), sym_of)
        np.save(os.path.join(DATA, f"{name}_inv.npy"), inv_of)
        out[name] = {"perm_classes": n_cls, "entries": int(table.size), "unfilled": int((table == 255).sum())}
        print(name, out[name], flush=True)
    print(out, flush=True)
    json.dump(out, open(os.path.join(HERE, "results", "plain_tables.json"), "w"), indent=1)



# ---------------------------------------------------------------- exhaustive floor strength
@njit(cache=True)
def partial_lookup(p, t, inv, cot, subset, table):
    """A k-corner table's value at position (perm p, twist t); inv/cot from nn.coord_tables."""
    k = subset.shape[0]
    slots = np.zeros(k, np.int64)
    tw = np.zeros(k, np.int64)
    for i in range(k):
        s = inv[p, subset[i]]
        slots[i] = s
        tw[i] = cot[t, s]
    return table[partial_index(slots, tw, k)]


@njit(parallel=True, cache=True)
def _partial_floor_all(inv, cot, sA, tA, sB, tB, out):
    for p in prange(40320):
        for t in range(2187):
            h = partial_lookup(p, t, inv, cot, sA, tA)
            if sB.shape[0] > 0:
                h2 = partial_lookup(p, t, inv, cot, sB, tB)
                if h2 > h:
                    h = h2
            out[p * 2187 + t] = h


def floor_stats():
    """Bytes and mean floor over all 88,179,840 positions for every plain floor."""
    import nn
    dist = np.load(os.path.join(DATA, "corner.npy"))
    inv, cot = nn.coord_tables()
    path = os.path.join(HERE, "results", "plain_tables.json")
    out = json.load(open(path))
    floors = {}
    empty = np.zeros(0, np.int64)
    for name, subs in SUBSETS.items():
        tabs = [np.load(os.path.join(DATA, f"partial_{subset_name(s)}.npy")) for s in subs]
        h = np.zeros(cube.N_STATES, np.uint8)
        sB, tB = (np.array(subs[1], np.int64), tabs[1]) if len(subs) > 1 else (empty, tabs[0])
        _partial_floor_all(inv, cot, np.array(subs[0], np.int64), tabs[0], sB, tB, h)
        assert (h <= dist).all()
        floors[name] = {"bytes": int(sum((t.size + 1) // 2 for t in tabs)), "mean_floor": float(h.mean()),
                        "exact_fraction": float((h == dist).mean())}
        print(name, floors[name], flush=True)
    # perm -> (class, symmetry[, inverse flag]) in 2 bytes per permutation, packed mixed-radix:
    # symplain class * 48 + sym < 984 * 48 = 47,232; syminv (class * 48 + sym) * 2 + inv < 62,784
    perm_map = 2 * 40320
    for name in ("symplain", "syminv"):
        n = out[name]["entries"]
        floors[name] = {"bytes": (n + 1) // 2 + perm_map, "mean_floor": float(dist.mean()), "exact_fraction": 1.0}
        floors[name + "_mod3"] = {"bytes": (n + 3) // 4 + perm_map, "mean_floor": float(dist.mean()),
                                  "exact_fraction": 1.0}
    floors["full_4bit"] = {"bytes": cube.N_STATES // 2, "mean_floor": float(dist.mean()), "exact_fraction": 1.0}
    floors["full_mod3"] = {"bytes": cube.N_STATES // 4, "mean_floor": float(dist.mean()), "exact_fraction": 1.0}
    out["floors"] = floors
    json.dump(out, open(path, "w"), indent=1)


def build_sym():
    path = os.path.join(HERE, "results", "plain_tables.json")
    out = json.load(open(path))
    out.pop("sym", None)
    dist = np.load(os.path.join(DATA, "corner.npy"))
    for name, use_inverse in (("symplain", False), ("syminv", True)):
        table, cls_id, sym_of, inv_of, n_cls = sym_plain(dist, use_inverse)
        np.save(os.path.join(DATA, f"{name}.npy"), table)
        np.save(os.path.join(DATA, f"{name}_cls.npy"), cls_id)
        np.save(os.path.join(DATA, f"{name}_sym.npy"), sym_of)
        np.save(os.path.join(DATA, f"{name}_inv.npy"), inv_of)
        out[name] = {"perm_classes": n_cls, "entries": int(table.size), "unfilled": int((table == 255).sum())}
        print(name, out[name], flush=True)
    json.dump(out, open(path, "w"), indent=1)


if __name__ == "__main__":
    import sys
    {"stats": floor_stats, "sym": build_sym}.get(sys.argv[1] if sys.argv[1:] else "", build)()
