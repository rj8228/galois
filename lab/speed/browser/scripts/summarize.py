"""Summarises results/runs/ into results/summary.json, results/frontier.json and the tables in FINDINGS.md.

    python3 scripts/summarize.py            (prints the markdown tables)
"""
import glob
import json
import os

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RUNS = os.path.join(HERE, "results", "runs")
LAB = os.path.join(HERE, "..", "..", "3x3")
FLOOR_NAME = {"C8s@2+E6x8@2": "phone", "C8s+P1x3i": "desktop"}


def mean(a):
    return sum(a) / len(a) if a else None


def load():
    rows = []
    for f in sorted(glob.glob(os.path.join(RUNS, "*.json"))):
        d = json.load(open(f))
        if d.get("kind") != "solve":
            continue
        ok = [s for s in d["solves"] if not s["dnf"]]
        final = [s["perBound"][str(s["length"])] for s in ok]
        rows.append({
            "impl": f"wasm-{d['workers']}w" + (f"-sd{d['sd']}" if d["sd"] and d["sd"] != 2 else ""),
            "workers": d["workers"], "sd": d["sd"], "floor": d["floor"], "set": d["set"],
            "positions": len(d["solves"]), "solved": len(ok),
            "mean_ms": mean([s["found_ms"] for s in ok]),
            "mean_drain_ms": mean([s["drain_ms"] for s in ok]),
            "max_ms": max(s["found_ms"] for s in ok) if ok else None,
            "mean_nodes": mean([s["nodes"] for s in ok]),
            "mean_final_round_nodes": mean(final),
            "nodes_per_second": sum(s["nodes"] for s in ok) / (sum(s["found_ms"] for s in ok) / 1e3) if ok else None,
            "floor_bytes": d["setup"]["loads"][0]["floor_bytes"], "aux_bytes": d["setup"]["loads"][0]["aux_bytes"],
            "wasm_memory_bytes": sum(d["wasm_memory_per_worker"]),
            "wasm_memory_per_worker": d["wasm_memory_per_worker"][0],
            "chromium_pss_bytes": d["chromium_pss"]["after_setup"],
            "chromium_pss_before_setup": d["chromium_pss"]["before_setup"],
            "setup_ms": d["setup"]["total_ms"],
            "chromium": d["chromium"],
            "lengths": [s["length"] for s in d["solves"]],
            "nodes": [s["nodes"] for s in d["solves"]],
        })
    for f in sorted(glob.glob(os.path.join(RUNS, "native__*.jsonl"))):
        lines = [json.loads(x) for x in open(f)]
        meta = lines[0]
        solves = [x for x in lines if x["type"] == "solve"]
        ok = [s for s in solves if not s["dnf"]]
        st = os.path.basename(f)[len("native__"):-len(".jsonl")].split("__")[1]
        rows.append({
            "impl": "native-1t", "workers": 1, "sd": None, "floor": meta["floor"], "set": st,
            "positions": len(solves), "solved": len(ok),
            "mean_ms": mean([s["seconds"] * 1e3 for s in ok]), "mean_drain_ms": None,
            "max_ms": max(s["seconds"] * 1e3 for s in ok),
            "mean_nodes": mean([s["nodes"] for s in ok]),
            "mean_final_round_nodes": mean([s["nodes_per_bound"][str(s["length"])] for s in ok]),
            "nodes_per_second": sum(s["nodes"] for s in ok) / sum(s["seconds"] for s in ok),
            "floor_bytes": meta["bytes"], "aux_bytes": meta["aux_bytes"],
            "lengths": [s["length"] for s in solves], "nodes": [s["nodes"] for s in solves],
        })
    return rows


def node_check(rows):
    """1-worker wasm must give exactly native's node counts (same search order)."""
    out = []
    for r in rows:
        if r["impl"] != "wasm-1w":
            continue
        n = next((x for x in rows if x["impl"] == "native-1t" and x["floor"] == r["floor"] and x["set"] == r["set"]), None)
        if n:
            out.append({"floor": r["floor"], "set": r["set"], "positions": r["positions"],
                        "identical_nodes": sum(a == b for a, b in zip(r["nodes"], n["nodes"])),
                        "identical_lengths": sum(a == b for a, b in zip(r["lengths"], n["lengths"]))})
    return out


def phone_minute():
    """Machine-independent: per-bound node counts of lab/3x3's phone-set runs, to see which bounds a
    node budget clears. Returns, for each set, how many scrambles finish within each budget."""
    out = {}
    for st in ["moves-14", "moves-16", "random-state"]:
        d = json.load(open(os.path.join(LAB, "results", f"bench-{st}.json")))["floors"]["C8s@2+E6x8@2"]
        solves = d["solves"]
        out[st] = {"positions": len(solves), "nodes": [None if s["dnf"] else s["nodes"] for s in solves],
                   "per_bound": [s["nodes_per_bound"] for s in solves]}
    return out


def main():
    rows = load()
    build = json.load(open(os.path.join(RUNS, "build.json")))
    checks = node_check(rows)
    summary = {"runs": [{k: v for k, v in r.items() if k not in ("nodes", "lengths")} for r in rows],
               "node_check": checks, "build": build}
    json.dump(summary, open(os.path.join(HERE, "results", "summary.json"), "w"), indent=1)

    frontier = []
    for r in rows:
        if r["set"] not in ("moves-12", "moves-14", "moves-16-first10", "random-idx0-idx7"):
            continue
        extra = (r["workers"] - 1) * r["wasm_memory_per_worker"] if r["impl"].startswith("wasm") else 0
        frontier.append({
            "task": "browser", "puzzle": "3x3",
            "method": ("IDA* (native C, 1 thread)" if r["impl"] == "native-1t" else f"IDA* (wasm in headless Chromium, {r['workers']} worker(s))") + f", {r['set']}",
            "floor": f"{r['floor']} ({FLOOR_NAME[r['floor']]})",
            "floor_bytes": r["floor_bytes"], "extra_bytes": extra,
            "positions": r["positions"], "optimal": r["solved"],
            "lookups_counting": "cube3 nodes (children generated)",
            "mean_lookups": round(r["mean_nodes"], 1), "mean_final_round_lookups": round(r["mean_final_round_nodes"], 1),
            "mean_extra_work": None, "extra_work_unit": None,
            "mean_ms": round(r["mean_ms"], 2), "impl": r["impl"],
            "notes": (f"split depth {r['sd']}, private table copy per worker; " if r["workers"] > 1 else "")
            + f"{r['nodes_per_second'] / 1e6:.2f} M nodes/s; set {r['set']}",
        })
    json.dump(frontier, open(os.path.join(HERE, "results", "frontier.json"), "w"), indent=1)

    # Markdown tables
    def ms(x):
        return "–" if x is None else (f"{x / 1e3:.1f} s" if x >= 1000 else f"{x:.1f} ms")

    print("### One worker against native\n")
    print("| Floor set | Scrambles | Native, 1 thread | wasm, 1 worker | wasm / native | M nodes/s native → wasm | Same nodes |")
    print("|---|---|--:|--:|--:|--:|--:|")
    for f in FLOOR_NAME:
        for st in ["moves-12", "moves-14", "moves-16-first10"]:
            n = next((x for x in rows if x["impl"] == "native-1t" and x["floor"] == f and x["set"] == st), None)
            w = next((x for x in rows if x["impl"] == "wasm-1w" and x["floor"] == f and x["set"] == st), None)
            if not (n and w):
                continue
            c = next(c for c in checks if c["floor"] == f and c["set"] == st)
            print(f"| {FLOOR_NAME[f]} `{f}` | {st} ({w['positions']}) | {ms(n['mean_ms'])} | {ms(w['mean_ms'])} | {w['mean_ms'] / n['mean_ms']:.2f}× | "
                  f"{n['nodes_per_second'] / 1e6:.1f} → {w['nodes_per_second'] / 1e6:.1f} | {c['identical_nodes']}/{c['positions']} |")
    print("\n### Workers\n")
    print("| Floor set | Scrambles | Workers | Mean time to answer | Speed-up | Mean nodes | wasm memory | Chromium PSS |")
    print("|---|---|--:|--:|--:|--:|--:|--:|")
    for f in FLOOR_NAME:
        for st in ["moves-12", "moves-14", "moves-16-first10", "random-idx0-idx7"]:
            rs = sorted([x for x in rows if x["impl"].startswith("wasm") and x["floor"] == f and x["set"] == st], key=lambda x: (x["workers"], x["sd"] or 0))
            base = next((x for x in rs if x["workers"] == 1), None)
            for r in rs:
                sp = f"{base['mean_ms'] / r['mean_ms']:.2f}×" if base else "–"
                label = f"{r['workers']}" + (f" (split depth {r['sd']})" if r["sd"] and r["sd"] != 2 else "")
                print(f"| {FLOOR_NAME[f]} | {st} | {label} | {ms(r['mean_ms'])} | {sp} | {r['mean_nodes']:,.0f} | "
                      f"{r['wasm_memory_bytes'] / 1e6:.0f} MB | {r['chromium_pss_bytes'] / 1e6:.0f} MB |")
    print("\n### Building tables in the browser\n")
    print("| Table | Entries | Bytes stored | Build (1 worker) | Write to IndexedDB |")
    print("|---|--:|--:|--:|--:|")
    for f, b in build["builds"].items():
        for t in b["tables"]:
            print(f"| `{t['table']}` | {t['entries']:,} | {t['bytes'] / 1e6:.1f} MB | {t['build_ms'] / 1e3:.1f} s | {t['store_ms']:.0f} ms |")
    print("\n| Floor set | Cached start: read IndexedDB + copy in + index | of which index (symmetry classes) |")
    print("|---|--:|--:|")
    for f, l in build["cached_loads"].items():
        print(f"| {FLOOR_NAME[f]} `{f}` | {l['total_ms']:.0f} ms | {l['loads'][0]['index_ms']:.0f} ms |")
    json.dump(phone_minute(), open(os.path.join(HERE, "results", "phone-budget.json"), "w"))


if __name__ == "__main__":
    main()
