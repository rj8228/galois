"""Experiment 6: run the scalable prover on EVERY position, not a sample.

For all 3,674,160 positions: IDA* with the 400 KB group-theory floor finds a solution; the
solution is replayed move by move to confirm it really solves the cube; its length is checked
against the truth table. If every length matches, the method is optimal on the whole 2x2.
"""
import json
import sys
import time
from multiprocessing import Pool

import numpy as np

from cube2 import N, NO, Cube2

FLOOR = sys.argv[1] if len(sys.argv) > 1 else 'data/floor_budget_400000.npy'


def init():
    global C, H
    C = Cube2('htm')
    H = bytes(np.load(FLOOR).astype(np.uint8).tolist())


def solve(s0):
    faces, pm, om, h = C.faces, C.pm, C.om, H
    path = []
    nodes = 0

    def dfs(s, g, bound, lastface):
        nonlocal nodes
        nodes += 1
        f = g + h[s]
        if f > bound:
            return f
        if s == 0:
            return -1
        best = 99
        p, o = divmod(s, NO)
        pp, oo = pm[p], om[o]
        for j in range(9):
            if faces[j] == lastface:
                continue
            path.append(j)
            r = dfs(pp[j] * NO + oo[j], g + 1, bound, faces[j])
            if r == -1:
                return -1
            path.pop()
            if r < best:
                best = r
        return best

    bound = h[s0]
    while (r := dfs(s0, 0, bound, -1)) != -1:
        bound = r
    s = s0  # replay the solution on the position itself
    for j in path:
        p, o = divmod(s, NO)
        s = pm[p][j] * NO + om[o][j]
    return len(path), s == 0, nodes


def work(chunk):
    a, b = chunk
    L = np.empty(b - a, np.int8)
    ok = np.empty(b - a, bool)
    nd = np.empty(b - a, np.int64)
    for i, s in enumerate(range(a, b)):
        L[i], ok[i], nd[i] = solve(s)
    return a, L, ok, nd


if __name__ == '__main__':
    dist = np.load('data/dist_htm.npy')
    L = np.full(N, -1, np.int8)
    ok = np.zeros(N, bool)
    nodes = np.zeros(N, np.int64)
    chunks = [(a, min(a + 40_000, N)) for a in range(0, N, 40_000)]
    t0 = time.time()
    with Pool(2, initializer=init) as pool:
        for k, (a, l, o, nd) in enumerate(pool.imap_unordered(work, chunks), 1):
            L[a:a + len(l)], ok[a:a + len(l)], nodes[a:a + len(l)] = l, o, nd
            if k % 10 == 0 or k == len(chunks):
                print(f'{k}/{len(chunks)} chunks ({time.time() - t0:.0f}s)', flush=True)
    res = {
        'floor': FLOOR,
        'positions': int(N),
        'every_solution_replays_to_solved': bool(ok.all()),
        'every_length_equals_truth': bool((L == dist).all()),
        'mismatches': int((L != dist).sum()),
        'length_counts': np.bincount(L).tolist(),
        'truth_counts': np.bincount(dist).tolist(),
        'total_nodes': int(nodes.sum()),
        'mean_nodes': float(nodes.mean()),
        'max_nodes': int(nodes.max()),
        'seconds': round(time.time() - t0, 1),
    }
    print(json.dumps(res, indent=1))
    json.dump(res, open('results/exp6_exhaustive.json', 'w'), indent=1)
