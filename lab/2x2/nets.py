"""A small numpy MLP with Adam, plus random-walk sampling. Shared by the later experiments."""
import time

import numpy as np

from cube2 import NO


class MLP:
    def __init__(self, sizes, out_bias, rng):
        self.W = [(rng.standard_normal((a, b)) * np.sqrt(2 / a)).astype(np.float32) for a, b in zip(sizes, sizes[1:])]
        self.b = [np.zeros(b, np.float32) for b in sizes[1:]]
        self.b[-1][:] = out_bias
        self.m = [np.zeros_like(p) for p in self.W + self.b]
        self.v = [np.zeros_like(p) for p in self.W + self.b]
        self.t = 0

    def params(self):
        return sum(w.size for w in self.W) + sum(b.size for b in self.b)

    def forward(self, x):
        acts = [x]
        for i, (W, b) in enumerate(zip(self.W, self.b)):
            z = acts[-1] @ W + b
            acts.append(np.maximum(z, 0) if i < len(self.W) - 1 else z)
        return acts

    def step(self, acts, g, lr):
        gW, gb = [None] * len(self.W), [None] * len(self.b)
        for i in reversed(range(len(self.W))):
            gW[i] = acts[i].T @ g
            gb[i] = g.sum(0)
            if i:
                g = (g @ self.W[i].T) * (acts[i] > 0)
        self.t += 1
        for k, (p, gr) in enumerate(zip(self.W + self.b, gW + gb)):
            self.m[k] = 0.9 * self.m[k] + 0.1 * gr
            self.v[k] = 0.999 * self.v[k] + 0.001 * gr * gr
            mh = self.m[k] / (1 - 0.9 ** self.t)
            vh = self.v[k] / (1 - 0.999 ** self.t)
            p -= lr * mh / (np.sqrt(vh) + 1e-8)


def train(cube, rng, states, labels, over_weight, epochs, tag, hidden=128):
    net = MLP([70, hidden, hidden, 1], float(labels.mean()), rng)
    n, bs = len(states), 4096
    steps = epochs * (n // bs)
    t0, k = time.time(), 0
    for ep in range(epochs):
        order = rng.permutation(n)
        for a in range(0, n - bs + 1, bs):
            idx = order[a:a + bs]
            acts = net.forward(cube.features(states[idx]))
            err = acts[-1][:, 0] - labels[idx]
            g = np.where(err > 0, over_weight * err, err) * (2 / bs)
            lr = 2e-3 * 0.5 * (1 + np.cos(np.pi * k / steps))
            net.step(acts, g[:, None].astype(np.float32), lr)
            k += 1
        print(f'  {tag}: epoch {ep + 1}/{epochs} ({time.time() - t0:.0f}s)', flush=True)
    return net


def predict(cube, net, states):
    out = np.empty(len(states), np.float32)
    for a in range(0, len(states), 65536):
        out[a:a + 65536] = net.forward(cube.features(states[a:a + 65536]))[-1][:, 0]
    return out


def random_walk_set(cube, rng, n, kmax):
    """Scramble k moves from solved (never the same face twice); returns states and k."""
    ks = rng.integers(0, kmax + 1, size=n)
    s = np.zeros(n, np.int64)
    last = np.full(n, -1)
    for step in range(kmax):
        act = ks > step
        j = rng.integers(0, cube.nm, size=n)
        same = (j // 3) == last
        while same.any():
            j[same] = rng.integers(0, cube.nm, size=same.sum())
            same = (j // 3) == last
        nb = cube.pmove[s // NO, j].astype(np.int64) * NO + cube.omove[s % NO, j]
        s = np.where(act, nb, s)
        last = np.where(act, j // 3, last)
    return s, ks.astype(np.float32)
