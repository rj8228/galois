"""Step 1: the 8-corner table by breadth-first search. This is the truth everything is checked against.

Writes data/corner.npy (uint8, one byte per position; the 4-bit packed table is 44 MB) and
data/move_perm.npy, data/move_twist.npy.
"""

import json
import os
import time

import numpy as np
from numba import njit, prange

import cube

DATA = os.path.join(os.path.dirname(__file__), "data")


@njit(parallel=True, cache=True)
def _level(dist, pm, tm, d, backward):
    n = dist.shape[0]
    count = np.zeros(n // 2187, np.int64)
    for p in prange(n // 2187):
        c = 0
        for t in range(2187):
            i = p * 2187 + t
            if backward:
                if dist[i] == 255:
                    for m in range(18):
                        j = pm[p, m] * 2187 + tm[t, m]
                        if dist[j] == d:
                            dist[i] = d + 1
                            c += 1
                            break
            elif dist[i] == d:
                for m in range(18):
                    j = pm[p, m] * 2187 + tm[t, m]
                    if dist[j] == 255:
                        dist[j] = d + 1  # benign race: every writer writes d + 1
        count[p] = c
    return count.sum()


def build():
    os.makedirs(DATA, exist_ok=True)
    pm, tm = cube.move_tables()
    dist = np.full(cube.N_STATES, 255, np.uint8)
    dist[0] = 0
    seen, d, counts = 1, 0, [1]
    t0 = time.time()
    while seen < cube.N_STATES:
        backward = seen > cube.N_STATES // 4
        _level(dist, pm, tm, d, backward)
        new = int(np.count_nonzero(dist == d + 1))
        if new == 0:
            break
        counts.append(new)
        seen += new
        d += 1
        print(f"depth {d}: {new:,} ({time.time() - t0:.0f}s)", flush=True)
    assert seen == cube.N_STATES, seen
    np.save(os.path.join(DATA, "corner.npy"), dist)
    np.save(os.path.join(DATA, "move_perm.npy"), pm)
    np.save(os.path.join(DATA, "move_twist.npy"), tm)
    mean = sum(k * c for k, c in enumerate(counts)) / cube.N_STATES
    out = {"states": cube.N_STATES, "max_depth": d, "counts": counts, "mean": mean,
           "bytes_4bit": cube.N_STATES // 2, "seconds": time.time() - t0}
    json.dump(out, open(os.path.join(os.path.dirname(__file__), "results", "corner_table.json"), "w"), indent=1)
    print(out)


if __name__ == "__main__":
    os.makedirs(os.path.join(os.path.dirname(__file__), "results"), exist_ok=True)
    build()
