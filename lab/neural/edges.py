"""Two 6-edge tables by BFS, as in Korf's 1997 optimal solver: edges UR UF UL UB DR DF, and
edges DL DB FR FL BL BR. Each records, for its six edges, their slots and flips:
12!/6! * 2^6 = 42,577,920 entries.

Writes data/edges_a.npy, data/edges_b.npy and results/edge_tables.json.
"""

import json
import os
import time

import numpy as np
from numba import njit, prange

import cube3

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
N_EDGE6 = 665280 * 64


@njit(cache=True)
def eindex(slots, flips):
    """Rank of the ordered tuple of 6 slots (12P6), times 2^6, plus the flips."""
    used = np.zeros(12, np.int64)
    r = 0
    for i in range(6):
        c = 0
        for v in range(slots[i]):
            if used[v] == 0:
                c += 1
        r = r * (12 - i) + c
        used[slots[i]] = 1
    o = 0
    for i in range(6):
        o = o * 2 + flips[i]
    return r * 64 + o


@njit(cache=True)
def eunindex(idx, slots, flips):
    o = idx % 64
    r = idx // 64
    for i in range(5, -1, -1):
        flips[i] = o % 2
        o //= 2
    digits = np.zeros(6, np.int64)
    for i in range(5, -1, -1):
        digits[i] = r % (12 - i)
        r //= 12 - i
    used = np.zeros(12, np.int64)
    for i in range(6):
        c = digits[i]
        for v in range(12):
            if used[v] == 0:
                if c == 0:
                    slots[i] = v
                    used[v] = 1
                    break
                c -= 1


@njit(parallel=True, cache=True)
def _level(dist, dest, flip, d, backward):
    n = dist.shape[0]
    chunk = 4096
    for b in prange((n + chunk - 1) // chunk):
        slots = np.zeros(6, np.int64)
        flips = np.zeros(6, np.int64)
        ns = np.zeros(6, np.int64)
        nf = np.zeros(6, np.int64)
        for i in range(b * chunk, min(n, (b + 1) * chunk)):
            if backward:
                if dist[i] != 255:
                    continue
            elif dist[i] != d:
                continue
            eunindex(i, slots, flips)
            for m in range(18):
                for j in range(6):
                    ns[j] = dest[m, slots[j]]
                    nf[j] = (flips[j] + flip[m, slots[j]]) % 2
                k = eindex(ns, nf)
                if backward:
                    if dist[k] == d:
                        dist[i] = d + 1
                        break
                elif dist[k] == 255:
                    dist[k] = d + 1  # benign race: every writer writes d + 1


def build(home):
    dest, flip = cube3.edge_dest_flip()
    dist = np.full(N_EDGE6, 255, np.uint8)
    dist[eindex(np.array(home, np.int64), np.zeros(6, np.int64))] = 0
    seen, d, counts = 1, 0, [1]
    while seen < N_EDGE6:
        _level(dist, dest, flip, d, seen > N_EDGE6 // 4)
        new = int(np.count_nonzero(dist == d + 1))
        if new == 0:
            break
        counts.append(new)
        seen += new
        d += 1
    assert seen == N_EDGE6, seen
    return dist, counts


def main():
    out = {}
    for name, home in (("edges_a", [0, 1, 2, 3, 4, 5]), ("edges_b", [6, 7, 8, 9, 10, 11])):
        t0 = time.time()
        dist, counts = build(home)
        np.save(os.path.join(DATA, f"{name}.npy"), dist)
        out[name] = {"edges": [cube3.EDGE_NAMES[e] for e in home], "entries": N_EDGE6, "counts": counts,
                     "max": len(counts) - 1, "mean": float(dist.mean()), "seconds": time.time() - t0}
        print(name, out[name], flush=True)
    json.dump(out, open(os.path.join(HERE, "results", "edge_tables.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
