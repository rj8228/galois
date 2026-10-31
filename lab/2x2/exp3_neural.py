"""Experiment 3: neural floors, and whether a correction table makes them exact.

Three networks with the same shape (70 -> 128 -> 128 -> 1), trained three ways:
  A  scramble length as the label (what random-walk training gives you)
  B  true distance, ordinary squared error
  C  true distance, overestimates penalised 30x (in the spirit of Samadi et al. 2008 / CEA 2025)
Each is checked on every one of the 3,674,160 positions. C then gets a correction table
holding the true value wherever it is still too high, which makes it exact by construction.
"""
import json
import sys
import time

import numpy as np

from cube2 import N, NO, Cube2

c = Cube2('htm')
dist = np.load('data/dist_htm.npy')
rng = np.random.default_rng(0)
EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 6


class MLP:
    def __init__(self, sizes, out_bias):
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

    def predict(self, states):
        out = np.empty(len(states), np.float32)
        for a in range(0, len(states), 65536):
            out[a:a + 65536] = self.forward(c.features(states[a:a + 65536]))[-1][:, 0]
        return out


def train(states, labels, over_weight, epochs, tag):
    net = MLP([70, 128, 128, 1], float(labels.mean()))
    n, bs = len(states), 4096
    steps = epochs * (n // bs)
    t0, k = time.time(), 0
    for ep in range(epochs):
        order = rng.permutation(n)
        for a in range(0, n - bs + 1, bs):
            idx = order[a:a + bs]
            acts = net.forward(c.features(states[idx]))
            err = acts[-1][:, 0] - labels[idx]
            g = np.where(err > 0, over_weight * err, err) * (2 / bs)
            lr = 2e-3 * 0.5 * (1 + np.cos(np.pi * k / steps))  # cosine decay
            net.step(acts, g[:, None].astype(np.float32), lr)
            k += 1
        print(f'  {tag}: epoch {ep + 1}/{epochs} ({time.time() - t0:.0f}s)', flush=True)
    return net


def random_walk_set(n, kmax):
    """Scramble k moves from solved (never the same face twice), label = k."""
    ks = rng.integers(0, kmax + 1, size=n)
    s = np.zeros(n, np.int64)
    last = np.full(n, -1)
    for step in range(kmax):
        act = ks > step
        j = rng.integers(0, 9, size=n)
        same = (j // 3) == last
        while same.any():
            j[same] = rng.integers(0, 9, size=same.sum())
            same = (j // 3) == last
        nb = c.pmove[s // NO, j].astype(np.int64) * NO + c.omove[s % NO, j]
        s = np.where(act, nb, s)
        last = np.where(act, j // 3, last)
    return s, ks.astype(np.float32)


allS = np.arange(N, dtype=np.int64)
results = {}

print('A: trained on scramble length')
sA, yA = random_walk_set(N, 14)
netA = train(sA, yA, 1.0, EPOCHS, 'A')
pA = netA.predict(allS)
print('B: trained on true distance, plain squared error')
netB = train(allS, dist.astype(np.float32), 1.0, EPOCHS, 'B')
pB = netB.predict(allS)
print('C: trained on true distance, overestimates penalised 30x')
netC = train(allS, dist.astype(np.float32), 30.0, EPOCHS, 'C')
pC = netC.predict(allS)

hA = np.clip(np.rint(pA), 0, 30).astype(np.int8)
hB = np.clip(np.rint(pB), 0, 30).astype(np.int8)
hC = np.clip(np.floor(pC), 0, 30).astype(np.int8)
for h in (hA, hB, hC):
    h[0] = 0  # the solved position is known

exc = np.nonzero(hC > dist)[0]
hCx = hC.copy()
hCx[exc] = dist[exc]
assert (hCx <= dist).all()

param_bytes = netC.params() * 2  # stored as 16-bit floats
exc_bytes = exc.size * 4  # 22-bit index + 4-bit value, rounded up to 4 bytes
for name, h in [('A scramble labels', hA), ('B exact, squared error', hB), ('C exact, overestimates x30', hC),
                ('C + correction table', hCx)]:
    over = h > dist
    results[name] = {'too_high_share': float(over.mean()), 'too_high_count': int(over.sum()),
                     'max_too_high_by': int((h.astype(int) - dist).max()), 'exact_share': float((h == dist).mean()),
                     'mean': float(h.mean())}
    print(f"{name:<28} too high on {over.mean():8.4%} ({over.sum():>9,})  exact {np.mean(h == dist):6.1%}  "
          f"mean {h.mean():.2f}")
results['memory'] = {'params': netC.params(), 'param_bytes_fp16': param_bytes, 'exceptions': int(exc.size),
                     'exception_bytes': exc_bytes, 'total_bytes': param_bytes + exc_bytes,
                     'full_table_bytes_4bit': N // 2, 'symmetry_reduced_table_bytes_4bit': 613058 // 2}
print('memory:', results['memory'])
for tag, h in [('A', hA), ('B', hB), ('C', hC), ('Cx', hCx)]:
    np.save(f'data/h_{tag}.npy', h)
for tag, p in [('A', pA), ('B', pB), ('C', pC)]:
    p = p.copy()
    p[0] = 0.0
    np.save(f'data/raw_{tag}.npy', p)  # unrounded outputs, for rolling and for the finder
json.dump(results, open('results/exp3_neural.json', 'w'), indent=1)
