"""A small ReLU MLP in numpy: features, forward, quantisation and byte counts.

Input (88 floats): for each corner c, a one-hot of the slot it sits in (8) and of its twist (3).
Output: one number, the predicted distance. The floor at margin m is max(0, round(pred) - m).
"""

import numpy as np

import cube

N_IN = 88


def coord_tables():
    """Slot-of-corner and twist-of-corner for every perm and twist coordinate."""
    from cube import perm_unrank, twist_uncoord
    inv = np.zeros((cube.N_PERM, 8), np.int64)
    cp = np.zeros(8, np.int64)
    for p in range(cube.N_PERM):
        perm_unrank(p, cp)
        inv[p, cp] = np.arange(8)
    co = np.zeros((cube.N_TWIST, 8), np.int64)
    for t in range(cube.N_TWIST):
        twist_uncoord(t, co[t])
    return inv, co


class Features:
    def __init__(self):
        self.inv, self.co = coord_tables()
        self.cols_slot = np.arange(8) * 8
        self.cols_tw = 64 + np.arange(8) * 3

    def active(self, idx):
        """(B, 16) column numbers of the ones in each position's input."""
        p, t = idx // 2187, idx % 2187
        slot = self.inv[p]                                  # slot of corner c
        tw = np.take_along_axis(self.co[t], slot, axis=1)   # twist of corner c
        return np.concatenate([self.cols_slot + slot, self.cols_tw + tw], axis=1)

    def dense(self, idx):
        a = self.active(idx)
        x = np.zeros((len(idx), N_IN), np.float32)
        np.put_along_axis(x, a, 1.0, axis=1)
        return x


def init(sizes, rng):
    params = []
    for a, b in zip(sizes[:-1], sizes[1:]):
        params.append((rng.standard_normal((a, b)).astype(np.float32) * np.sqrt(2.0 / a)).astype(np.float32))
        params.append(np.zeros(b, np.float32))
    params[-1][:] = 8.0  # start at the typical distance
    return params


def forward(params, x, keep=False):
    acts = [x]
    h = x
    n = len(params) // 2
    for k in range(n):
        h = h @ params[2 * k] + params[2 * k + 1]
        if k < n - 1:
            np.maximum(h, 0, out=h)
        if keep:
            acts.append(h)
    return (h[:, 0], acts) if keep else h[:, 0]


def backward(params, acts, dpred):
    grads = [None] * len(params)
    g = dpred[:, None].astype(np.float32)
    n = len(params) // 2
    for k in range(n - 1, -1, -1):
        grads[2 * k] = acts[k].T @ g
        grads[2 * k + 1] = g.sum(0)
        if k > 0:
            g = g @ params[2 * k].T
            g *= acts[k] > 0
    return grads


def n_params(params):
    return int(sum(p.size for p in params))


# ---------------------------------------------------------------- quantisation
def as_fp16(params):
    return [p.astype(np.float16).astype(np.float32) for p in params]


def as_int8(params):
    """Per-output-unit symmetric int8 weights with an fp16 scale; biases kept fp16."""
    out = []
    for k, p in enumerate(params):
        if k % 2 == 0:
            scale = np.abs(p).max(axis=0) / 127.0
            scale = np.where(scale == 0, 1.0, scale).astype(np.float16).astype(np.float32)
            q = np.clip(np.round(p / scale), -127, 127)
            out.append((q * scale).astype(np.float32))
        else:
            out.append(p.astype(np.float16).astype(np.float32))
    return out


def weight_bytes(params, kind):
    w = sum(p.size for p in params[0::2])
    units = sum(p.size for p in params[1::2])
    if kind == "fp16":
        return 2 * (w + units)
    return w + 2 * units + 2 * units  # int8 weights, fp16 scale and fp16 bias per unit
