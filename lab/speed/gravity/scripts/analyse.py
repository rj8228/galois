#!/usr/bin/env python3
"""Checks every run in results/raw, then writes results/gravity.json, results/frontier.json and the tables in FINDINGS.md.

Checks (any failure aborts):
  - every solution verified (replayed to solved by grav3), no capped run
  - masked modes: same solution as the baseline, and per round, children generated + children skipped
    = the baseline's children generated (identical expansions)
  - baseline lookups = lab/3x3's node count for the same scramble and floor set
  - lengths = lab/3x3's lengths
"""
import json, math, os, re, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, "results", "raw")
LAB = os.path.join(ROOT, "..", "..", "3x3", "results")
FLOOR = "C8s+P1x3i"
MODES = {0: "baseline", 1: "down masks (uint32)", 2: "full masks (down + up, 2 x uint32)", 3: "down masks packed (18 bits)"}
SETS = {"moves-12": "12 moves", "moves-14": "14 moves", "moves-16": "16 moves", "random-two": "random state (2)"}

fails = []


def check(ok, msg):
    if not ok:
        fails.append(msg)


def load(path):
    meta, solves = None, []
    for line in open(path):
        d = json.loads(line)
        if d["type"] == "meta":
            meta = meta or d
        else:
            solves.append(d)
    return meta, solves


lab = {}
for n in ("12", "14", "16"):
    p = os.path.join(LAB, f"bench-moves-{n}.json")
    for s in json.load(open(p))["floors"][FLOOR]["solves"]:
        lab[s["scramble"]] = s
p = os.path.join(LAB, "bench-random-state.json")
for s in json.load(open(p))["floors"][FLOOR]["solves"]:
    lab[s["scramble"]] = s

runs = {}
for f in sorted(os.listdir(RAW)):
    m = re.match(r"(.+)-t(\d)-m(\d)\.jsonl$", f)
    if not m:
        continue
    runs[(m.group(1), int(m.group(2)), int(m.group(3)))] = load(os.path.join(RAW, f))

checked_lengths = checked_nodes = 0
for (st, th, mode), (meta, solves) in runs.items():
    tag = f"{st} t{th} m{mode}"
    for s in solves:
        check(s["verified"] and not s["dnf"], f"{tag}: #{s['scramble']} unverified or capped")
        L = lab.get(s["scramble"])
        if L and L["length"] > 0:
            check(L["length"] == s["length"], f"{tag}: length {s['length']} != lab/3x3 {L['length']}")
            checked_lengths += 1
            if mode == 0:
                check(L["nodes"] == s["nodes"], f"{tag}: nodes {s['nodes']} != lab/3x3 {L['nodes']}")
                checked_nodes += 1
    base = runs.get((st, th, 0))
    if mode and base:
        bs = {s["scramble"]: s for s in base[1]}
        for s in solves:
            b = bs[s["scramble"]]
            if th == 1:  # split mode: the threads race, so the winning solution and counts can differ
                check(b["solution"] == s["solution"], f"{tag}: solution differs from baseline")
                for k, (n, sk) in s["nodes_per_bound"].items():
                    check(b["nodes_per_bound"][k][0] == n + sk, f"{tag}: round {k}: {n} + {sk} != {b['nodes_per_bound'][k][0]}")
            check(b["length"] == s["length"], f"{tag}: length differs from baseline")

if fails:
    print("\n".join(fails[:30]))
    sys.exit(f"{len(fails)} check(s) failed")

rows = []
for (st, th, mode), (meta, solves) in sorted(runs.items()):
    base = {s["scramble"]: s for s in runs[(st, th, 0)][1]}
    ms = [s["seconds"] * 1000 for s in solves]
    ratios = [base[s["scramble"]]["seconds"] / s["seconds"] for s in solves if s["seconds"] > 0 and base[s["scramble"]]["seconds"] > 0]
    gen = sum(s["nodes"] for s in solves) / len(solves)
    sk = sum(s["skipped"] for s in solves) / len(solves)
    rows.append({
        "set": st, "threads": th, "mode": mode, "method": MODES[mode], "solves": len(solves),
        "mean_ms": statistics.mean(ms), "median_ms": statistics.median(ms),
        "speedup_mean": statistics.mean(base[s["scramble"]]["seconds"] for s in solves) * 1000 / statistics.mean(ms),
        "speedup_geomean": math.exp(statistics.mean(math.log(r) for r in ratios)),
        "lookups": gen, "skipped": sk, "skipped_share": sk / (gen + sk),
        "mask_reads": sum(s["mask_reads"] for s in solves) / len(solves),
        "mask_bytes": meta["mask_bytes"], "floor_bytes": meta["bytes"], "aux_bytes": meta["aux_bytes"],
        "mean_length": statistics.mean(s["length"] for s in solves),
    })

builds = {}
for t in ("corners_sym", "phase1_sym"):
    p = os.path.join(ROOT, "data", "tables", f"{t}.masks.json")
    if os.path.exists(p):
        builds[t] = json.load(open(p))
mc = json.load(open(os.path.join(ROOT, "results", "maskcheck.json")))
mcw = json.load(open(os.path.join(ROOT, "results", "maskcheck-wrong-frame.json")))
json.dump({"floor": FLOOR, "rows": rows, "mask_builds": builds, "maskcheck": mc, "maskcheck_wrong_frame": mcw,
           "checks": {"lengths_vs_lab3x3": checked_lengths, "baseline_nodes_vs_lab3x3": checked_nodes}},
          open(os.path.join(ROOT, "results", "gravity.json"), "w"), indent=1)

frontier = []
for r in rows:
    if r["threads"] != 1:
        continue
    frontier.append({
        "task": "gravity", "puzzle": "3x3", "method": r["method"], "floor": f"{FLOOR}, {SETS[r['set']]}",
        "floor_bytes": r["floor_bytes"] + r["aux_bytes"], "extra_bytes": r["mask_bytes"],
        "positions": r["solves"], "optimal": r["solves"], "lookups_counting": "exp8 (lab/3x3 nodes: generated children)",
        "mean_lookups": round(r["lookups"], 1), "mean_final_round_lookups": None,
        "mean_extra_work": round(r["mask_reads"], 1) if r["mode"] else None,
        "extra_work_unit": "mask reads" if r["mode"] else None,
        "mean_ms": round(r["mean_ms"], 2), "impl": "c, 1 thread",
        "notes": f"{r['skipped_share']:.0%} of the baseline's children skipped; {r['speedup_mean']:.2f}x the baseline's speed (mean ms)",
    })
json.dump(frontier, open(os.path.join(ROOT, "results", "frontier.json"), "w"), indent=1)


def fmt(x, d=0):
    return f"{x:,.{d}f}"


out = ["### Time per solve", "",
       "Desktop set `C8s+P1x3i` (73.5 MB floor). Same binary, masks on or off; one process at a time on an idle 4-core machine. "
       "*Lookups*: children generated (lab/3x3's node count; each is read against the floor). *Skipped*: children the masks ruled out "
       "before generating them. *Speed-up*: baseline mean ms / this mean ms, and the geometric mean of the per-solve ratios.", "",
       "| Set (solves), threads | Method | Mask memory | Mean ms | Median ms | Speed-up (mean, per-solve geomean) | Lookups per solve | Skipped | Mask reads per solve |",
       "| --- | --- | --: | --: | --: | --: | --: | --: | --: |"]
for r in rows:
    mem = "–" if not r["mask_bytes"] else f"{r['mask_bytes'] / 1e6:,.0f} MB"
    out.append(f"| {SETS[r['set']]} ({r['solves']}), {r['threads']} | {r['method']} | {mem} | {fmt(r['mean_ms'], 1)} | {fmt(r['median_ms'], 1)} | "
               f"{r['speedup_mean']:.2f}×, {r['speedup_geomean']:.2f}× | {fmt(r['lookups'])} | {r['skipped_share']:.0%} | "
               f"{fmt(r['mask_reads']) if r['mode'] else '–'} |")
out += ["", "### Building and checking the masks", "",
        "| Table | Entries | Build (4 threads) | Write | Down moves per entry | Up moves per entry | uint32 | 18-bit |",
        "| --- | --: | --: | --: | --: | --: | --: | --: |"]
for t, b in builds.items():
    out.append(f"| {t} | {fmt(b['entries'])} | {b['build_seconds']:.1f} s | {b['write_seconds']:.1f} s | {b['mean_down_moves']:.2f} | "
               f"{b['mean_up_moves']:.2f} | {b['bytes_down32'] / 1e6:,.0f} MB | {b['bytes_down18'] / 1e6:,.0f} MB |")
out += ["", f"**Mapping check:** {fmt(mc['positions'])} positions (half uniformly random, half random walks of 0–14 moves), "
        f"{mc['masked_lookups']} masked lookups each, {fmt(mc['child_checks'])} child lookups compared with the mapped masks: "
        f"{mc['bad_index']} wrong indices, {mc['bad_down']} wrong down bits, {mc['bad_up']} wrong up bits. "
        f"Conjugating the wrong way round (`GRAV3_WRONG_FRAME=1`) gives {fmt(mcw['bad_down'])} wrong down bits out of {fmt(mcw['child_checks'])}, "
        "so the check does catch a backwards map.", "",
        f"**Checks:** every solution replayed to solved; single-thread masked runs gave the baseline's solution, and per round "
        f"children generated + skipped = the baseline's children generated, on every solve; {checked_nodes} baseline node counts "
        f"and {checked_lengths} lengths equal lab/3x3's, 0 differences; no run capped."]

fp = os.path.join(ROOT, "FINDINGS.md")
if os.path.exists(fp):
    s = open(fp).read()
    s = re.sub(r"(<!-- tables:start -->\n).*?(\n<!-- tables:end -->)", lambda m: m.group(1) + "\n".join(out) + m.group(2), s, flags=re.S)
    open(fp, "w").write(s)
print("\n".join(out))
