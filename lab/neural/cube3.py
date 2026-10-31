"""The 3x3's edges, added to the corner model in cube.py, for a full-cube search.

Edges use Kociemba's labels and face turns, the same convention as the corners:
UR UF UL UB DR DF DL DB FR FL BL BR. A turn is (ep, eo): slot i receives the edge that was in
slot ep[i], flipped by eo[i]. The search tracks each edge's slot and flip instead, so a turn
sends the edge in slot s to dest[m, s] and adds flip[m, s].

    python3 cube3.py      # checks the full-cube model: position counts to depth 4, order of R U
"""

import numpy as np

import cube

EDGE_NAMES = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"]
EDGE_BASE = {
    "U": ([3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], [0] * 12),
    "R": ([8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], [0] * 12),
    "F": ([0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0]),
    "D": ([0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], [0] * 12),
    "L": ([0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], [0] * 12),
    "B": ([0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1]),
}


def edge_mul(a, b):
    """a, then b."""
    ep = [a[0][b[0][i]] for i in range(12)]
    eo = [(a[1][b[0][i]] + b[1][i]) % 2 for i in range(12)]
    return ep, eo


def edge_moves():
    """18 x (ep, eo) for U U2 U' R ... B'."""
    out = []
    for f in "URFDLB":
        m = EDGE_BASE[f]
        cur = m
        for _ in range(3):
            out.append(cur)
            cur = edge_mul(cur, m)
    return out


def edge_dest_flip():
    """dest[m, s]: the slot the edge in slot s moves to; flip[m, s]: the flip it picks up."""
    dest = np.zeros((18, 12), np.int64)
    flip = np.zeros((18, 12), np.int64)
    for m, (ep, eo) in enumerate(edge_moves()):
        for j in range(12):
            dest[m, ep[j]] = j
            flip[m, ep[j]] = eo[j]
    return dest, flip


def apply(state, m, pm, tm, dest, flip):
    """Full-cube state (corner index, edge slots, edge flips), after move m."""
    c, es, eo = state
    c2 = int(pm[c // 2187, m] * 2187 + tm[c % 2187, m])
    es2 = tuple(int(dest[m, s]) for s in es)
    eo2 = tuple((eo[e] + int(flip[m, es[e]])) % 2 for e in range(12))
    return c2, es2, eo2


SOLVED = (0, tuple(range(12)), (0,) * 12)


def check():
    pm, tm = cube.move_tables()
    dest, flip = edge_dest_flip()
    # positions at each distance, HTM: 1, 18, 243, 3240, 43239 (known values)
    seen = {SOLVED}
    frontier = [SOLVED]
    counts = [1]
    for _ in range(4):
        nxt = []
        for s in frontier:
            for m in range(18):
                t = apply(s, m, pm, tm, dest, flip)
                if t not in seen:
                    seen.add(t)
                    nxt.append(t)
        frontier = nxt
        counts.append(len(nxt))
    assert counts == [1, 18, 243, 3240, 43239], counts
    # R U has order 105 on the full cube: 15 on the corners and 7 on the edges
    s, k = SOLVED, 0
    while True:
        s = apply(apply(s, 3, pm, tm, dest, flip), 0, pm, tm, dest, flip)
        k += 1
        if s == SOLVED:
            break
    assert k == 105, k
    return counts, k


if __name__ == "__main__":
    print(check())
