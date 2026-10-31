"""Random-move scramble sets (seeded, so they are the same on every run) and superflip.

    python3 scripts/make_scrambles.py

Writes scrambles/moves-12.txt, moves-14.txt, moves-16.txt (50 each) and superflip.txt.
Random-state scrambles come from cubing.js instead: node scripts/export-scrambles.mjs.
"""

import pathlib
import random

FACES = "URFDLB"
SUFFIX = ["", "2", "'"]
OUT = pathlib.Path(__file__).resolve().parent.parent / "scrambles"


def scramble(rng: random.Random, n: int) -> str:
    """n random face turns: never the same face twice in a row, and of two opposite faces
    (U/D, R/L, F/B) the lower-numbered one first, the same rule the search uses. So no
    scramble has an obvious cancellation, though some still solve in fewer than n moves."""
    moves, last = [], -1
    while len(moves) < n:
        f = rng.randrange(6)
        if f == last or f + 3 == last:
            continue
        moves.append(FACES[f] + SUFFIX[rng.randrange(3)])
        last = f
    return " ".join(moves)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for n in (12, 14, 16):
        rng = random.Random(f"galois-3x3-moves-{n}")
        lines = [scramble(rng, n) for _ in range(50)]
        (OUT / f"moves-{n}.txt").write_text(f"# 50 scrambles of {n} random moves, seed galois-3x3-moves-{n}\n" + "\n".join(lines) + "\n")
    # Superflip: every edge flipped in place. This 20-move sequence is one of its optimal solutions
    # (Reid 1995 proved it needs 20), so the solver must find a 20-move answer and prove 19 is impossible.
    (OUT / "superflip.txt").write_text("# superflip\nU R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2\n")


if __name__ == "__main__":
    main()
