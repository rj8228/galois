"""Alternative learned compass: regress the true distance of x (mirror-aware one-hot of x and x^-1), MSE,
on uniform positions (benchmark excluded). Same compass use: lower predicted distance is tried first.
Usage: python3 distance_regressor.py [hidden] [epochs]
"""
import os
import sys
import time

import numpy as np

from common import DATA, HERE, N, bench, cube, dist, inv

H = int(sys.argv[1]) if len(sys.argv) > 1 else 64
EP = int(sys.argv[2]) if len(sys.argv) > 2 else 2
rng = np.random.default_rng(7)
mask = np.ones(N, bool)
mask[bench] = False
train = np.flatnonzero(mask)


def feats(s):
    return np.concatenate([cube.features(s), cube.features(inv[s])], 1)


W1 = (rng.standard_normal((140, H)) * np.sqrt(2 / 14)).astype(np.float32)
b1 = np.zeros(H, np.float32)
W2 = (rng.standard_normal((H, 1)) * np.sqrt(1 / H)).astype(np.float32)
b2 = np.full(1, dist.mean(), np.float32)
params = [W1, b1, W2, b2]
m = [np.zeros_like(p) for p in params]
v = [np.zeros_like(p) for p in params]
bs = 2048
steps = EP * (len(train) // bs)
k = 0
t0 = time.time()
for ep in range(EP):
    order = rng.permutation(train)
    for a in range(0, len(order) - bs + 1, bs):
        idx = order[a:a + bs]
        x = feats(idx)
        a1 = np.maximum(x @ W1 + b1, 0)
        y = (a1 @ W2 + b2)[:, 0]
        g = ((y - dist[idx]) * (2 / bs)).astype(np.float32)[:, None]
        gW2, gb2 = a1.T @ g, g.sum(0)
        ga = (g @ W2.T) * (a1 > 0)
        gW1, gb1 = x.T @ ga, ga.sum(0)
        k += 1
        lr = 2e-3 * 0.5 * (1 + np.cos(np.pi * k / steps))
        for i, (p, gr) in enumerate(zip(params, [gW1, gb1, gW2, gb2])):
            m[i] = 0.9 * m[i] + 0.1 * gr
            v[i] = 0.999 * v[i] + 0.001 * gr * gr
            p -= lr * (m[i] / (1 - 0.9 ** k)) / (np.sqrt(v[i] / (1 - 0.999 ** k)) + 1e-8)
    print(f'  epoch {ep + 1}/{EP} [{time.time() - t0:.0f}s]', flush=True)
score = np.empty(N, np.float32)
for a in range(0, N, 200_000):
    s = np.arange(a, min(N, a + 200_000))
    score[s] = (np.maximum(feats(s) @ W1 + b1, 0) @ W2 + b2)[:, 0]
print(f'RMSE on benchmark {np.sqrt(((score[bench] - dist[bench]) ** 2).mean()):.3f}, '
      f'corr {np.corrcoef(score[bench], dist[bench])[0, 1]:.3f}')
tag = f'reg_mirror_{H}'
np.savez(os.path.join(HERE, 'results', f'weights_{tag}.npz'), W1=W1, b1=b1, W2=W2, b2=b2)
np.save(os.path.join(DATA, f'score_{tag}.npy'), score)
