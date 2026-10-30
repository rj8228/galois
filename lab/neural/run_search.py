"""IDA* node counts on 50 scrambles of 12 random moves, for every floor.

    python3 run_search.py                 # plain tables and perimeter tables
    python3 run_search.py symA raw512     # plus these nets (fp16 and int8, margins 0, 1, 2)

Floors already in results/search.json are skipped unless --force is given.
"""

import json
import os
import sys
import time

import numpy as np

import cube
import nn
import plain
import search
import verify

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


def main(nets, force):
    dist = np.load(os.path.join(DATA, "corner.npy"))
    pm = np.load(os.path.join(DATA, "move_perm.npy")).astype(np.int64)
    tm = np.load(os.path.join(DATA, "move_twist.npy")).astype(np.int64)
    inv, cot = nn.coord_tables()
    scp, sco, icp, ico = cube.symmetries()
    starts = []
    for seq in search.scrambles():
        i = 0
        for m in seq:
            i = pm[i // 2187, m] * 2187 + tm[i % 2187, m]
        starts.append(i)
    e1 = np.zeros(0, np.int64)
    eu = np.zeros(1, np.uint8)
    ef = np.zeros((1, 1), np.float32)
    ef1 = np.zeros(1, np.float32)
    empty_net = (ef, ef1, ef, ef1, ef, ef1, ef, ef1)
    base = dict(sA=e1, tA=eu, sB=e1, tB=eu, cls_id=e1, sym_of=e1, inv_of=e1, symtab=eu, net=empty_net,
                keys=e1, vals=np.zeros(0, np.int8), margin=0)

    floors = [("exact", 0, {})]
    for name, subs in plain.SUBSETS.items():
        tabs = [np.load(os.path.join(DATA, f"partial_{plain.subset_name(s)}.npy")) for s in subs]
        cfg = {"sA": np.array(subs[0], np.int64), "tA": tabs[0]}
        if len(subs) > 1:
            cfg.update(sB=np.array(subs[1], np.int64), tB=tabs[1])
        floors.append((name, 1, cfg))
    for name in ("symplain", "syminv"):
        floors.append((name, 2, {f: np.load(os.path.join(DATA, f"{name}_{f[:3]}.npy")).astype(np.int64)
                                 for f in ("cls_id", "sym_of", "inv_of")} | {"symtab": np.load(os.path.join(DATA, f"{name}.npy"))}))
    for k in (5, 6, 7):
        for sym in (False, True):
            name = f"perim{k}{'sym' if sym else ''}"
            c = np.load(os.path.join(DATA, f"corr_{name}_const_m0.npz"))
            const = (np.zeros((88, 1), np.float32), np.zeros(1, np.float32), np.zeros((1, 1), np.float32),
                     np.zeros(1, np.float32), np.zeros((1, 1), np.float32), np.zeros(1, np.float32),
                     np.zeros((1, 1), np.float32), np.full(1, k + 1, np.float32))  # a "net" that always says k + 1
            floors.append((name, 4 if sym else 3, {"net": const, "keys": c["keys"].astype(np.int64), "vals": c["vals"]}))
    for net in nets:
        params, sizes, sym, _ = verify.load(net)
        for kind in ("fp16", "int8"):
            q = nn.as_fp16(params) if kind == "fp16" else nn.as_int8(params)
            for m in (0, 1, 2):
                c = np.load(os.path.join(DATA, f"corr_{net}_{kind}_m{m}.npz"))
                floors.append((f"{net}_{kind}_m{m}", 4 if sym else 3,
                               {"net": tuple(q), "keys": c["keys"].astype(np.int64), "vals": c["vals"], "margin": m}))

    path = os.path.join(HERE, "results", "search.json")
    out = json.load(open(path)) if os.path.exists(path) else {}
    out["scrambles"] = [" ".join(cube.MOVE_NAMES[m] for m in s) for s in search.scrambles()]
    for name, kind, cfg in floors:
        if name in out and not force:
            continue
        a = {**base, **cfg}
        t0 = time.time()
        lens, nodes, viol = [], [], 0
        for s in starts:
            ln, nd, v = search.ida(s, kind, a["margin"], pm, tm, dist, inv, cot, a["sA"], a["tA"], a["sB"], a["tB"],
                                   a["cls_id"], a["sym_of"], a["inv_of"], a["symtab"], scp, sco, icp, ico, *a["net"],
                                   a["keys"], a["vals"])
            assert ln == dist[s], (name, ln, dist[s])
            lens.append(int(ln)); nodes.append(int(nd)); viol += int(v)
        out[name] = {"total_nodes": int(sum(nodes)), "mean_nodes": float(np.mean(nodes)),
                     "median_nodes": float(np.median(nodes)), "violations": viol,
                     "seconds": time.time() - t0, "nodes": nodes, "lengths": lens}
        print(f"{name:24s} nodes {sum(nodes):>12,}  violations {viol}  {time.time() - t0:.1f}s", flush=True)
        json.dump(out, open(path, "w"), indent=1)


if __name__ == "__main__":
    main([a for a in sys.argv[1:] if a != "--force"], "--force" in sys.argv)
