"""Full-3x3 IDA* node counts: each corner floor combined with the two 6-edge tables.

Runs the same 50 scrambles of 12 random moves as run_search.py, now on the whole cube. Every
floor here is a true floor, so every run must return the same optimal lengths; each solution
is also replayed on the cube to check that it solves it.

    python3 run_search3.py                    # edges alone, plain corner floors, perimeter tables
    python3 run_search3.py sym256             # one net (int8, margins 0, 1, 2), after the plain run

Plain floors go to results/search3.json and each net to results/search3_<net>.json, so nets can
run in parallel processes. Floors already there are skipped unless --force is given.
"""

import json
import os
import sys
import time

import numpy as np

import cube
import cube3
import run_search
import search
import search3

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
# Same values as a floor already run, so the same search: run once, reported for both.
SKIP = {"symplain", "syminv", "perim5sym", "perim6sym", "perim7sym", "perim5inv", "perim6inv", "perim7inv",
        "k3", "k4", "k5", "k6"}


def main(nets, force):
    dist, pm, tm, inv, cot, (scp, sco, icp, ico) = run_search.load_common()
    dest, flip = cube3.edge_dest_flip()
    eA = np.load(os.path.join(DATA, "edges_a.npy"))
    eB = np.load(os.path.join(DATA, "edges_b.npy"))
    starts = []
    for seq in search.scrambles():
        s = cube3.SOLVED
        for m in seq:
            s = cube3.apply(s, m, pm, tm, dest, flip)
        starts.append(s)
    plain_path = os.path.join(HERE, "results", "search3.json")
    if nets:
        assert len(nets) == 1, "one net per process"
        floors = [f for f in run_search.build_floors(nets, formats=("int8",)) if f[0].startswith(nets[0] + "_")]
        path = os.path.join(HERE, "results", f"search3_{nets[0]}.json")
        exact = json.load(open(plain_path))["exact"]["lengths"]
    else:
        floors = [f for f in run_search.build_floors([]) if f[0] not in SKIP]
        floors.insert(1, ("edges_only", -1, floors[0][2]))  # after "exact", which every length is checked against
        path = plain_path
        exact = None
    out = json.load(open(path)) if os.path.exists(path) else {}
    out["scrambles"] = [" ".join(cube.MOVE_NAMES[m] for m in s) for s in search.scrambles()]
    for name, kind, a in floors:
        if name in out and not force:
            continue
        t0 = time.time()
        lens, nodes, viol, hist = [], [], 0, np.zeros(12, np.int64)
        for seq, (c, es, ef) in zip(search.scrambles(), starts):
            ln, nd, v, moves, h = search3.ida3(
                c, np.array(es, np.int64), np.array(ef, np.int64), kind >= 0, max(kind, 0), a["margin"],
                pm, tm, dest, flip, eA, eB, dist, inv, cot, a["sA"], a["tA"], a["sB"], a["tB"],
                a["cls_id"], a["sym_of"], a["inv_of"], a["symtab"], scp, sco, icp, ico, *a["net"],
                a["keys"], a["vals"], a["lo"], a["hi"], 10 ** 12)
            assert ln >= 0, name
            s = (c, es, ef)
            for m in moves:
                s = cube3.apply(s, int(m), pm, tm, dest, flip)
            assert s == cube3.SOLVED, (name, seq, moves)
            if exact is None and name != "exact":
                exact = out["exact"]["lengths"]
            if exact is not None:
                assert ln == exact[len(lens)], (name, ln, exact[len(lens)])
            lens.append(int(ln)); nodes.append(int(nd)); viol += int(v); hist += h
        out[name] = {"total_nodes": int(sum(nodes)), "mean_nodes": float(np.mean(nodes)),
                     "median_nodes": float(np.median(nodes)), "violations": viol, "seconds": time.time() - t0,
                     "nodes": nodes, "lengths": lens, "corner_distance_of_nodes": hist.tolist()}
        print(f"{name:24s} nodes {sum(nodes):>14,}  violations {viol}  {time.time() - t0:.1f}s", flush=True)
        json.dump(out, open(path, "w"), indent=1)


if __name__ == "__main__":
    main([a for a in sys.argv[1:] if a != "--force"], "--force" in sys.argv)
