"""The zero-parameter baseline: a perimeter table.

Store the exact distance of every position within distance k of solved; every other position
is at least k + 1 away, so k + 1 is a safe floor there. This is "a constant plus corrections":
the same lookup the nets use, with the net replaced by the constant k + 1, and the same
Elias-Fano byte count. The sym version stores symmetry-class representatives instead.

Writes data/corr_perim{k}[sym]_const_m0.npz for run_search.py and results/perimeter.json.
"""

import json
import os

import numpy as np

import cube
import verify

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


def main():
    dist = np.load(os.path.join(DATA, "corner.npy"))
    reps = np.load(os.path.join(DATA, "reps.npy")).astype(np.int64)
    out = {}
    for k in (5, 6, 7):
        floor = np.minimum(dist, k + 1)
        assert (floor <= dist).all()
        stats = {"mean_floor": float(floor.mean()), "exact_fraction": float((floor == dist).mean())}
        for sym in (False, True):
            name = f"perim{k}{'sym' if sym else ''}"
            pool = reps if sym else np.arange(cube.N_STATES, dtype=np.int64)
            near = dist[pool] <= k
            keys, vals = pool[near], dist[pool][near].astype(np.int8)
            np.savez(os.path.join(DATA, f"corr_{name}_const_m0.npz"), keys=keys, vals=vals)
            out[name] = {"k": k, "sym": sym, "entries": int(len(keys)), "bytes": verify.ef_bytes(len(keys)), **stats}
            print(name, out[name], flush=True)
    json.dump(out, open(os.path.join(HERE, "results", "perimeter.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
