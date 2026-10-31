"""Step 2: train an MLP to underestimate the corner table.

Loss: squared error, with overestimates (pred > truth) weighted `--over` times as much.
`--sym` trains on the 1,841,970 symmetry-class representatives instead of all 88M positions;
at use time a position is first mapped to its representative.

Checkpoints go to checkpoints/<name>.npz every --ckpt steps and the run resumes from there.

    python3 train.py --name raw512 --sizes 512,256,128 --epochs 3
"""

import argparse
import json
import os
import time

import numpy as np

import nn

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
CKPT = os.path.join(HERE, "checkpoints")


def evaluate(params, feats, dist, idx):
    pred = np.concatenate([nn.forward(params, feats.dense(idx[i:i + 65536])) for i in range(0, len(idx), 65536)])
    y = dist[idx].astype(np.float32)
    r = np.round(pred)
    out = {"mae": float(np.abs(pred - y).mean())}
    for m in (0, 1, 2):
        h = np.maximum(r - m, 0)
        out[f"over_m{m}"] = float((h > y).mean())
        out[f"mean_h_m{m}"] = float(np.minimum(h, y).mean())
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--sizes", default="512,256,128")
    ap.add_argument("--sym", action="store_true")
    ap.add_argument("--over", type=float, default=8.0)
    ap.add_argument("--epochs", type=float, default=3)
    ap.add_argument("--batch", type=int, default=8192)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--ckpt", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    os.makedirs(CKPT, exist_ok=True)

    dist = np.load(os.path.join(DATA, "corner.npy"))
    pool = np.load(os.path.join(DATA, "reps.npy")).astype(np.int64) if a.sym else None
    n_pool = len(pool) if a.sym else len(dist)
    feats = nn.Features()
    sizes = [nn.N_IN] + [int(s) for s in a.sizes.split(",")] + [1]
    rng = np.random.default_rng(a.seed)
    params = nn.init(sizes, rng)
    m1 = [np.zeros_like(p) for p in params]
    m2 = [np.zeros_like(p) for p in params]
    steps_per_epoch = n_pool // a.batch
    total = int(a.epochs * steps_per_epoch)
    step = 0
    path = os.path.join(CKPT, a.name + ".npz")
    log = []
    if os.path.exists(path):
        z = np.load(path, allow_pickle=True)
        k = len(params)
        params = [z[f"p{i}"] for i in range(k)]
        m1 = [z[f"m{i}"] for i in range(k)]
        m2 = [z[f"v{i}"] for i in range(k)]
        step = int(z["step"])
        log = list(z["log"])
        print(f"resumed {a.name} at step {step}/{total}", flush=True)

    vrng = np.random.default_rng(12345)
    val = pool[vrng.integers(0, n_pool, 300_000)] if a.sym else vrng.integers(0, n_pool, 300_000)
    print(f"{a.name}: sizes {sizes}, {nn.n_params(params):,} params, {total} steps of {a.batch}", flush=True)

    def save():
        d = {f"p{i}": p for i, p in enumerate(params)}
        d.update({f"m{i}": p for i, p in enumerate(m1)})
        d.update({f"v{i}": p for i, p in enumerate(m2)})
        np.savez(path + ".tmp.npz", step=step, sizes=np.array(sizes), sym=a.sym, over=a.over,
                 log=np.array(log, dtype=object), **d)
        os.replace(path + ".tmp.npz", path)

    t0 = time.time()
    run_loss = 0.0
    while step < total:
        epoch, k = divmod(step, steps_per_epoch)
        order = np.random.default_rng(a.seed * 1000 + epoch).permutation(n_pool)
        while k < steps_per_epoch and step < total:
            bi = order[k * a.batch:(k + 1) * a.batch]
            idx = pool[bi] if a.sym else bi
            x = feats.dense(idx)
            y = dist[idx].astype(np.float32)
            pred, acts = nn.forward(params, x, keep=True)
            e = pred - y
            w = np.where(e > 0, a.over, 1.0).astype(np.float32)
            run_loss += float((w * e * e).mean())
            grads = nn.backward(params, acts, 2 * w * e / len(y))
            # Adam with warmup and cosine decay
            lr = a.lr * min(1.0, (step + 1) / 300) * (0.02 + 0.98 * 0.5 * (1 + np.cos(np.pi * step / total)))
            t = step + 1
            for i, g in enumerate(grads):
                m1[i] = 0.9 * m1[i] + 0.1 * g
                m2[i] = 0.999 * m2[i] + 0.001 * g * g
                params[i] -= (lr * (m1[i] / (1 - 0.9 ** t)) / (np.sqrt(m2[i] / (1 - 0.999 ** t)) + 1e-8)).astype(np.float32)
            step += 1
            k += 1
            if step % 500 == 0:
                print(f"step {step}/{total} loss {run_loss / 500:.4f} lr {lr:.2e} {time.time() - t0:.0f}s", flush=True)
                run_loss = 0.0
            if step % a.ckpt == 0 or step == total:
                ev = evaluate(params, feats, dist, val)
                ev["step"] = step
                log.append(json.dumps(ev))
                print("  val", ev, flush=True)
                save()
    save()
    print("done", flush=True)


if __name__ == "__main__":
    main()
