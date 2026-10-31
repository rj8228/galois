"""IDA* on the full 3x3: floor = max(corner floor, edge table A, edge table B).

The corner floor is any of search.py's floors (same `kind` numbers), or none (`use_corner` False).
The two 6-edge floors are looked up first; the corner floor is only computed when the edges
alone cannot prune the child, so a slow corner floor (a net) costs less time, but node counts
are the same as computing everything. Every child generated is a node.

Each corner floor value computed is compared with the true corner distance (`violations`), and
`hist` counts the true corner distance of every node generated, to show where the search spends.
"""

import numpy as np
from numba import njit

import edges
import search

# Not cached: numba's cache does not notice changes to functions in other modules, so a cached
# ida3 would keep an old search.heur after search.py changes (this happened once: the cached
# copy predated kind 5 and gave floors above the truth, which the violation count caught).


@njit
def edge_floor(es, ef, eA, eB, ts, tf):
    for i in range(6):
        ts[i] = es[i]
        tf[i] = ef[i]
    a = eA[edges.eindex(ts, tf)]
    for i in range(6):
        ts[i] = es[6 + i]
        tf[i] = ef[6 + i]
    b = eB[edges.eindex(ts, tf)]
    return np.int64(a if a > b else b)


@njit
def ida3(cstart, es0, ef0, use_corner, kind, margin, pm, tm, edest, eflip, eA, eB,
         dist, inv, cot, sA, tA, sB, tB, cls_id, sym_of, inv_of, symtab,
         scp, sco, icp, ico, W1, b1, W2, b2, W3, b3, W4, b4, keys, vals, lo, hi, max_nodes):
    """Returns (solution length or -1 if max_nodes ran out, nodes, violations, moves, hist)."""
    D = 32
    act = np.zeros(16, np.int64)
    ts = np.zeros(6, np.int64)
    tf = np.zeros(6, np.int64)
    cidx = np.zeros(D, np.int64)
    es = np.zeros((D, 12), np.int64)  # slot of each edge
    ef = np.zeros((D, 12), np.int64)  # flip of each edge
    hs = np.zeros(D, np.int64)
    mv = np.zeros(D, np.int64)
    hist = np.zeros(12, np.int64)
    nodes = 0
    viol = 0
    cidx[0] = cstart
    es[0, :] = es0
    ef[0, :] = ef0
    h0 = edge_floor(es[0], ef[0], eA, eB, ts, tf)
    if use_corner:
        hc = search.heur(kind, cstart, margin, dist, inv, cot, sA, tA, sB, tB, cls_id, sym_of, inv_of, symtab,
                         scp, sco, icp, ico, W1, b1, W2, b2, W3, b3, W4, b4, keys, vals, lo, hi, act)
        if hc > dist[cstart]:
            viol += 1
        if hc > h0:
            h0 = hc
    bound = h0
    while True:
        d = 0
        hs[0] = h0
        mv[0] = 0
        nodes += 1
        hist[dist[cstart]] += 1
        found = False
        while d >= 0:
            if cidx[d] == 0:
                solved = True
                for e in range(12):
                    if es[d, e] != e or ef[d, e] != 0:
                        solved = False
                        break
                if solved:
                    found = True
                    break
            m = mv[d]
            if m >= 18 or d + hs[d] > bound:
                d -= 1
                continue
            mv[d] = m + 1
            f = m // 3
            if d > 0:
                lf = (mv[d - 1] - 1) // 3
                if f == lf or f == lf - 3:
                    continue
            cur = cidx[d]
            nc = pm[cur // 2187, m] * 2187 + tm[cur % 2187, m]
            for e in range(12):
                s = es[d, e]
                es[d + 1, e] = edest[m, s]
                ef[d + 1, e] = (ef[d, e] + eflip[m, s]) % 2
            nodes += 1
            hist[dist[nc]] += 1
            h = edge_floor(es[d + 1], ef[d + 1], eA, eB, ts, tf)
            if d + 1 + h > bound:
                continue
            if use_corner:
                hc = search.heur(kind, nc, margin, dist, inv, cot, sA, tA, sB, tB, cls_id, sym_of, inv_of, symtab,
                                 scp, sco, icp, ico, W1, b1, W2, b2, W3, b3, W4, b4, keys, vals, lo, hi, act)
                if hc > dist[nc]:
                    viol += 1
                if hc > h:
                    h = hc
                if d + 1 + h > bound:
                    continue
            d += 1
            cidx[d] = nc
            hs[d] = h
            mv[d] = 0
            if nodes > max_nodes:
                return -1, nodes, viol, np.zeros(0, np.int64), hist
        if found:
            moves = np.zeros(d, np.int64)
            for i in range(d):
                moves[i] = mv[i] - 1
            return d, nodes, viol, moves, hist
        bound += 1
