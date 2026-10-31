"""Checks every result and writes results/traces.jsonl, results/frontier.json and results/summary.json."""
import json, pathlib, statistics as st

here = pathlib.Path(__file__).resolve().parent.parent
raw = here / "results" / "raw"
lab = here.parent.parent / "3x3" / "results"
FLOOR = "C8s+P1x3i"


def load(name):
    p = raw / f"{name}.jsonl"
    if not p.exists():
        return None
    rows = [json.loads(l) for l in open(p) if l.strip()]
    return sorted(rows, key=lambda r: r["index"])


def mean(xs):
    return sum(xs) / len(xs) if xs else None


def pct(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))] if xs else None


summary = {"sets": {}}
traces = []
frontier = []

# nodes per second of lab/3x3's prover on this machine, from our single-thread runs
nps_runs = []
for s in ["moves-14", "moves-16"]:
    r = load(f"run-{s}-1t1")
    if r:
        nps_runs += [(x["nodes"], x["prover_secs"]) for x in r]
NPS = sum(n for n, _ in nps_runs) / sum(t for _, t in nps_runs) if nps_runs else 9.1e6
summary["prover_nodes_per_second_1t"] = NPS

for s in ["moves-14", "moves-16", "random-state"]:
    duel = load(f"duel-{s}")
    if not duel:
        continue
    bench = {r["index"]: r for r in json.load(open(lab / f"bench-{s}.json"))["floors"][FLOOR]["solves"]}
    one = load(f"run-{s}-1t1")
    one = {r["index"]: r for r in one} if one else {}
    rows = []
    for d in duel:
        assert not d["shorter_than_D"], f"{s} #{d['index']}: ceiling shorter than the known optimum"
        i, D = d["index"], d["D"]
        b = bench[i]
        if i in one:  # measured here, per round
            rs = {int(k): v for k, v in one[i]["round_secs"].items()}
            assert one[i]["length"] == D
            src = "measured"
        else:  # lab/3x3's node counts at this machine's speed
            rs = {int(k): v / NPS for k, v in b["nodes_per_bound"].items()}
            src = "nodes / nps"
        if D > 0:
            proof = sum(v for k, v in rs.items() if k < D)
            final = rs.get(D, 0.0)
        else:  # unsolved by lab/3x3: every round it ran is proof, final unknown
            proof = sum(rs.values())
            final = None
        tD = next((t for t, L, _ in d["trace"] if D > 0 and L <= D), None)
        tgt = d["target"]["secs"] if d["target"]["found"] else None
        total = proof + final if final is not None else None
        # simulated race: ceiling doesn't know D; ends at max(proof, tD) if that beats the prover alone
        if total is not None:
            sim = min(total, max(proof, tD)) if tD is not None else total
        else:
            sim = None
        row = dict(set=s, index=i, D=D, floor0=d["floor0"], prover_times=src, proof_s=proof, final_s=final,
                   total_s=total, target_s=tgt, target_cap=d["target"]["cap"], trace_reach_D_s=tD,
                   trace_cap=d["trace_cap"], trace=d["trace"], simulated_race_s=sim)
        rows.append(row)
        traces.append(row)
    known = [r for r in rows if r["D"] > 0]
    S = {"positions": len(rows), "known_D": len(known)}
    S["D"] = {str(D): sum(1 for r in known if r["D"] == D) for D in sorted({r["D"] for r in known})}
    S["target_found"] = sum(1 for r in known if r["target_s"] is not None)
    S["target_s_median"] = pct([r["target_s"] for r in known if r["target_s"] is not None], 0.5)
    S["target_s_mean_found"] = mean([r["target_s"] for r in known if r["target_s"] is not None])
    S["trace_reached_D"] = sum(1 for r in known if r["trace_reach_D_s"] is not None)
    S["trace_s_median"] = pct([r["trace_reach_D_s"] for r in known if r["trace_reach_D_s"] is not None], 0.5)
    S["trace_s_max"] = max([r["trace_reach_D_s"] for r in known if r["trace_reach_D_s"] is not None], default=None)
    S["trace_before_proof_end"] = sum(1 for r in known if r["trace_reach_D_s"] is not None and r["trace_reach_D_s"] <= r["proof_s"])
    S["proof_s_mean"] = mean([r["proof_s"] for r in known])
    S["final_s_mean"] = mean([r["final_s"] for r in known])
    S["total_s_mean"] = mean([r["total_s"] for r in known])
    S["total_s_max"] = max([r["total_s"] for r in known], default=None)
    S["target_faster_than_final"] = sum(1 for r in known if r["target_s"] is not None and r["target_s"] < r["final_s"])
    S["simulated_race_s_mean"] = mean([r["simulated_race_s"] for r in known])
    S["simulated_race_s_max"] = max([r["simulated_race_s"] for r in known], default=None)
    by = {}
    for D in sorted({r["D"] for r in known}):
        k = [r for r in known if r["D"] == D]
        tr = [r["trace_reach_D_s"] for r in k if r["trace_reach_D_s"] is not None]
        by[str(D)] = dict(n=len(k), trace_reached=len(tr), trace_median=pct(tr, 0.5), trace_max=max(tr, default=None),
                          before_proof_end=sum(1 for r in k if r["trace_reach_D_s"] is not None and r["trace_reach_D_s"] <= r["proof_s"]),
                          proof_mean=mean([r["proof_s"] for r in k]), final_mean=mean([r["final_s"] for r in k]))
    S["by_D"] = by
    unk = [r for r in rows if r["D"] <= 0]
    S["unknown_D"] = [dict(index=r["index"], proof_s_spent=r["proof_s"], best=r["trace"][-1][1] if r["trace"] else None,
                           best_at_s=r["trace"][-1][0] if r["trace"] else None) for r in unk]
    # real race
    real = {}
    for tag in ["1t1", "split2", "race2", "split4", "race4"]:
        r = load(f"run-{s}-{tag}")
        if not r:
            continue
        for x in r:
            assert x["verified"] and not x["dnf"], f"{s} {tag} #{x['index']} failed"
            if x["D"] > 0:
                assert x["length"] == x["D"]
        real[tag] = dict(n=len(r), mean_s=mean([x["secs"] for x in r]), max_s=max(x["secs"] for x in r),
                         median_s=pct([x["secs"] for x in r], 0.5), by_ceiling=sum(x["by_ceiling"] for x in r),
                         mean_ceiling_nodes=mean([x["ceiling_nodes"] for x in r]),
                         mean_prover_nodes=mean([x["nodes"] for x in r]), indices=[x["index"] for x in r])
    S["real"] = real
    summary["sets"][s] = S
    for tag, v in real.items():
        impl = {"1t1": "c-1t", "split2": "c-2t-split", "race2": "c-2t-race", "split4": "c-4t-split", "race4": "c-4t-race"}[tag]
        frontier.append({
            "task": "ceiling", "puzzle": "3x3", "method": {"1t1": "IDA*, one thread", "split2": "IDA*, depth-3 split",
                                                          "split4": "IDA*, depth-3 split", "race2": "IDA* + two-phase ceiling race",
                                                          "race4": "IDA* (3-thread split) + two-phase ceiling race"}[tag],
            "floor": FLOOR, "floor_bytes": 73481013, "extra_bytes": 2 * 40320 * 24 if "race" in tag else 0,
            "positions": v["n"], "optimal": v["n"], "lookups_counting": "lab/3x3 nodes (generated children)",
            "mean_lookups": v["mean_prover_nodes"], "mean_final_round_lookups": None,
            "mean_extra_work": v["mean_ceiling_nodes"] if "race" in tag else None,
            "extra_work_unit": "ceiling nodes" if "race" in tag else None,
            "mean_ms": v["mean_s"] * 1000, "impl": impl,
            "notes": f"{s}; {v['by_ceiling']} of {v['n']} ended by the ceiling" if "race" in tag else s,
        })

(here / "results" / "summary.json").write_text(json.dumps(summary, indent=1))
(here / "results" / "frontier.json").write_text(json.dumps(frontier, indent=1))
with open(here / "results" / "traces.jsonl", "w") as f:
    for r in traces:
        f.write(json.dumps(r) + "\n")
print(json.dumps(summary, indent=1))
