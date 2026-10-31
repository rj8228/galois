"""Inversion as well as symmetry, for both sides: a position and its inverse are the same distance
from solved, so a floor only needs values for one representative per class under the 48
symmetries and inversion (934,778 classes, against 1,841,970 under the symmetries alone).

  perimeter tables  perim{k}inv: the same values as perim{k}, stored for fewer classes
  sym nets          {net}inv: the same trained net, evaluated at the class representative, with
                    corrections only for those representatives (no retraining)

Every floor is checked on all 88,179,840 positions, as in verify.py.
Writes data/corr_*inv_*.npz and results/inverse.json.

    python3 inverse.py sym512e30 sym512 sym256
"""

import json
import os
import sys

import numpy as np
from numba import njit, prange

import cube
import nn
import search
import verify

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


@njit(parallel=True, cache=True)
def _inverse_all(out):
    for i in prange(out.shape[0]):
        out[i] = cube.inverse_index(i)


def main(nets):
    dist = np.load(os.path.join(DATA, "corner.npy"))
    canon = np.load(os.path.join(DATA, "canon.npy"))
    inv_idx = np.zeros(cube.N_STATES, np.int32)
    _inverse_all(inv_idx)
    rep = np.minimum(canon, canon[inv_idx])
    del inv_idx
    assert (dist[rep] == dist).all(), "a position and its inverse at different distances"
    reps = np.unique(rep).astype(np.int64)
    rep_of = np.searchsorted(reps, rep)
    del rep
    truth = dist[reps].astype(np.int64)
    out = {"classes": int(len(reps)), "positions_checked": cube.N_STATES, "perimeter": {}, "nets": {}}
    print("classes", len(reps), flush=True)

    for k in (5, 6, 7):
        near = truth <= k
        np.savez(os.path.join(DATA, f"corr_perim{k}inv_const_m0.npz"), keys=reps[near], vals=truth[near].astype(np.int8))
        final = np.where(near, truth, k + 1)[rep_of]
        assert np.array_equal(final, np.minimum(dist, k + 1))
        out["perimeter"][f"perim{k}inv"] = {"k": k, "entries": int(near.sum()), "bytes": verify.ef_bytes(int(near.sum())),
                                            "mean_floor": float(final.mean()),
                                            "exact_fraction": float((final == dist).mean())}
        print(f"perim{k}inv", out["perimeter"][f"perim{k}inv"], flush=True)

    feats = nn.Features()
    rng = np.random.default_rng(11)
    for name in nets:
        params, sizes, sym, over = verify.load(name)
        assert sym, "inversion only applies to nets that read a class representative"
        q = nn.as_int8(params)
        pred = verify.predict(q, feats, reps)
        act = np.zeros(16, np.int64)
        sample = rng.integers(0, len(reps), 50_000)
        rt = np.array([search.net_forward((search.active_cols(reps[i], feats.inv, feats.co, act), act)[1], *q)
                       for i in sample], np.float32)
        diff = float(np.abs(rt - pred[sample]).max())
        assert diff < verify.DELTA, diff
        wbytes = nn.weight_bytes(params, "int8")
        res = {"weight_bytes": wbytes, "max_pred_diff": diff, "margins": {}}
        for m in (0, 1, 2):
            guarded = np.maximum(np.floor(pred + 0.5 + verify.DELTA) - m, 0).astype(np.int64)
            bad = guarded > truth
            np.savez(os.path.join(DATA, f"corr_{name}inv_int8_m{m}.npz"), keys=reps[bad], vals=truth[bad].astype(np.int8))
            per_pos = np.where(bad, truth, guarded)[rep_of]
            assert (per_pos <= dist).all(), "a floor above the truth"
            n = int(bad.sum())
            res["margins"][m] = {"corrections": n, "correction_bytes_ef": verify.ef_bytes(n),
                                 "total_bytes": wbytes + verify.ef_bytes(n), "mean_floor": float(per_pos.mean()),
                                 "exact_fraction": float((per_pos == dist).mean()),
                                 "max_floor_minus_truth": int((per_pos.astype(np.int64) - dist).max())}
            print(f"{name}inv m{m}", res["margins"][m], flush=True)
        out["nets"][name + "inv"] = res
    json.dump(out, open(os.path.join(HERE, "results", "inverse.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1:])
