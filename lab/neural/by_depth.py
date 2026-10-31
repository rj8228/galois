"""Mean floor by true distance, for symmetry-aware nets (all 88,179,840 positions, via their class).

The mean floor over all positions is dominated by distances 9 and 10, but the 12-move scrambles
start at distances 4-9, so a floor can rank differently on the two.

    python3 by_depth.py sym512 sym512e30 sym256
"""

import json
import os
import sys

import numpy as np

import nn
import verify

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


def main(names):
    dist = np.load(os.path.join(DATA, "corner.npy"))
    reps = np.load(os.path.join(DATA, "reps.npy")).astype(np.int64)
    size = np.bincount(np.searchsorted(reps, np.load(os.path.join(DATA, "canon.npy"))), minlength=len(reps))
    truth = dist[reps].astype(np.int64)
    weight = np.bincount(truth, weights=size)
    feats = nn.Features()
    out = {"distances": list(range(len(weight)))}
    for name in names:
        params, sizes, sym, _ = verify.load(name)
        assert sym
        q = nn.as_int8(params)
        pred = verify.predict(q, feats, reps)
        out[name] = {}
        for m in (0, 1, 2):
            h = np.maximum(np.floor(pred + 0.5) - m, 0).astype(np.int64)
            h = np.where(h > truth, truth, h)  # with corrections
            out[name][f"int8_m{m}"] = [round(float(x), 3) for x in np.bincount(truth, weights=size * h) / weight]
        print(name, out[name], flush=True)
    json.dump(out, open(os.path.join(HERE, "results", "by_depth.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1:])
