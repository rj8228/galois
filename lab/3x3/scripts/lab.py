"""Runs the 3x3 floor lab and checkpoints every result to results/*.json.

    python3 scripts/lab.py builds      # ./cube3 build all (skips tables that exist), stats to results/
    python3 scripts/lab.py verify      # every floor vs the true distance, all positions <= 6 moves
    python3 scripts/lab.py stats       # mean floor over 1,000,000 random states, lookup cost
    python3 scripts/lab.py bench       # IDA* on the scramble sets, every floor set
    python3 scripts/lab.py superflip   # superflip with the best desktop set (and the best phone set, capped)
    python3 scripts/lab.py all         # the five above, in order

Run from lab/3x3 after `make`. bench and superflip skip work that is
already in results/, so an interrupted run picks up where it stopped (delete a file to redo it).
"""

import json
import math
import os
import pathlib
import platform
import subprocess
import sys
import time

LAB = pathlib.Path(__file__).resolve().parent.parent
RESULTS = LAB / "results"
SCRAMBLES = LAB / "scrambles"
CUBE3 = str(LAB / "cube3")
THREADS = int(os.environ.get("LAB_THREADS", os.cpu_count() or 4))

PHONE_BYTES = 20_000_000
DESKTOP_BYTES = 500_000_000

# Floor sets, cheapest first within each family. Token syntax is documented in src/cube3.c
# (parse_floor): C8s = all corners (16-symmetry reduced), E6/E7 = 6 or 7 edges, P1 = phase-1
# coordinate (twist x flip x slice), Kts/Kfs/Ktf = pairs of Kociemba coordinates;
# xN = N symmetric lookups, i = also the inverse position, @2 = 2-bit (mod 3) storage.
FLOORS = [
    ("Kociemba coordinates", "Kt+Kf+Ks"),
    ("Kociemba coordinates", "Kts+Kfs+Ktf"),
    ("Kociemba coordinates", "Ktsx3+Kfsx3+Ktfx3"),
    ("Kociemba coordinates", "P1"),
    ("Kociemba coordinates", "P1x3"),
    ("Kociemba coordinates", "P1x3i"),
    ("Corners", "C8", "moves-14"),
    ("Corners", "C8s"),
    ("Corners", "C8s+Ktsx3+Kfsx3+Ktfx3"),
    ("Corners + 6 edges", "C8s+E6x2"),
    ("Corners + 6 edges", "C8s+E6x8"),
    ("Corners + 6 edges", "C8s+E6x24", "moves-14"),
    ("Corners + 6 edges", "C8s+E6x24i", "moves-14"),
    ("Corners + 6 edges", "C8s+E6x24+Ktsx3+Kfsx3+Ktfx3", "moves-14"),
    ("Phone, 2-bit tables", "C8s@2+E6x24@2"),
    ("Phone, 2-bit tables", "C8s@2+E6x24@2+Ktsx3@2+Kfsx3@2+Ktfx3@2"),
    ("Phone, 2-bit tables", "C8s@2+E6x24@2+Ktsx3i+Kfsx3i+Ktfx3i"),
    ("Corners + 7 edges", "C8s+E7x2"),
    ("Corners + 7 edges", "C8s+E7x8"),
    ("Corners + 7 edges", "C8s+E7x8i"),
    ("Desktop", "C8s+E7x2+P1x3"),
    ("Desktop", "C8s+E7x2i+P1x3i"),
    ("Desktop", "C8s+E7x8i+P1x3i"),
    ("Desktop", "C8s+E6x24i+E7x8i+P1x3i"),
    ("Desktop", "C8s@2+E7x24@2+P1x3@2"),
]

# A third field stops a floor set after that scramble set: C8 has the same values as C8s, and the 4-bit
# twins of the 2-bit phone sets search the same nodes, so the short sets are enough to compare speed.
FLOORS = [f if len(f) == 3 else (*f, None) for f in FLOORS]

SETS = ["moves-12", "moves-14", "moves-16", "random-state"]

# Budgets. A solve stops (DNF) after MAX_NODES. A floor set skips a scramble set when the estimate
# says the whole set would take more than SET_BUDGET nodes; the estimate grows the mean nodes of
# the previous set by 13.35 (the branching factor of the search) per extra move of mean length.
MAX_NODES = 3_000_000_000
SET_BUDGET = 12_000_000_000
BRANCHING = 13.35
# The best desktop and phone sets (by the 16-move set) run all 20 random-state scrambles. Phone sets
# are capped lower there: their solves would take hours, and report.py estimates the total from the
# depths they completed.
RANDOM_STATE_TOP = {"desktop": 2, "phone": 1}
PHONE_RANDOM_STATE_NODES = 750_000_000
DESKTOP_RANDOM_STATE_NODES = 30_000_000_000


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def machine():
    cpu = ""
    try:
        for line in open("/proc/cpuinfo"):
            if line.startswith("model name"):
                cpu = line.split(":", 1)[1].strip()
                break
    except OSError:
        pass
    mem = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1e9
    cc = subprocess.run(["cc", "--version"], capture_output=True, text=True).stdout.splitlines()[0]
    return {"cpu": cpu, "cores": os.cpu_count(), "threads_used": THREADS, "ram_gb": round(mem, 1),
            "os": platform.platform(), "compiler": cc}


def load(name):
    p = RESULTS / name
    return json.loads(p.read_text()) if p.exists() else None


def save(name, data):
    RESULTS.mkdir(exist_ok=True)
    tmp = RESULTS / (name + ".tmp")
    tmp.write_text(json.dumps(data, indent=1) + "\n")
    tmp.replace(RESULTS / name)


def cube3(args, env=None):
    e = dict(os.environ, OMP_NUM_THREADS=str(THREADS), **(env or {}))
    r = subprocess.run([CUBE3, *args], cwd=LAB, capture_output=True, text=True, env=e)
    if r.returncode:
        sys.exit(f"cube3 {' '.join(args)} failed:\n{r.stderr}")
    return r.stdout


def tokens():
    out = []
    for _, spec, _ in FLOORS:
        for t in spec.split("+"):
            if t not in out:
                out.append(t)
    return out


def cmd_builds():
    subprocess.run([CUBE3, "build", "all"], cwd=LAB, check=True, env=dict(os.environ, OMP_NUM_THREADS=str(THREADS)))
    tables = [json.loads(p.read_text()) for p in sorted((LAB / "tables").glob("*.json"))]
    save("builds.json", {"machine": machine(), "tables": tables})
    log("builds:", ", ".join(t["table"] for t in tables))


def cmd_verify():
    # The first three floor sets also go through the search (--ida=3): every position at distance
    # <= 4 and 3,000 sampled at 5 and 6 must solve in exactly its distance.
    ida = ["C8s+E7x2i+P1x3i", "C8s@2+E6x24@2+Ktsx3i+Kfsx3i+Ktfx3i", "C8s@2+E7x24@2+P1x3@2"]
    t0 = time.time()
    data = json.loads(cube3(["verify", "--ida=3", *ida, *tokens()]))
    data["seconds"] = round(time.time() - t0, 1)
    data["machine"] = machine()
    save("verify.json", data)
    bad = [f["floor"] for f in data["floors"] if f["violations"] or f["fast_slow_mismatches"]]
    log("verify:", "FAILED " + ", ".join(bad) if bad else "every floor <= true distance",
        "| ida:", all(c["all_optimal"] for c in data["ida_check"]))


def cmd_stats():
    data = json.loads(cube3(["stats", *tokens(), *[spec for _, spec, _ in FLOORS]]))
    save("stats.json", {"machine": machine(), "samples": 1_000_000, "floors": data})
    log("stats: done")


def summarize(solves, meta):
    done = [s for s in solves if not s["dnf"]]
    nodes = [s["nodes"] for s in done]
    secs = [s["seconds"] for s in done]
    lengths = {}
    for s in done:
        lengths[str(s["length"])] = lengths.get(str(s["length"]), 0) + 1
    return {
        "bytes": meta["bytes"], "aux_bytes": meta["aux_bytes"], "lookups": meta["lookups"],
        "load_seconds": meta["load_seconds"], "scrambles": len(solves), "solved": len(done),
        "dnf": len(solves) - len(done), "all_verified": all(s["verified"] for s in done),
        "mean_nodes": sum(nodes) / len(nodes) if nodes else None, "max_nodes": max(nodes) if nodes else None,
        "mean_seconds": sum(secs) / len(secs) if secs else None, "max_seconds": max(secs) if secs else None,
        "nodes_per_second": sum(nodes) / sum(secs) if secs and sum(secs) else None,
        "mean_length": sum(s["length"] for s in done) / len(done) if done else None,
        "lengths": dict(sorted(lengths.items())),
        "mean_h0": sum(s["h0"] for s in solves) / len(solves),
    }


def run_set(spec, set_name, maxnodes=MAX_NODES, env=None):
    out = cube3(["solve", spec, f"scrambles/{set_name}.txt", str(maxnodes)], env)
    lines = [json.loads(line) for line in out.splitlines() if line.strip()]
    meta = lines[0]
    solves = sorted((x for x in lines[1:]), key=lambda x: x["index"])
    for s in solves:
        del s["type"]
    return {"summary": summarize(solves, meta), "meta": meta, "solves": solves}


def mean_length(set_name):
    """Mean optimal length of a set, from any floor set that solved all of it."""
    data = load(f"bench-{set_name}.json") or {}
    for run in data.get("floors", {}).values():
        s = run.get("summary")
        if s and s["dnf"] == 0 and s["solved"]:
            return s["mean_length"]
    return {"moves-12": 11.5, "moves-14": 13.3, "moves-16": 15.0, "random-state": 17.7}[set_name]


def estimate(spec, set_name):
    """Estimated mean nodes on set_name, from the previous set this floor set completed."""
    i = SETS.index(set_name)
    for prev in reversed(SETS[:i]):
        run = (load(f"bench-{prev}.json") or {}).get("floors", {}).get(spec)
        if run and run.get("summary") and run["summary"]["dnf"]:
            return math.inf  # it could not finish an easier set
        if run and run.get("summary") and run["summary"]["dnf"] == 0:
            gap = mean_length(set_name) - run["summary"]["mean_length"]
            return run["summary"]["mean_nodes"] * BRANCHING**gap
        if run and run.get("skipped"):
            if not run.get("estimated_mean_nodes") or run["estimated_mean_nodes"] == math.inf:
                return math.inf
            return run["estimated_mean_nodes"] * BRANCHING ** (mean_length(set_name) - mean_length(prev))
    return None  # nothing to go on: probe instead


def bench_one(spec, group, set_name, force=False, maxnodes=MAX_NODES):
    name = f"bench-{set_name}.json"
    data = load(name) or {"set": set_name, "machine": machine(), "max_nodes": MAX_NODES, "floors": {}}
    if spec in data["floors"]:
        return data["floors"][spec]
    n = sum(1 for line in open(SCRAMBLES / f"{set_name}.txt") if line.strip() and not line.startswith("#"))
    est = estimate(spec, set_name)
    probe = None
    if est is None and not force:
        # No easier set to estimate from: try the first 4 scrambles with this set's per-solve share.
        lines = [x for x in open(SCRAMBLES / f"{set_name}.txt") if x.strip() and not x.startswith("#")][:4]
        tmp = SCRAMBLES / f".probe-{set_name}.txt"
        tmp.write_text("".join(lines))
        probe = run_set(spec, tmp.relative_to(LAB).as_posix().removeprefix("scrambles/").removesuffix(".txt"),
                        SET_BUDGET // n)
        tmp.unlink()
    if probe and probe["summary"]["dnf"]:
        run = {"group": group, "skipped": True, "estimated_mean_nodes": None, "probe": probe,
               "reason": f"probe: {probe['summary']['dnf']} of 4 scrambles unsolved within {SET_BUDGET // n:.3g} nodes"}
        log(f"skip {spec} on {set_name}: probe failed")
    elif est is not None and not force and est * n > SET_BUDGET:
        run = {"group": group, "skipped": True, "estimated_mean_nodes": est if est != math.inf else None,
               "reason": "unfinished solves on an easier set" if est == math.inf else
               f"estimated {est:.3g} nodes per solve, over the {SET_BUDGET:.3g}-node budget for the set"}
        log(f"skip {spec} on {set_name}: est {est:.3g} nodes/solve")
    else:
        t0 = time.time()
        run = run_set(spec, set_name, maxnodes)
        run["group"] = group
        run["max_nodes"] = maxnodes
        run["wall_seconds"] = round(time.time() - t0, 1)
        s = run["summary"]
        log(f"{spec} on {set_name}: {s['solved']}/{s['scrambles']} solved, mean nodes {s['mean_nodes'] or 0:.3g}, "
            f"mean {s['mean_seconds'] or 0:.3f}s, lengths {s['lengths']}")
    data = load(name) or data
    data["floors"][spec] = run
    save(name, data)
    return run


def candidates(kind, top):
    """Best floor sets within the phone or desktop budget, by mean time on the 16-move set."""
    limit = PHONE_BYTES if kind == "phone" else DESKTOP_BYTES
    runs = (load("bench-moves-16.json") or {}).get("floors", {})
    ok = [(r["summary"]["mean_seconds"], spec) for spec, r in runs.items()
          if r.get("summary") and r["summary"]["dnf"] == 0
          and r["summary"]["bytes"] + r["summary"]["aux_bytes"] <= limit]
    return [spec for _, spec in sorted(ok)[:top]]


def cmd_bench():
    group_of = dict((spec, g) for g, spec, _ in FLOORS)
    for set_name in SETS[:3]:
        for group, spec, last in FLOORS:
            if last and SETS.index(set_name) > SETS.index(last):
                continue
            bench_one(spec, group, set_name)
    # Random-state positions: all 20 for the best desktop and phone sets; the rest by estimate.
    desktop = candidates("desktop", RANDOM_STATE_TOP["desktop"])
    phone = candidates("phone", RANDOM_STATE_TOP["phone"])
    log("random-state with", desktop, phone)
    for spec in desktop:
        bench_one(spec, group_of[spec], "random-state", force=True, maxnodes=DESKTOP_RANDOM_STATE_NODES)
    for spec in phone:
        bench_one(spec, group_of[spec], "random-state", force=True, maxnodes=PHONE_RANDOM_STATE_NODES)
    for group, spec, last in FLOORS:
        if not last:
            bench_one(spec, group, "random-state")


def cmd_superflip():
    data = load("superflip.json") or {"machine": machine(), "runs": {}}
    rs = (load("bench-random-state.json") or {}).get("floors", {})

    def best(limit):
        ok = [(r["summary"]["mean_seconds"], spec) for spec, r in rs.items()
              if r.get("summary") and r["summary"]["dnf"] == 0 and r["summary"]["bytes"] + r["summary"]["aux_bytes"] <= limit]
        if ok:
            return sorted(ok)[0][1]
        top = candidates("phone" if limit == PHONE_BYTES else "desktop", 1)
        return top[0] if top else None

    # One solve on every thread (CUBE3_SPLIT=3 shares the depth-3 subtrees), so time is wall-clock
    # on all cores. The phone set gets a node cap; its per-depth counts give an estimate.
    plan = [(best(DESKTOP_BYTES), 400_000_000_000), (best(PHONE_BYTES), 10_000_000_000)]
    for spec, cap in plan:
        if not spec or spec in data["runs"]:
            continue
        log(f"superflip with {spec} (cap {cap:.3g} nodes)")
        t0 = time.time()
        run = run_set(spec, "superflip", cap, env={"CUBE3_SPLIT": "3"})
        run["wall_seconds"] = round(time.time() - t0, 1)
        s = run["solves"][0]
        if s["dnf"]:
            # Extrapolate: each depth bound costs about as many times the previous one as the last
            # two completed bounds did, and the final bound (20) runs until the first solution.
            per = {int(k): v for k, v in s["nodes_per_bound"].items()}
            done = sorted(per)[:-1]  # the last bound was cut off
            r = per[done[-1]] / per[done[-2]]
            est = sum(per[b] for b in done) + sum(per[done[-1]] * r ** (b - done[-1]) for b in range(done[-1] + 1, 21))
            run["estimate"] = {"completed_bounds": done, "growth_per_bound": r, "nodes_to_prove_20": est,
                               "note": "upper estimate: assumes bound 20 is searched to the end"}
        data["runs"][spec] = run
        save("superflip.json", data)
        log(f"superflip {spec}: length {s['length']}, nodes {s['nodes']:.3g}, {s['seconds']:.0f}s, dnf {s['dnf']}")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    steps = {"builds": [cmd_builds], "verify": [cmd_verify], "stats": [cmd_stats], "bench": [cmd_bench],
             "superflip": [cmd_superflip], "all": [cmd_builds, cmd_verify, cmd_stats, cmd_bench, cmd_superflip]}[cmd]
    for step in steps:
        step()


if __name__ == "__main__":
    main()
