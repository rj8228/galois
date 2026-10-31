"""Search routines shared by the later experiments: rolling, beam search, and IDA*."""
import math

from cube2 import NO


class GaveUp(Exception):
    pass


def roll(c, h, s, rng, heat=False, steps=300):
    """Steepest descent (ties random). With heat: Metropolis moves under a cooling temperature.
    Returns the loop-free number of moves to solved, or None if the ball gets stuck."""
    path = [s]
    for t in range(steps):
        if s == 0:
            break
        p, o = divmod(s, NO)
        nb = [c.pm[p][j] * NO + c.om[o][j] for j in range(c.nm)]
        if heat:
            T = 1.5 * (1 - t / steps) + 0.05
            cand = nb[rng.integers(c.nm)]
            dlt = float(h[cand]) - float(h[s])
            if dlt <= 0 or rng.random() < math.exp(-dlt / T):
                s = cand
        else:
            vals = [h[x] for x in nb]
            m = min(vals)
            if m >= h[s]:
                break
            s = nb[rng.choice([i for i, v in enumerate(vals) if v == m])]
        path.append(s)
    if s != 0:
        return None
    seen, clean = {}, []
    for x in path:
        if x in seen:
            clean = clean[:seen[x] + 1]
            seen = {y: i for i, y in enumerate(clean)}
        else:
            seen[x] = len(clean)
            clean.append(x)
    return len(clean) - 1


def beam(c, s0, h, width=64, maxdepth=20):
    """Network-guided beam search: keep the `width` best-looking positions at each depth."""
    if s0 == 0:
        return 0
    layer = {s0: -1}
    for depth in range(1, maxdepth + 1):
        nxt = {}
        for s, lastface in layer.items():
            p, o = divmod(s, NO)
            for j in range(c.nm):
                if c.faces[j] == lastface:
                    continue
                t = c.pm[p][j] * NO + c.om[o][j]
                if t == 0:
                    return depth
                nxt.setdefault(t, c.faces[j])
        keep = sorted(nxt, key=lambda t: h[t])[:width]
        layer = {t: nxt[t] for t in keep}
    return None


def ida(c, s0, h, cap=None, ceiling=None):
    """IDA*. With a ceiling, stop once the bound reaches it: every shorter length is then ruled out,
    so the ceiling is proven optimal without searching for it again. Returns (length, nodes, bounds)."""
    faces, pm, om, nm = c.faces, c.pm, c.om, c.nm
    path, bounds = [], []
    nodes = 0
    FOUND = -1

    def dfs(s, g, bound, lastface):
        nonlocal nodes
        nodes += 1
        if cap and nodes > cap:
            raise GaveUp
        f = g + h[s]
        if f > bound:
            return f
        if s == 0:
            return FOUND
        best = 99
        p, o = divmod(s, NO)
        pp, oo = pm[p], om[o]
        for j in range(nm):
            if faces[j] == lastface:
                continue
            path.append(j)
            r = dfs(pp[j] * NO + oo[j], g + 1, bound, faces[j])
            if r == FOUND:
                return FOUND
            path.pop()
            if r < best:
                best = r
        return best

    bound = h[s0]
    while True:
        if ceiling is not None and bound >= ceiling:
            return ceiling, nodes, bounds
        bounds.append(bound)
        r = dfs(s0, 0, bound, -1)
        if r == FOUND:
            return len(path), nodes, bounds
        bound = r
