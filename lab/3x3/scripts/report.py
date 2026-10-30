"""Writes the tables in FINDINGS.md from results/*.json.

    python3 scripts/report.py

Everything between the <!-- tables:start --> and <!-- tables:end --> markers in FINDINGS.md is
replaced; the prose around it is not touched.
"""

import json
import pathlib
import re

LAB = pathlib.Path(__file__).resolve().parent.parent
RESULTS = LAB / "results"
SETS = ["moves-12", "moves-14", "moves-16", "random-state"]
SET_TITLE = {"moves-12": "12 random moves", "moves-14": "14 random moves", "moves-16": "16 random moves",
             "random-state": "random state (cubing.js)"}


def load(name):
    p = RESULTS / name
    return json.loads(p.read_text()) if p.exists() else None


def mb(b):
    if b < 10_000:
        return f"{b / 1e3:.1f} KB"
    return f"{b / 1e6:.1f} MB" if b < 100e6 else f"{b / 1e6:.0f} MB"


def num(x):
    if x is None:
        return "–"
    if x < 1000:
        return f"{x:.0f}"
    e = len(str(int(x))) - 1
    return f"{x / 10**e:.1f}e{e}"


def secs(x):
    if x is None:
        return "–"
    if x < 0.001:
        return f"{x * 1e6:.0f} µs"
    if x < 1:
        return f"{x * 1e3:.1f} ms"
    if x < 120:
        return f"{x:.1f} s"
    if x < 7200:
        return f"{x / 60:.1f} min"
    return f"{x / 3600:.1f} h"


def lengths(d):
    return ", ".join(f"{k}: {v}" for k, v in d.items())


def table(head, rows, align=None):
    align = align or ["---"] + ["--:"] * (len(head) - 1)
    out = ["| " + " | ".join(head) + " |", "| " + " | ".join(align) + " |"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def builds_section():
    b = load("builds.json")
    if not b:
        return ""
    rows = []
    for t in sorted(b["tables"], key=lambda t: t["entries"]):
        rows.append([f"`{t['table']}`", f"{t['entries']:,}", t["max"], f"{t['mean_over_entries']:.3f}",
                     mb(t["bytes_4bit"]), mb(t["bytes_2bit"]), f"{t['build_seconds']:.1f} s"])
    return "### Tables\n\n" + table(
        ["Table", "Entries", "Max", "Mean (entries)", "4-bit", "2-bit (mod 3)", "Build"], rows) + "\n"


def verify_section():
    v = load("verify.json")
    st = {f["floor"]: f for f in (load("stats.json") or {"floors": []})["floors"]}
    if not v:
        return ""
    n = sum(v["positions_per_distance"])
    rows = []
    for f in v["floors"]:
        rnd = st.get(f["floor"], {}).get("mean_random")
        rows.append([f"`{f['floor']}`", f["lookups"], f"{f['violations']:,}", f["max_floor_minus_distance"],
                     f"{f['mean_floor_by_distance'][6]:.3f}", f"{rnd:.3f}" if rnd is not None else "–"])
    ida = "; ".join(
        f"`{c['floor']}`: {sum(x['optimal'] for x in c['per_distance']):,} of {sum(x['solved'] for x in c['per_distance']):,} optimal"
        for c in v["ida_check"])
    return (f"### Every floor against the true distance\n\nAll {n:,} positions within 6 moves "
            f"({', '.join(f'{c:,}' for c in v['positions_per_distance'])} at distance 0–6), "
            f"found by breadth-first search over whole positions. *Violations* counts lookups above the true "
            f"distance, *max floor − distance* is the worst case (0 means some position meets its floor "
            f"exactly). The last column is the mean floor over 1,000,000 uniformly random positions "
            f"(`results/stats.json`).\n\n"
            + table(["Floor", "Lookups", "Violations", "Max floor − distance", "Mean floor at distance 6",
                     "Mean floor, random"], rows)
            + f"\n\nThe search on the same positions (every position at distance ≤ 4, 3,000 sampled at 5 and 6), "
            f"solution length must equal the distance: {ida}.\n")


def all_runs():
    runs = {}
    for s in SETS:
        d = load(f"bench-{s}.json")
        if d:
            for spec, r in d["floors"].items():
                runs.setdefault(spec, {})[s] = r
    return runs


def memory(r):
    for run in r.values():
        if run.get("summary"):
            return run["summary"]["bytes"] + run["summary"]["aux_bytes"]
        if run.get("probe"):
            return run["probe"]["summary"]["bytes"] + run["probe"]["summary"]["aux_bytes"]
    return None


def optimal_lengths():
    """Optimal length of each random-state scramble, from any run that solved it."""
    out = {}
    d = load("bench-random-state.json") or {"floors": {}}
    for run in d["floors"].values():
        for s in run.get("solves", []):
            if not s["dnf"]:
                out[s["index"]] = s["length"]
    return out


def estimate_solve(s, L, ref):
    """Estimated total nodes for a capped solve: grow the last completed depth bound by the ratio
    of the last two up to bound L-1, then add the final bound at the fraction the reference run
    (same scramble, uncapped) needed before its first solution."""
    per = {int(k): v for k, v in s["nodes_per_bound"].items()}
    done = sorted(per)[:-1]
    if len(done) < 2 or L is None:
        return None
    r = per[done[-1]] / per[done[-2]]
    total = sum(per[b] for b in done)
    last = per[done[-1]]
    for b in range(done[-1] + 1, L):
        total += last * r ** (b - done[-1])
    frac = 1.0
    if ref:
        rp = {int(k): v for k, v in ref["nodes_per_bound"].items()}
        if L in rp and L - 1 in rp and L - 2 in rp:
            frac = rp[L] / (rp[L - 1] * rp[L - 1] / rp[L - 2])
    total += last * r ** (L - done[-1]) * frac
    return total


def overview_section(runs):
    st = {f["floor"]: f for f in (load("stats.json") or {"floors": []})["floors"]}
    rows = []
    for spec, r in runs.items():
        group = next((x.get("group") for x in r.values() if x.get("group")), "")
        cells = [f"`{spec}`", group, mb(memory(r)) if memory(r) else "–",
                 f"{st[spec]['mean_random']:.2f}" if spec in st else "–"]
        for s in SETS:
            run = r.get(s)
            if not run:
                cells.append("")
            elif run.get("skipped"):
                cells.append("skipped")
            else:
                sm = run["summary"]
                c = f"{num(sm['mean_nodes'])} / {secs(sm['mean_seconds'])}"
                if sm["dnf"]:
                    c += f" ({sm['dnf']} DNF)"
                cells.append(c)
        rows.append(cells)
    head = ["Floor set", "Family", "Memory", "Mean floor"] + [SET_TITLE[s] for s in SETS]
    return ("### Overview: mean nodes / mean time per solve\n\nMemory is what the app holds: packed tables "
            "plus the small class tables that index the symmetry-reduced ones (those can also be computed "
            "at startup in about a second). Mean floor is over 1,000,000 random positions. Each solve runs "
            "on one thread, four at a time. *Skipped* means the estimate from the previous set (or a 4-scramble "
            "probe) was over the budget; the reason is in the JSON.\n\n"
            + table(head, rows, ["---", "---"] + ["--:"] * (len(head) - 2)) + "\n")


def detail_section(runs, s):
    rows = []
    for spec, r in runs.items():
        run = r.get(s)
        if not run or run.get("skipped"):
            continue
        sm = run["summary"]
        rows.append([f"`{spec}`", mb(sm["bytes"] + sm["aux_bytes"]), f"{sm['solved']}/{sm['scrambles']}",
                     f"{sm['mean_h0']:.2f}", num(sm["mean_nodes"]), num(sm["max_nodes"]), secs(sm["mean_seconds"]),
                     secs(sm["max_seconds"]), f"{(sm['nodes_per_second'] or 0) / 1e6:.1f}M",
                     lengths(sm["lengths"])])
    if not rows:
        return ""
    return (f"### {SET_TITLE[s]}\n\n"
            + table(["Floor set", "Memory", "Solved", "Mean root floor", "Mean nodes", "Max nodes", "Mean time",
                     "Max time", "Nodes/s", "Optimal lengths"], rows, ["---"] + ["--:"] * 8 + ["---"]) + "\n")


def random_state_section():
    d = load("bench-random-state.json")
    if not d:
        return ""
    L = optimal_lengths()
    uncapped = {spec: r for spec, r in d["floors"].items() if r.get("solves") and not r["summary"]["dnf"]}
    out = []
    for spec, r in d["floors"].items():
        if not r.get("solves") or not r["summary"]["dnf"]:
            continue
        rate = r["summary"]["nodes_per_second"]
        ests = []
        for s in r["solves"]:
            ref = next((x for u in uncapped.values() for x in u["solves"] if x["index"] == s["index"]), None)
            ests.append(s["nodes"] if not s["dnf"] else estimate_solve(s, L.get(s["index"]), ref))
        ok = [e for e in ests if e]
        if not ok:
            continue
        if not rate:
            tot_n = sum(x["nodes"] for x in r["solves"])
            tot_s = sum(x["seconds"] for x in r["solves"])
            rate = tot_n / tot_s
        mean = sum(ok) / len(ok)
        out.append(f"- `{spec}`: {r['summary']['solved']} of {r['summary']['scrambles']} solved within the cap of "
                   f"{num(r.get('max_nodes'))} nodes. Estimated from the depths each capped solve completed "
                   f"(see `report.py`, `estimate_solve`): mean {num(mean)} nodes, max {num(max(ok))}, so about "
                   f"{secs(mean / rate)} per solve on one thread at its measured {rate / 1e6:.1f}M nodes/s.")
    return ("### Capped runs, estimated\n\n" + "\n".join(out) + "\n") if out else ""


def superflip_section():
    d = load("superflip.json")
    if not d:
        return ""
    rows = []
    for spec, r in d["runs"].items():
        s = r["solves"][0]
        est = r.get("estimate")
        rows.append([f"`{spec}`", mb(r["summary"]["bytes"] + r["summary"]["aux_bytes"]),
                     s["length"] if not s["dnf"] else "DNF (capped)", s["h0"], s["root_symmetries"], num(s["nodes"]),
                     secs(s["seconds"]), s["solution"] or "–",
                     num(est["nodes_to_prove_20"]) if est else "–"])
    per = []
    for spec, r in d["runs"].items():
        s = r["solves"][0]
        per.append(f"- `{spec}`: " + ", ".join(f"{b}: {num(n)}" for b, n in s["nodes_per_bound"].items()))
    return ("### Superflip\n\nOne solve on all four threads (the subtrees at depth 3 are shared out), so time is "
            "wall-clock on four cores. The first move is limited to one per orbit of superflip's 48 symmetries.\n\n"
            + table(["Floor set", "Memory", "Length", "Root floor", "Root symmetries", "Nodes", "Time", "Solution",
                     "Estimated nodes to finish"], rows, ["---"] + ["--:"] * 6 + ["---", "--:"])
            + "\n\nNodes per depth bound:\n\n" + "\n".join(per) + "\n")


def machine_section():
    m = (load("bench-moves-12.json") or load("verify.json") or {}).get("machine")
    if not m:
        return ""
    return (f"Measured on {m['cpu']}, {m['cores']} cores, {m['ram_gb']} GB RAM, {m['os']}, {m['compiler']}, "
            f"{m['threads_used']} threads.\n")


def main():
    runs = all_runs()
    parts = [machine_section(), builds_section(), verify_section(), overview_section(runs)]
    parts += [detail_section(runs, s) for s in SETS]
    parts += [random_state_section(), superflip_section()]
    body = "\n".join(p for p in parts if p)
    f = LAB / "FINDINGS.md"
    text = f.read_text()
    text = re.sub(r"<!-- tables:start -->.*<!-- tables:end -->",
                  lambda _: f"<!-- tables:start -->\n\n{body}\n<!-- tables:end -->", text, flags=re.S)
    f.write_text(text)
    print(f"wrote tables to {f}")


if __name__ == "__main__":
    main()
