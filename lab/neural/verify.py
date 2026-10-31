"""Step 3: check a trained net on every one of the 88,179,840 positions, build its correction
table, and count bytes.

For each weight format (fp16, int8) and margin m in {0, 1, 2}:
  net floor     h(s) = max(0, floor(pred(s) + 0.5) - m)
  correction    every position (raw net) or symmetry class (sym net) where the net floor, computed
                with a guard of DELTA added to pred, exceeds the true distance; it stores the truth
  final floor   the stored truth if s has a correction, else the net floor
The guard covers float summation order differing between this batched numpy pass and the
one-position-at-a-time numba forward used in search: as long as the two preds differ by less
than DELTA, the search's net floor is at most the guarded one. The largest difference is
measured and reported (max_pred_diff), and must be below DELTA.

Correction bytes: Elias-Fano coded sorted keys (universe 88,179,840) plus 4 bits per value.
Also reported: the simple layout of a sorted uint32 key + uint8 value (5 bytes each).

    python3 verify.py raw512
"""

import json
import math
import os
import sys
import time

import numpy as np

import cube
import nn
import search

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
DELTA = 1e-3
U = cube.N_STATES


def ef_bytes(n):
    if n == 0:
        return 0
    low = max(0, math.ceil(math.log2(U / n)))
    return math.ceil(n * (2 + low) / 8) + math.ceil(n * 4 / 8)


def load(name):
    """fp32 weights from the training checkpoint, or from the committed weights/ copy."""
    path = os.path.join(HERE, "checkpoints", name + ".npz")
    if not os.path.exists(path):
        path = os.path.join(HERE, "weights", name + ".npz")
    z = np.load(path, allow_pickle=True)
    sizes = [int(s) for s in z["sizes"]]
    params = [z[f"p{i}"] for i in range(2 * (len(sizes) - 1))]
    return params, sizes, bool(z["sym"]), float(z["over"])


def predict(params, feats, idx, batch=1 << 17):
    out = np.empty(len(idx), np.float32)
    for i in range(0, len(idx), batch):
        out[i:i + batch] = nn.forward(params, feats.dense(idx[i:i + batch]))
    return out


def main(name):
    t0 = time.time()
    params, sizes, sym, over = load(name)
    dist = np.load(os.path.join(DATA, "corner.npy"))
    feats = nn.Features()
    if sym:
        reps = np.load(os.path.join(DATA, "reps.npy")).astype(np.int64)
        rep_of = np.searchsorted(reps, np.load(os.path.join(DATA, "canon.npy")))  # class number per position
        pool = reps
    else:
        pool = np.arange(U, dtype=np.int64)
    truth = dist[pool]
    res = {"name": name, "sizes": sizes, "sym": sym, "over_weight": over, "params": nn.n_params(params),
           "positions_checked": U, "delta": DELTA, "formats": {}}
    rng = np.random.default_rng(7)
    for kind in ("fp16", "int8"):
        q = nn.as_fp16(params) if kind == "fp16" else nn.as_int8(params)
        pred = predict(q, feats, pool)
        # numba forward on 200k sampled inputs vs the batched pass
        sample = rng.integers(0, len(pool), 200_000)
        act = np.zeros(16, np.int64)
        inv, cot = feats.inv, feats.co
        rt = np.array([search.net_forward((search.active_cols(pool[i], inv, cot, act), act)[1], *q) for i in sample],
                      np.float32)
        diff = float(np.abs(rt - pred[sample]).max())
        assert diff < DELTA, diff
        wbytes = nn.weight_bytes(params, kind)
        fmt = {"weight_bytes": wbytes, "max_pred_diff": diff, "margins": {}}
        for m in (0, 1, 2):
            guarded = np.maximum(np.floor(pred + 0.5 + DELTA) - m, 0).astype(np.int64)
            bad = guarded > truth
            keys = pool[bad]
            vals = truth[bad]
            final = np.where(bad, truth, guarded)
            # exhaustive: every one of the 88M positions, via its class for the sym net
            per_pos = final[rep_of] if sym else final
            assert (per_pos <= dist).all(), "a floor above the truth"
            n = int(bad.sum())
            raw_net = np.maximum(np.floor(pred + 0.5) - m, 0)
            net_pos = raw_net[rep_of] if sym else raw_net
            np.savez(os.path.join(DATA, f"corr_{name}_{kind}_m{m}.npz"), keys=keys, vals=vals.astype(np.int8))
            fmt["margins"][m] = {
                "corrections": n,
                "correction_bytes_ef": ef_bytes(n),
                "correction_bytes_simple": 5 * n,
                "total_bytes": wbytes + ef_bytes(n),
                "mean_floor": float(per_pos.mean()),
                "exact_fraction": float((per_pos == dist).mean()),
                "net_over_fraction": float((net_pos > dist).mean()),
                "max_floor_minus_truth": int((per_pos.astype(np.int64) - dist).max()),
            }
            print(kind, m, fmt["margins"][m], flush=True)
        res["formats"][kind] = fmt
    res["seconds"] = time.time() - t0
    os.makedirs(os.path.join(HERE, "weights"), exist_ok=True)
    np.savez_compressed(os.path.join(HERE, "weights", name + ".npz"), sizes=np.array(sizes), sym=sym, over=over,
                        **{f"p{i}": p for i, p in enumerate(params)})
    json.dump(res, open(os.path.join(HERE, "results", f"verify_{name}.json"), "w"), indent=1)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main(sys.argv[1])
