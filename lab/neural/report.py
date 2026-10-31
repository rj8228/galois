"""Gather results/*.json into results/summary.json and the markdown tables in results/table*.md.

Nets are named <checkpoint>_<fp16|int8>_m<margin>; their bytes are weights plus the Elias-Fano
coded correction table. For each net the cheapest plain table that is at least as strong
(mean floor and IDA* nodes both no worse) is named as the plain table that beats it, and the
net is set beside its zero-parameter twin: the perimeter table with k = 7 - margin and the same
inputs (raw, symmetry classes, or symmetry+inverse classes), which is the same lookup with the
net replaced by a constant.

The full-3x3 table (results/table_full3x3.md) sets each corner floor's bytes against its node
count inside a full-cube search (with the two 6-edge tables), and marks the floors that no other
floor beats on both bytes and nodes: the frontier.
"""

import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, "results")
FULL = 44_089_920

LABEL = {
    "full_4bit": "8-corner table, 4 bits (the truth)",
    "full_mod3": "8-corner table, 2 bits (mod 3)",
    "symplain": "symmetry-reduced table, 4 bits",
    "symplain_mod3": "symmetry-reduced table, 2 bits (mod 3)",
    "syminv": "symmetry+inverse-reduced table, 4 bits",
    "syminv_mod3": "symmetry+inverse-reduced table, 2 bits (mod 3)",
    "k3": "3-corner table", "k4": "4-corner table", "k4x2": "max of two 4-corner tables",
    "k5": "5-corner table", "k5x2": "max of two 5-corner tables",
    "k6": "6-corner table", "k6x2": "max of two 6-corner tables",
}
for _k in (5, 6, 7):
    LABEL[f"perim{_k}"] = f"perimeter table: exact to distance {_k}, {_k + 1} beyond"
    LABEL[f"perim{_k}sym"] = f"perimeter table over symmetry classes: exact to {_k}, {_k + 1} beyond"
    LABEL[f"perim{_k}inv"] = f"perimeter table over symmetry+inverse classes: exact to {_k}, {_k + 1} beyond"
NETS = {
    "raw512": "raw MLP 512-256-128 (2 epochs)",
    "sym512e30": "sym MLP 512-256-128 (30 epochs)",
    "sym512": "sym MLP 512-256-128 (100 epochs)",
    "sym256": "sym MLP 256-128-64 (100 epochs)",
    "sym512e30inv": "sym+inv MLP 512-256-128 (30 epochs)",
    "sym512inv": "sym+inv MLP 512-256-128 (100 epochs)",
    "sym256inv": "sym+inv MLP 256-128-64 (100 epochs)",
}
TWIN_SUFFIX = {"raw": "", "symmetry class": "sym", "symmetry+inverse class": "inv"}
# floors holding the same values as one that was searched, so they search identically
SAME3 = {"full_4bit": "exact", "full_mod3": "exact", "symplain": "exact", "symplain_mod3": "exact",
         "syminv": "exact", "syminv_mod3": "exact"}
for _k in (5, 6, 7):
    SAME3[f"perim{_k}sym"] = SAME3[f"perim{_k}inv"] = f"perim{_k}"
# mod-3 tables hold the same values as their 4-bit versions, so they search identically
SAME_SEARCH = {"full_4bit": "exact", "full_mod3": "exact", "symplain_mod3": "symplain", "syminv_mod3": "syminv"}


def main():
    plain = json.load(open(os.path.join(RES, "plain_tables.json")))["floors"]
    search = json.load(open(os.path.join(RES, "search.json")))
    rows = []
    for name, f in plain.items():
        s = search[SAME_SEARCH.get(name, name)]
        rows.append({"floor": name, "label": LABEL[name], "kind": "plain", "bytes": f["bytes"],
                     "mean_floor": f["mean_floor"], "exact_fraction": f["exact_fraction"],
                     "nodes": s["total_nodes"], "violations": s["violations"]})
    for name, f in json.load(open(os.path.join(RES, "perimeter.json"))).items():
        s = search[name]
        rows.append({"floor": name, "label": LABEL[name], "kind": "plain", "bytes": f["bytes"],
                     "entries": f["entries"], "mean_floor": f["mean_floor"], "exact_fraction": f["exact_fraction"],
                     "nodes": s["total_nodes"], "violations": s["violations"]})
    inverse = json.load(open(os.path.join(RES, "inverse.json")))
    for name, f in inverse["perimeter"].items():
        s = search[name]
        rows.append({"floor": name, "label": LABEL[name], "kind": "plain", "bytes": f["bytes"],
                     "entries": f["entries"], "mean_floor": f["mean_floor"], "exact_fraction": f["exact_fraction"],
                     "nodes": s["total_nodes"], "violations": s["violations"]})
    for net, f in inverse["nets"].items():
        base = json.load(open(os.path.join(RES, f"verify_{net[:-3]}.json")))
        for m, r in f["margins"].items():
            name = f"{net}_int8_m{m}"
            s = search[name]
            rows.append({
                "floor": name, "kind": "net", "net": net, "inputs": "symmetry+inverse class",
                "hidden": base["sizes"][1:-1], "params": base["params"], "format": "int8", "margin": int(m),
                "label": f"{NETS.get(net, net)}, int8, margin {m}", "weight_bytes": f["weight_bytes"],
                "corrections": r["corrections"], "correction_bytes": r["correction_bytes_ef"],
                "bytes": r["total_bytes"], "mean_floor": r["mean_floor"], "exact_fraction": r["exact_fraction"],
                "max_floor_minus_truth": r["max_floor_minus_truth"], "nodes": s["total_nodes"],
                "violations": s["violations"]})
    for path in sorted(glob.glob(os.path.join(RES, "verify_*.json"))):
        v = json.load(open(path))
        for kind, fmt in v["formats"].items():
            for m, r in fmt["margins"].items():
                name = f"{v['name']}_{kind}_m{m}"
                if name not in search:
                    continue
                s = search[name]
                rows.append({
                    "floor": name, "kind": "net", "net": v["name"], "inputs": "symmetry class" if v["sym"] else "raw",
                    "hidden": v["sizes"][1:-1], "params": v["params"], "format": kind, "margin": int(m),
                    "label": f"{NETS.get(v['name'], v['name'])}, {kind}, margin {m}",
                    "weight_bytes": fmt["weight_bytes"], "corrections": r["corrections"],
                    "correction_bytes": r["correction_bytes_ef"], "bytes": r["total_bytes"],
                    "mean_floor": r["mean_floor"], "exact_fraction": r["exact_fraction"],
                    "net_over_fraction": r["net_over_fraction"], "max_floor_minus_truth": r["max_floor_minus_truth"],
                    "nodes": s["total_nodes"], "violations": s["violations"]})
    plains = [r for r in rows if r["kind"] == "plain"]
    for r in rows:
        r["times_smaller"] = FULL / r["bytes"]
        if r["kind"] == "net":
            better = [p for p in plains if p["mean_floor"] >= r["mean_floor"] and p["nodes"] <= r["nodes"]]
            best = min(better, key=lambda p: p["bytes"]) if better else None
            r["cheapest_plain_as_strong"] = best["floor"] if best else None
            r["beats_plain_per_byte"] = best is None or best["bytes"] > r["bytes"]
            r["twin"] = f"perim{7 - r['margin']}{TWIN_SUFFIX[r['inputs']]}"
    # full 3x3: corner floors inside a search with the two 6-edge tables
    full = {}
    for path in sorted(glob.glob(os.path.join(RES, "search3*.json"))):
        full.update({k: v for k, v in json.load(open(path)).items() if k != "scrambles"})
    for r in rows:
        s3 = full.get(SAME3.get(r["floor"], r["floor"]))
        if s3:
            r["full_cube_nodes"] = s3["total_nodes"]
            r["full_cube_violations"] = s3["violations"]
            r["full_cube_seconds"] = s3["seconds"]
    edges_only = {"floor": "edges_only", "label": "no corner floor (the two edge tables alone)", "kind": "plain",
                  "bytes": 0, "mean_floor": 0.0, "nodes": None, "full_cube_nodes": full["edges_only"]["total_nodes"],
                  "full_cube_seconds": full["edges_only"]["seconds"]}
    in3 = [r for r in rows if "full_cube_nodes" in r] + [edges_only]
    for r in in3:
        r["frontier"] = not any(o["bytes"] <= r["bytes"] and o["full_cube_nodes"] <= r["full_cube_nodes"] and
                                (o["bytes"], o["full_cube_nodes"]) != (r["bytes"], r["full_cube_nodes"]) for o in in3)

    order = list(NETS)
    rows.sort(key=lambda r: (r["kind"] != "plain", order.index(r["net"]) if r.get("net") in order else 99,
                             r.get("format", ""), r.get("margin", 0), -r["bytes"]))
    json.dump({"rows": rows, "edges_only": edges_only, "scrambles": search["scrambles"]},
              open(os.path.join(RES, "summary.json"), "w"), indent=1)

    def table(rows):
        lines = ["| floor | bytes (net: weights + corrections) | vs 44 MB | mean floor | exact | IDA* nodes, 50 scrambles "
                 "| cheapest plain table as strong | smaller than it? |",
                 "|---|---:|---:|---:|---:|---:|---|---|"]
        for r in rows:
            extra, win = "", ""
            if r["kind"] == "net":
                win = "yes" if r["beats_plain_per_byte"] else "no"
                b = r["cheapest_plain_as_strong"]
                extra = f"{LABEL[b]} ({next(p['bytes'] for p in plains if p['floor'] == b):,})" if b else "none"
                size = f"{r['bytes']:,} ({r['weight_bytes']:,} + {r['correction_bytes']:,})"
            else:
                size = f"{r['bytes']:,}"
            lines.append(f"| {r['label']} | {size} | {r['times_smaller']:.0f}× | {r['mean_floor']:.3f} | "
                         f"{100 * r['exact_fraction']:.1f}% | {r['nodes']:,} | {extra} | {win} |")
        return "\n".join(lines) + "\n"

    by_name = {r["floor"]: r for r in rows}

    def plain_table(rows):
        lines = ["| floor | bytes | vs 44 MB | mean floor | exact | IDA* nodes, 50 scrambles |",
                 "|---|---:|---:|---:|---:|---:|"]
        for r in sorted(rows, key=lambda r: -r["bytes"]):
            lines.append(f"| {r['label']} | {r['bytes']:,} | {r['times_smaller']:.0f}× | {r['mean_floor']:.3f} | "
                         f"{100 * r['exact_fraction']:.1f}% | {r['nodes']:,} |")
        return "\n".join(lines) + "\n"

    def twin_table(rows):
        lines = ["| net (int8) | margin | bytes: weights + corrections | mean floor | IDA* nodes "
                 "| twin: perimeter k | twin bytes | twin mean floor | twin nodes |",
                 "|---|---:|---:|---:|---:|---:|---:|---:|---:|"]
        for r in rows:
            t = by_name[r["twin"]]
            lines.append(f"| {NETS.get(r['net'], r['net'])} | {r['margin']} | {r['bytes']:,} = {r['weight_bytes']:,} + "
                         f"{r['correction_bytes']:,} | {r['mean_floor']:.3f} | {r['nodes']:,} | "
                         f"{7 - r['margin']}{dict(sym=' (sym)', inv=' (sym+inv)').get(r['twin'][6:], '')} | {t['bytes']:,} | "
                         f"{t['mean_floor']:.3f} | {t['nodes']:,} |")
        return "\n".join(lines) + "\n"

    def full_table(rows):
        lines = ["| corner floor | corner bytes | mean corner floor | full-3×3 nodes, 50 scrambles | vs exact | seconds "
                 "| frontier |",
                 "|---|---:|---:|---:|---:|---:|---|"]
        ex = full["exact"]["total_nodes"]
        for r in sorted(rows, key=lambda r: (r["bytes"], r["full_cube_nodes"])):
            lines.append(f"| {r['label']} | {r['bytes']:,} | {r['mean_floor']:.3f} | {r['full_cube_nodes']:,} | "
                         f"{r['full_cube_nodes'] / ex:.2f}× | {r['full_cube_seconds']:.0f} | "
                         f"{'**yes**' if r['frontier'] else ''} |")
        return "\n".join(lines) + "\n"

    full_md = full_table([r for r in in3 if r["kind"] == "plain" or r.get("format") == "int8"])
    open(os.path.join(RES, "table_full3x3.md"), "w").write(full_md)
    print(full_md)
    open(os.path.join(RES, "table.md"), "w").write(table(rows))
    plains_md = plain_table(plains)
    twins_md = twin_table([r for r in rows if r["kind"] == "net" and r["format"] == "int8"])
    open(os.path.join(RES, "table_plain.md"), "w").write(plains_md)
    open(os.path.join(RES, "table_nets.md"), "w").write(twins_md)
    print(plains_md)
    print(twins_md)


if __name__ == "__main__":
    main()
