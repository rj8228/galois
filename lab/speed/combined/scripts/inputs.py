"""Write data/in-<set>.txt: "D scramble" per line, D from lab/3x3's desktop-set benchmark (0 = unknown)."""
import json, pathlib
here = pathlib.Path(__file__).resolve().parent.parent
lab = here.parent.parent / "3x3" / "results"
(here / "data").mkdir(exist_ok=True)
for s in ["moves-14", "moves-16", "random-state"]:
    sv = json.load(open(lab / f"bench-{s}.json"))["floors"]["C8s+P1x3i"]["solves"]
    sv.sort(key=lambda r: r["index"])
    with open(here / "data" / f"in-{s}.txt", "w") as f:
        for r in sv:
            f.write(f"{r['length'] if r['length'] > 0 and not r['dnf'] else 0} {r['scramble']}\n")
    print(s, len(sv), sorted(set(r["length"] for r in sv)))
