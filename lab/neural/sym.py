"""The 48 symmetries: checked against the BFS table, then every position mapped to its class.

Writes data/canon.npy (int32 class representative per position) and data/reps.npy (sorted reps).
"""

import json
import os
import time

import numpy as np
from numba import njit, prange

import cube

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "data")


@njit(parallel=True, cache=True)
def _canon_all(out, scp, sco, icp, ico):
    for i in prange(out.shape[0]):
        out[i] = cube.canon_index(i, scp, sco, icp, ico)


@njit(cache=True)
def _check(dist, idxs, scp, sco, icp, ico):
    cp = np.zeros(8, np.int64); co = np.zeros(8, np.int64)
    a = np.zeros(8, np.int64); b = np.zeros(8, np.int64)
    ocp = np.zeros(8, np.int64); oco = np.zeros(8, np.int64)
    bad = 0
    for i in idxs:
        cube.decode(i, cp, co)
        for s in range(48):
            cube.conj(cp, co, s, scp, sco, icp, ico, a, b, ocp, oco)
            for k in range(8):
                if oco[k] >= 3:
                    bad += 1000000
            if dist[cube.encode(ocp, oco)] != dist[i]:
                bad += 1
    return bad


def main():
    dist = np.load(os.path.join(DATA, "corner.npy"))
    scp, sco, icp, ico = cube.symmetries()
    assert len({(tuple(a), tuple(b)) for a, b in zip(scp, sco)}) == 48
    rng = np.random.default_rng(1)
    bad = _check(dist, rng.integers(0, cube.N_STATES, 2_000_000), scp, sco, icp, ico)
    print("symmetry check on 2M random positions x 48: mismatches =", bad)
    assert bad == 0
    t0 = time.time()
    canon = np.zeros(cube.N_STATES, np.int32)
    _canon_all(canon, scp, sco, icp, ico)
    reps = np.unique(canon)
    assert np.array_equal(dist[canon], dist), "a class holds two distances"
    print(f"classes: {len(reps):,} ({time.time() - t0:.0f}s)")
    np.save(os.path.join(DATA, "canon.npy"), canon)
    np.save(os.path.join(DATA, "reps.npy"), reps)
    json.dump({"symmetries": 48, "classes": int(len(reps)), "checked_positions": cube.N_STATES},
              open(os.path.join(HERE, "results", "symmetry.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
