"""Learned compass: a small MLP scores each surviving child; lower score is tried first.

Trained listwise: at each recorded node, a softmax over the surviving children (logit = -score), and the loss is
-log(probability mass on the children that still reach solved within the budget). Numpy, hand-written backprop.
Training nodes come from final rounds of IDA* on random roots (never the 1,000 benchmark positions), at all four
floors, plus nodes on optimal paths of uniform positions. Deterministic (fixed seeds).

Usage: python3 learned_ranker.py [hidden] [inputs: plain|mirror]
"""
import json
import os
import sys
import time

import numpy as np

from common import BUDGETS, DATA, FACES, HERE, N, OM, PM, bench, cube, dist, floor, inv, neighbours, \
    record_final_rounds

H = int(sys.argv[1]) if len(sys.argv) > 1 else 32
INPUTS = sys.argv[2] if len(sys.argv) > 2 else 'mirror'
rng = np.random.default_rng(2026)
benchset = set(bench.tolist())


def roots(n):
    r = rng.choice(N, n * 2, replace=False)
    r = np.array([x for x in r if x not in benchset and dist[x] > 0][:n], np.int64)
    return r


# ---------- training nodes ----------
path = os.path.join(DATA, 'train_nodes.npz')
if os.path.exists(path):
    z = np.load(path)
    P, LEFT, MASK = z['P'], z['LEFT'], z['MASK']
else:
    t0 = time.time()
    parts = []
    for B, nroots, cap in [(2_000, 300, 150_000), (20_000, 2_000, 150_000), (100_000, 6_000, 150_000),
                           (400_000, 20_000, 150_000)]:
        h = floor(B)
        rec = record_final_rounds(roots(nroots), h, PM, OM, FACES, cap)
        parts.append(rec)
        print(f'  floor {B:>7,}: {len(rec):,} final-round nodes', flush=True)
    # uniform positions: the node itself is on an optimal path with budget = its distance; survivors under 20 KB
    h = floor(20_000)
    u = roots(150_000)
    kids = neighbours(u)
    left = dist[u].astype(np.int64)
    surv = h[kids] <= (left - 1)[:, None]
    mask = (surv * (1 << np.arange(9))[None, :]).sum(1)
    keep = surv.sum(1) > 1
    parts.append(np.stack([u[keep], left[keep], mask[keep]], 1))
    rec = np.concatenate(parts)
    P, LEFT, MASK = rec[:, 0], rec[:, 1], rec[:, 2]
    np.savez(path, P=P, LEFT=LEFT, MASK=MASK)
    print(f'recorded {len(P):,} nodes in {time.time() - t0:.0f}s', flush=True)

kids = neighbours(P)  # (n, 9)
surv = ((MASK[:, None] >> np.arange(9)[None, :]) & 1).astype(bool)
good = surv & (dist[kids] <= (LEFT - 1)[:, None])
inform = (good.sum(1) >= 1) & (good.sum(1) < surv.sum(1))
kids, surv, good = kids[inform], surv[inform], good[inform]
print(f'{inform.sum():,} informative nodes (some but not all survivors are good); '
      f'mean survivors {surv.sum(1).mean():.2f}, good {good.sum(1).mean():.2f}', flush=True)


def feats(s):
    x = cube.features(s)
    if INPUTS == 'mirror':
        x = np.concatenate([x, cube.features(inv[s])], 1)
    return x


D = 140 if INPUTS == 'mirror' else 70
W1 = (rng.standard_normal((D, H)) * np.sqrt(2 / 14)).astype(np.float32)
b1 = np.zeros(H, np.float32)
W2 = (rng.standard_normal((H, 1)) * np.sqrt(1 / H)).astype(np.float32)
b2 = np.zeros(1, np.float32)
params = [W1, b1, W2, b2]
m = [np.zeros_like(p) for p in params]
v = [np.zeros_like(p) for p in params]

n = len(kids)
perm = rng.permutation(n)
nval = min(20_000, n // 10)
val, tr = perm[:nval], perm[nval:]
bs, epochs = 512, 8
steps = epochs * (len(tr) // bs)
k = 0
t0 = time.time()


def forward(idx):
    x = feats(kids[idx].ravel())
    z1 = x @ W1 + b1
    a1 = np.maximum(z1, 0)
    sc = (a1 @ W2 + b2)[:, 0].reshape(len(idx), 9)
    return x, a1, sc


def loss_grad(sc, sv, gd):
    logit = np.where(sv, -sc, -1e9)
    logit -= logit.max(1, keepdims=True)
    p = np.exp(logit) * sv
    p /= p.sum(1, keepdims=True)
    pg = (p * gd).sum(1, keepdims=True)
    loss = -np.log(pg[:, 0] + 1e-12).mean()
    # d loss / d logit_i = p_i - [i good] p_i / pg ; score = -logit
    gl = p - gd * p / pg
    return loss, -gl / len(sc)


def top1(sc, sv, gd):
    s = np.where(sv, sc, np.inf)
    return float(gd[np.arange(len(s)), s.argmin(1)].mean())


for ep in range(epochs):
    order = rng.permutation(tr)
    for a in range(0, len(order) - bs + 1, bs):
        idx = order[a:a + bs]
        x, a1, sc = forward(idx)
        loss, gs = loss_grad(sc, surv[idx], good[idx])
        g = gs.reshape(-1, 1).astype(np.float32)
        gW2 = a1.T @ g
        gb2 = g.sum(0)
        ga = (g @ W2.T) * (a1 > 0)
        gW1 = x.T @ ga
        gb1 = ga.sum(0)
        lr = 3e-3 * 0.5 * (1 + np.cos(np.pi * k / steps))
        k += 1
        for i, (p, gr) in enumerate(zip(params, [gW1, gb1, gW2, gb2])):
            m[i] = 0.9 * m[i] + 0.1 * gr
            v[i] = 0.999 * v[i] + 0.001 * gr * gr
            p -= lr * (m[i] / (1 - 0.9 ** k)) / (np.sqrt(v[i] / (1 - 0.999 ** k)) + 1e-8)
    _, _, sc = forward(val)
    vl, _ = loss_grad(sc, surv[val], good[val])
    rnd = surv[val] / surv[val].sum(1, keepdims=True)
    print(f'  epoch {ep + 1}/{epochs}: val loss {vl:.3f}, top-1 good {top1(sc, surv[val], good[val]):.1%} '
          f'(random {float((rnd * good[val]).sum(1).mean()):.1%}) [{time.time() - t0:.0f}s]', flush=True)

tag = f'mlp_{INPUTS}_{H}'
np.savez(os.path.join(HERE, 'results', f'weights_{tag}.npz'), W1=W1, b1=b1, W2=W2, b2=b2)
# score every position once (for fast counting in the benchmark)
score = np.empty(N, np.float32)
for a in range(0, N, 200_000):
    s = np.arange(a, min(N, a + 200_000))
    score[s] = (np.maximum(feats(s) @ W1 + b1, 0) @ W2 + b2)[:, 0]
np.save(os.path.join(DATA, f'score_{tag}.npy'), score)
print('saved', tag)
