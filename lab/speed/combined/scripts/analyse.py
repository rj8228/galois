"""Checks every T7 result, then writes results/random-states.jsonl, results/frontier.json and results/summary.json.

Checks (any failure raises):
- every solve verified (comb replays it and aborts otherwise), length equals lab/3x3's where known
- a certificate's length equals the proven floor (comb aborts otherwise; re-checked here)
- every cleared proof round's baseline node count equals lab/3x3's single-thread count
- in masked runs, generated + skipped equals the unmasked count in every cleared round
"""
import json, pathlib, statistics as st

here = pathlib.Path(__file__).resolve().parent.parent
raw = here / "results" / "raw"
lab = here.parent.parent / "3x3" / "results"
T6 = here.parent / "ceiling" / "results"
FLOOR = "C8s+P1x3i"
CONF = {  # impl -> raw file prefix
    "c-4t-split": "split",
    "c-4t-split-masks": "split-masks",
    "c-4t-race": "race",
    "c-4t-race-masks": "race-masks",
    "c-4t-race-masks-help": "race-masks-help",
}


def load(name):
    p = raw / f"{name}.jsonl"
    if not p.exists():
        return None
    return sorted((json.loads(l) for l in open(p) if l.strip()), key=lambda r: r["index"])


def bench(s):
    return {r["index"]: r for r in json.load(open(lab / f"bench-{s}.json"))["floors"][FLOOR]["solves"]}


def cleared_end(r):
    """First bound not cleared: rounds below it searched in full without a solution."""
    if r["ended"] == "timeout":
        return r["proven_floor"] + 1  # printed as bound_end - 1
    return r["proven_floor"]


def stats(xs):
    xs = [x for x in xs if x is not None]
    if not xs:
        return None
    return {"n": len(xs), "mean_s": round(sum(xs) / len(xs), 3), "median_s": round(st.median(xs), 3),
            "worst_s": round(max(xs), 3)}


def check(rows, s, masked_vs=None):
    B = bench(s)
    out = {"solves": len(rows), "rounds_vs_lab3x3": 0, "rounds_masked_vs_unmasked": 0}
    for r in rows:
        assert r["verified"], (s, r["index"])
        D = r["D"]
        if D > 0:
            assert r["length"] == D, (s, r["index"], r["length"], D)
        if r["ended"] == "certificate":
            assert r["length"] == r["proven_floor"], (s, r["index"])
        end = cleared_end(r)
        nb = {int(k): v for k, v in B[r["index"]]["nodes_per_bound"].items()}
        for k, (g, sk) in r["nodes_per_bound"].items():
            b = int(k)
            if b < end and b in nb and (B[r["index"]]["length"] < 0 or b < B[r["index"]]["length"]):
                assert g + sk == nb[b], (s, r["index"], b, g + sk, nb[b])
                out["rounds_vs_lab3x3"] += 1
        if masked_vs is not None:
            u = masked_vs.get(r["index"])
            if u:
                ue = cleared_end(u)
                for k, (g, sk) in r["nodes_per_bound"].items():
                    if int(k) < min(end, ue):
                        assert g + sk == u["nodes_per_bound"][k][0], (s, r["index"], k)
                        out["rounds_masked_vs_unmasked"] += 1
    return out


summary = {"checks": {}, "moves-16": {}, "random-state": {}}

# ---------------------------------------------------------------- 16-move set, all five
m16 = {impl: load(f"m16-{p}") for impl, p in CONF.items()}
for impl, rows in m16.items():
    if not rows:
        continue
    base = {r["index"]: r for r in (m16["c-4t-split"] if "masks" in impl and m16["c-4t-split"] else [])} or None
    summary["checks"][f"moves-16 {impl}"] = check(rows, "moves-16", base)
    ended = {}
    for r in rows:
        ended[r["ended"]] = ended.get(r["ended"], 0) + 1
    summary["moves-16"][impl] = dict(stats([r["secs"] for r in rows]), ended=ended,
                                    helped=sum(r["helped_at"] >= 0 for r in rows))

# ---------------------------------------------------------------- rates measured here
def rate(rows, pred=lambda r, b: True, min_bound=4):
    """Baseline-equivalent nodes per second (generated + skipped) over cleared pooled rounds."""
    n = t = 0
    for r in rows or []:
        end = cleared_end(r)
        for k, (g, sk) in r["nodes_per_bound"].items():
            b = int(k)
            if min_bound <= b < end and pred(r, b) and r["round_secs"].get(k, 0) > 0.05:
                n += g + sk
                t += r["round_secs"][k]
    return n / t if t else None


rs_e = load("rs-race-masks-help")
rs5_b = load("rs5-split-masks")
rs5_c = load("rs5-race")
rs5_e2 = load("rs5-race-masks-help-5s25")
no_help = lambda r, b: str(b) not in r["helper_nodes_per_bound"]
R = {
    "split_4t": rate(load("m16-split")),  # 4 provers, dfs (16-move set: (a) was not run on random states)
    "split_masks_4t": rate(rs5_b) or rate(m16["c-4t-split-masks"]),
    "prover_3t": rate(rs5_c) or rate(m16["c-4t-race"]),
    "prover_masks_3t": rate(rs_e, no_help) or rate(m16["c-4t-race-masks"]),
    "prover_masks_4t_helped": rate(rs_e, lambda r, b: not no_help(r, b)),
}
one = load("m16-5-1t")
if one:
    one = [r for r in one if r.get("type") == "solve"]
    R["dfs_1t"] = sum(r["nodes"] for r in one) / sum(r["seconds"] for r in one)
summary["rates_nodes_per_s"] = {k: round(v) if v else None for k, v in R.items()}

# ---------------------------------------------------------------- random states
B = bench("random-state")
t6 = {r["index"]: r for r in map(json.loads, open(T6 / "traces.jsonl")) if r["set"] == "random-state"}
lines = []
for tag, rows, conf in [("race-masks-help", rs_e, "c-4t-race-masks-help, help max(60 s, 25%)"), ("split-masks", rs5_b, "c-4t-split-masks"),
                        ("race", rs5_c, "c-4t-race"), ("race-masks-help-5s25", rs5_e2, "c-4t-race-masks-help, help max(5 s, 25%) (as in the brief)")]:
    if not rows:
        continue
    summary["checks"][f"random-state {tag}"] = check(rows, "random-state")
    for r in rows:
        tD = next((t for t, L, _ in r["ceiling_trace"] if L <= r["length"]), None) if r["length"] > 0 else None
        lines.append(dict(config=conf, index=r["index"], D=r["length"], lab3x3_D=r["D"] or None, secs=r["secs"],
                          ended=r["ended"], helped_at=None if r["helped_at"] < 0 else r["helped_at"],
                          ceiling_reached_D_s=tD, ceiling_trace=r["ceiling_trace"], nodes_per_round=r["nodes_per_bound"],
                          round_secs=r["round_secs"], helper_nodes_per_round=r["helper_nodes_per_bound"]))
with open(here / "results" / "random-states.jsonl", "w") as f:
    for l in lines:
        f.write(json.dumps(l) + "\n")

# machine factor for the ceiling: our ceiling's time to reach D over T6's (same code, same search order)
fac = []
for rows in [rs5_c, rs_e]:
    for r in rows or []:
        tD = next((t for t, L, _ in r["ceiling_trace"] if L <= r["length"]), None)
        t6D = t6.get(r["index"], {}).get("trace_reach_D_s")
        if tD and t6D and tD > 1 and r["helped_at"] < 0:
            fac.append(tD / t6D)
CF = st.median(fac) if fac else 1.0
summary["ceiling_time_here_over_t6"] = {"median": round(CF, 3), "n": len(fac)}


def est(i):
    """Estimated seconds per configuration for random state i, from lab/3x3's node counts."""
    b = B[i]
    nb = {int(k): v for k, v in b["nodes_per_bound"].items()}
    D = b["length"] if b["length"] > 0 else 19
    proof = {b_: v for b_, v in nb.items() if b_ < D}
    final = nb.get(D) if b["length"] > 0 else None
    tD = t6[i]["trace_reach_D_s"]
    tD = tD * CF if tD is not None else None
    e = {}
    for impl, key in [("c-4t-split", "split_4t"), ("c-4t-split-masks", "split_masks_4t")]:
        e[impl] = (sum(proof.values()) + final) / R[key] if final is not None and R[key] else None
    for impl, key in [("c-4t-race", "prover_3t"), ("c-4t-race-masks", "prover_masks_3t")]:
        if not R[key]:
            e[impl] = None
            continue
        p = sum(proof.values()) / R[key]
        alone = p + final / R[key] if final is not None else None
        if tD is None:
            e[impl] = alone
        else:
            e[impl] = max(p, tD) if alone is None else min(alone, max(p, tD))
    return e, D


E = {i: est(i) for i in B}
meas = {"c-4t-race-masks-help": {r["index"]: r["secs"] for r in rs_e or []},
        "c-4t-split-masks": {r["index"]: r["secs"] for r in rs5_b or []},
        "c-4t-race": {r["index"]: r["secs"] for r in rs5_c or []}}
rsum = {}
for impl in CONF:
    est_all = [E[i][0].get(impl) for i in sorted(B)]
    m = meas.get(impl, {})
    rsum[impl] = {
        "measured": stats(list(m.values())),
        "measured_indices": sorted(m),
        "estimated_all20": stats(est_all) if None not in est_all else None,
        "estimated_18_known": stats([E[i][0].get(impl) for i in sorted(B) if B[i]["length"] > 0]),
        "estimated_on_measured": stats([E[i][0].get(impl) for i in sorted(m)]) if m else None,
    }
if rs_e:
    ended = {}
    for r in rs_e:
        ended[r["ended"]] = ended.get(r["ended"], 0) + 1
    rsum["c-4t-race-masks-help"]["ended"] = ended
    rsum["c-4t-race-masks-help"]["helped"] = sum(r["helped_at"] >= 0 for r in rs_e)
    rsum["c-4t-race-masks-help"]["measured_18_known"] = stats([r["secs"] for r in rs_e if r["D"] > 0])
if rs5_e2 and rs_e:
    idx = [r["index"] for r in rs5_e2]
    rsum["help_threshold"] = {
        "max(60 s, 25%)": stats([r["secs"] for r in rs_e if r["index"] in idx]),
        "max(5 s, 25%)": stats([r["secs"] for r in rs5_e2]),
        "indices": idx,
    }
summary["random-state"] = rsum
summary["per_position_estimates"] = {str(i): {k: (round(v, 2) if v else None) for k, v in E[i][0].items()} for i in sorted(B)}

# ---------------------------------------------------------------- frontier
mask_bytes = next((r["mask_bytes"] for rows in m16.values() if rows for r in rows if r["mask_bytes"]), None)
notes = {
    "c-4t-split": "4 prover threads, pthread pool over depth-3 subtrees",
    "c-4t-split-masks": "4 prover threads, gdfs with 18-bit packed down masks",
    "c-4t-race": "3 prover threads + T6 ceiling thread",
    "c-4t-race-masks": "3 masked prover threads + ceiling thread",
    "c-4t-race-masks-help": "3 masked prover threads + ceiling thread that helps prove once stuck for max(60 s, 25% of elapsed)",
}
frontier = []
for impl in CONF:
    for s, pos in [("moves-16", 50), ("random-state", 20)]:
        if s == "moves-16":
            S = summary["moves-16"].get(impl)
            if not S:
                continue
            ms, note = S["mean_s"] * 1000, f"16-move set, measured; median {S['median_s']} s, worst {S['worst_s']} s"
        else:
            S = rsum.get(impl, {})
            if impl == "c-4t-race-masks-help" and S.get("measured"):
                M = S["measured"]
                ms, note, pos = M["mean_s"] * 1000, f"all 20 random states, measured; median {M['median_s']} s, worst {M['worst_s']} s", M["n"]
            elif S.get("estimated_all20") or S.get("estimated_18_known"):
                M = S.get("estimated_all20") or S["estimated_18_known"]
                ms, pos = M["mean_s"] * 1000, M["n"]
                note = f"random states, estimated from lab/3x3 node counts at rates measured here; median {M['median_s']} s, worst {M['worst_s']} s"
                if S.get("measured"):
                    note += f"; measured on {S['measured']['n']}: mean {S['measured']['mean_s']} s"
            else:
                continue
        frontier.append({
            "task": "combined", "puzzle": "3x3", "method": notes[impl], "floor": FLOOR, "floor_bytes": 73481013,
            "extra_bytes": mask_bytes if "masks" in impl else 0, "positions": pos, "optimal": pos,
            "lookups_counting": None, "mean_lookups": None, "mean_final_round_lookups": None, "mean_extra_work": None,
            "extra_work_unit": None, "mean_ms": round(ms, 1), "impl": impl, "notes": note,
        })
json.dump(frontier, open(here / "results" / "frontier.json", "w"), indent=1)
json.dump(summary, open(here / "results" / "summary.json", "w"), indent=1)
print(json.dumps({k: summary[k] for k in ["checks", "rates_nodes_per_s", "ceiling_time_here_over_t6", "moves-16"]}, indent=1))
print(json.dumps(rsum, indent=1))
