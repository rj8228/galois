"""The 3x3 corners as a permutation group, with coordinates, move tables and the 48 symmetries.

Slots and corners use Kociemba's labels in the order of src/solver/cube2.ts:
URF UFL ULB UBR DFR DLF DBL DRB. A state is (cp, co): slot i holds corner cp[i], twisted co[i].
All 18 face turns act on the corners; nothing is held still, so this is the 8-corner table
of the 3x3 (8! * 3^7 = 88,179,840 positions), not the 2x2 solver's DBL-fixed group.

Index = perm_rank(cp) * 2187 + twist(co), twist = base-3 number of co[0..6] (co[7] follows).
"""

import numpy as np
from numba import njit

N_PERM = 40320
N_TWIST = 2187
N_STATES = N_PERM * N_TWIST  # 88,179,840
N_MOVES = 18
MOVE_NAMES = [f + s for f in "URFDLB" for s in ("", "2", "'")]

BASE = {
    "U": ([3, 0, 1, 2, 4, 5, 6, 7], [0, 0, 0, 0, 0, 0, 0, 0]),
    "R": ([4, 1, 2, 0, 7, 5, 6, 3], [2, 0, 0, 1, 1, 0, 0, 2]),
    "F": ([1, 5, 2, 3, 0, 4, 6, 7], [1, 2, 0, 0, 2, 1, 0, 0]),
    "D": ([0, 1, 2, 3, 5, 6, 7, 4], [0, 0, 0, 0, 0, 0, 0, 0]),
    "L": ([0, 2, 6, 3, 4, 1, 5, 7], [0, 1, 2, 0, 0, 2, 1, 0]),
    "B": ([0, 1, 3, 7, 4, 5, 2, 6], [0, 0, 1, 2, 0, 0, 2, 1]),
}


@njit(cache=True)
def mul(acp, aco, bcp, bco, ocp, oco):
    """a, then b (Kociemba's corner multiply). co >= 3 marks a mirrored corner."""
    for i in range(8):
        ocp[i] = acp[bcp[i]]
        oa = aco[bcp[i]]
        ob = bco[i]
        if oa < 3 and ob < 3:
            o = (oa + ob) % 3
        elif oa < 3:
            o = oa + ob
            if o >= 6:
                o -= 3
        elif ob < 3:
            o = oa - ob
            if o < 3:
                o += 3
        else:
            o = oa - ob
            if o < 0:
                o += 3
        oco[i] = o


def mul_py(a, b):
    ocp = np.zeros(8, np.int64)
    oco = np.zeros(8, np.int64)
    mul(np.asarray(a[0], np.int64), np.asarray(a[1], np.int64),
        np.asarray(b[0], np.int64), np.asarray(b[1], np.int64), ocp, oco)
    return ocp, oco


IDENT = (np.arange(8, dtype=np.int64), np.zeros(8, np.int64))


def move_cubies():
    """18 x (cp, co) for U U2 U' R ... B'."""
    cps = np.zeros((18, 8), np.int64)
    cos = np.zeros((18, 8), np.int64)
    k = 0
    for f in "URFDLB":
        m = (np.array(BASE[f][0]), np.array(BASE[f][1]))
        cur = m
        for _ in range(3):
            cps[k], cos[k] = cur
            cur = mul_py(cur, m)
            k += 1
    return cps, cos


@njit(cache=True)
def perm_rank(cp):
    r = 0
    for i in range(8):
        c = 0
        for j in range(i + 1, 8):
            if cp[j] < cp[i]:
                c += 1
        r = r * (8 - i) + c
    return r


@njit(cache=True)
def perm_unrank(r, cp):
    lehmer = np.zeros(8, np.int64)
    for i in range(7, -1, -1):
        lehmer[i] = r % (8 - i)
        r //= 8 - i
    used = np.zeros(8, np.bool_)
    for i in range(8):
        c = lehmer[i]
        for v in range(8):
            if not used[v]:
                if c == 0:
                    cp[i] = v
                    used[v] = True
                    break
                c -= 1


@njit(cache=True)
def twist_coord(co):
    t = 0
    for i in range(7):
        t = t * 3 + co[i]
    return t


@njit(cache=True)
def twist_uncoord(t, co):
    s = 0
    for i in range(6, -1, -1):
        co[i] = t % 3
        s += co[i]
        t //= 3
    co[7] = (3 - s % 3) % 3


@njit(cache=True)
def decode(idx, cp, co):
    perm_unrank(idx // 2187, cp)
    twist_uncoord(idx % 2187, co)


@njit(cache=True)
def encode(cp, co):
    return perm_rank(cp) * 2187 + twist_coord(co)


@njit(cache=True)
def _move_tables(mcp, mco):
    pm = np.zeros((40320, 18), np.int32)
    tm = np.zeros((2187, 18), np.int32)
    cp = np.zeros(8, np.int64)
    co = np.zeros(8, np.int64)
    ocp = np.zeros(8, np.int64)
    oco = np.zeros(8, np.int64)
    z = np.zeros(8, np.int64)
    for p in range(40320):
        perm_unrank(p, cp)
        for m in range(18):
            mul(cp, z, mcp[m], mco[m], ocp, oco)
            pm[p, m] = perm_rank(ocp)
    ident = np.arange(8)
    for t in range(2187):
        twist_uncoord(t, co)
        for m in range(18):
            mul(ident, co, mcp[m], mco[m], ocp, oco)
            tm[t, m] = twist_coord(oco)
    return pm, tm


def move_tables():
    mcp, mco = move_cubies()
    return _move_tables(mcp, mco)


# ---------------------------------------------------------------- symmetries
def symmetries():
    """The 48 cube symmetries as corner cubies (co 3..5 = mirrored), and their inverses."""
    # Kociemba's basic symmetries, in corner order URF UFL ULB UBR DFR DLF DBL DRB.
    URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB = range(8)
    urf3 = (np.array([URF, DFR, DLF, UFL, UBR, DRB, DBL, ULB]), np.array([1, 2, 1, 2, 2, 1, 2, 1]))
    f2 = (np.array([DLF, DFR, DRB, DBL, UFL, URF, UBR, ULB]), np.zeros(8, np.int64))
    u4 = (np.array([UBR, URF, UFL, ULB, DRB, DFR, DLF, DBL]), np.zeros(8, np.int64))
    lr2 = (np.array([UFL, URF, UBR, ULB, DLF, DFR, DRB, DBL]), np.full(8, 3))
    syms = []
    a = IDENT
    for _ in range(3):
        b = a
        for _ in range(2):
            c = b
            for _ in range(4):
                d = c
                for _ in range(2):
                    syms.append(d)
                    d = mul_py(d, lr2)
                c = mul_py(c, u4)
            b = mul_py(b, f2)
        a = mul_py(a, urf3)
    scp = np.array([s[0] for s in syms])
    sco = np.array([s[1] for s in syms])
    icp = np.zeros_like(scp)
    ico = np.zeros_like(sco)
    for k in range(48):
        for j in range(48):
            p = mul_py((scp[k], sco[k]), (scp[j], sco[j]))
            if np.array_equal(p[0], IDENT[0]) and np.array_equal(p[1], IDENT[1]):
                icp[k], ico[k] = scp[j], sco[j]
                break
        else:
            raise RuntimeError("no inverse")
    return scp, sco, icp, ico


@njit(cache=True)
def conj(cp, co, s, scp, sco, icp, ico, t1cp, t1co, ocp, oco):
    """S^-1 * c * S."""
    mul(icp[s], ico[s], cp, co, t1cp, t1co)
    mul(t1cp, t1co, scp[s], sco[s], ocp, oco)


@njit(cache=True)
def canon_index(idx, scp, sco, icp, ico):
    """Smallest index among the 48 conjugates of state idx (its symmetry-class representative)."""
    cp = np.zeros(8, np.int64)
    co = np.zeros(8, np.int64)
    a = np.zeros(8, np.int64)
    b = np.zeros(8, np.int64)
    ocp = np.zeros(8, np.int64)
    oco = np.zeros(8, np.int64)
    decode(idx, cp, co)
    best = idx
    for s in range(1, 48):
        conj(cp, co, s, scp, sco, icp, ico, a, b, ocp, oco)
        v = encode(ocp, oco)
        if v < best:
            best = v
    return best


@njit(cache=True)
def inverse_index(idx):
    """The index of the inverse position, which is the same distance from solved."""
    cp = np.zeros(8, np.int64)
    co = np.zeros(8, np.int64)
    a = np.zeros(8, np.int64)
    b = np.zeros(8, np.int64)
    decode(idx, cp, co)
    for i in range(8):
        a[cp[i]] = i
        b[cp[i]] = (3 - co[i]) % 3
    return encode(a, b)


@njit(cache=True)
def canon_inv_index(idx, scp, sco, icp, ico):
    """Representative under the 48 symmetries and inversion: the smaller of the two class reps."""
    a = canon_index(idx, scp, sco, icp, ico)
    b = canon_index(inverse_index(idx), scp, sco, icp, ico)
    return a if a < b else b
