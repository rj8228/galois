"""Step 4: IDA* on the 8-corner puzzle (all 18 face turns), with any floor.

Floors (kind):
  0 exact     the full BFS table
  1 partial   max of one or two k-corner tables
  2 symplain  the symmetry-reduced plain table (syminv: reduced by inversion too)
  3 net       MLP on the raw position, then the correction table
  4 symnet    MLP on the position's symmetry-class representative, then the correction table
  5 syminvnet  the same, with classes under the symmetries and inversion

Every floor value the search computes is also compared with the true distance; a single
value above it would be counted in `violations`.
"""

import numpy as np
from numba import njit

import cube
import plain


@njit(cache=True)
def net_forward(act, W1, b1, W2, b2, W3, b3, W4, b4):
    """The MLP on a one-hot input given by its 16 active columns (float32, fixed loop order)."""
    h1 = b1.copy()
    for a in act:
        for j in range(h1.shape[0]):
            h1[j] += W1[a, j]
    for j in range(h1.shape[0]):
        if h1[j] < 0:
            h1[j] = 0
    h2 = b2.copy()
    for i in range(h1.shape[0]):
        v = h1[i]
        if v != 0:
            for j in range(h2.shape[0]):
                h2[j] += v * W2[i, j]
    for j in range(h2.shape[0]):
        if h2[j] < 0:
            h2[j] = 0
    h3 = b3.copy()
    for i in range(h2.shape[0]):
        v = h2[i]
        if v != 0:
            for j in range(h3.shape[0]):
                h3[j] += v * W3[i, j]
    out = b4[0]
    for i in range(h3.shape[0]):
        if h3[i] > 0:
            out += h3[i] * W4[i, 0]
    return out


@njit(cache=True)
def active_cols(idx, inv, cot, act):
    p = idx // 2187
    t = idx % 2187
    for c in range(8):
        s = inv[p, c]
        act[c] = c * 8 + s
        act[8 + c] = 64 + c * 3 + cot[t, s]


@njit(cache=True)
def lookup(keys, vals, key):
    lo, hi = 0, keys.shape[0]
    while lo < hi:
        mid = (lo + hi) // 2
        if keys[mid] < key:
            lo = mid + 1
        else:
            hi = mid
    if lo < keys.shape[0] and keys[lo] == key:
        return vals[lo]
    return -1


@njit(cache=True)
def heur(kind, idx, margin, dist, inv, cot, sA, tA, sB, tB, cls_id, sym_of, inv_of, symtab,
         scp, sco, icp, ico, W1, b1, W2, b2, W3, b3, W4, b4, keys, vals, act):
    if kind == 0:
        return np.int64(dist[idx])
    p = idx // 2187
    t = idx % 2187
    if kind == 1:
        h = np.int64(plain.partial_lookup(p, t, inv, cot, sA, tA))
        if sB.shape[0] > 0:
            h2 = np.int64(plain.partial_lookup(p, t, inv, cot, sB, tB))
            if h2 > h:
                h = h2
        return h
    if kind == 2:
        return np.int64(symtab[plain.sym_plain_index(idx, cls_id, sym_of, inv_of, scp, sco, icp, ico)])
    key = idx
    if kind == 4:
        key = cube.canon_index(idx, scp, sco, icp, ico)
    elif kind == 5:
        key = cube.canon_inv_index(idx, scp, sco, icp, ico)
    c = lookup(keys, vals, key)
    if c >= 0:
        return np.int64(c)
    active_cols(key, inv, cot, act)
    pred = net_forward(act, W1, b1, W2, b2, W3, b3, W4, b4)
    h = np.int64(np.floor(pred + 0.5)) - margin
    return h if h > 0 else 0


@njit(cache=True)
def ida(start, kind, margin, pm, tm, dist, inv, cot, sA, tA, sB, tB, cls_id, sym_of, inv_of, symtab,
        scp, sco, icp, ico, W1, b1, W2, b2, W3, b3, W4, b4, keys, vals):
    """Returns (solution length, nodes visited over all iterations, floor violations)."""
    act = np.zeros(16, np.int64)
    stack_idx = np.zeros(32, np.int64)
    stack_mv = np.zeros(32, np.int64)
    stack_h = np.zeros(32, np.int64)
    nodes = 0
    viol = 0
    h0 = heur(kind, start, margin, dist, inv, cot, sA, tA, sB, tB, cls_id, sym_of, inv_of, symtab,
              scp, sco, icp, ico, W1, b1, W2, b2, W3, b3, W4, b4, keys, vals, act)
    if h0 > dist[start]:
        viol += 1
    bound = h0
    while True:
        # depth-first to `bound`; stack_mv[d] is the next move to try at depth d
        d = 0
        stack_idx[0] = start
        stack_h[0] = h0
        stack_mv[0] = 0
        nodes += 1
        found = False
        while d >= 0:
            if stack_idx[d] == 0:
                found = True
                break
            m = stack_mv[d]
            if m >= 18 or d + stack_h[d] > bound:
                d -= 1
                continue
            stack_mv[d] = m + 1
            f = m // 3
            if d > 0:
                lf = (stack_mv[d - 1] - 1) // 3
                if f == lf or f == lf - 3:
                    continue
            cur = stack_idx[d]
            nxt = pm[cur // 2187, m] * 2187 + tm[cur % 2187, m]
            h = heur(kind, nxt, margin, dist, inv, cot, sA, tA, sB, tB, cls_id, sym_of, inv_of, symtab,
                     scp, sco, icp, ico, W1, b1, W2, b2, W3, b3, W4, b4, keys, vals, act)
            nodes += 1
            if h > dist[nxt]:
                viol += 1
            if d + 1 + h > bound:
                continue
            d += 1
            stack_idx[d] = nxt
            stack_h[d] = h
            stack_mv[d] = 0
        if found:
            return d, nodes, viol
        bound += 1


def scrambles(n=50, length=12, seed=2026):
    """Random face turns, never the same face twice in a row."""
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(n):
        seq, last = [], -1
        while len(seq) < length:
            m = int(rng.integers(18))
            if m // 3 != last:
                seq.append(m)
                last = m // 3
        out.append(seq)
    return out
