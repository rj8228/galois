"""The 2x2x2 cube as a permutation group.

Corners only (a 2x2 has nothing else). The DBL corner is held fixed, which removes
whole-cube rotations, so only U, R and F turns are needed. A position is two coordinates:
  perm: which corner sits in each of the 7 movable slots (7! = 5040)
  ori:  how each slot's corner is twisted (3^6 = 729; the 7th twist is forced)
State index = perm * 729 + ori, giving 5040 * 729 = 3,674,160 positions.
"""
import itertools

import numpy as np

# Kociemba's corner order; slots and corners share these labels.
NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB']
BASE = {
    'U': ([3, 0, 1, 2, 4, 5, 6, 7], [0, 0, 0, 0, 0, 0, 0, 0]),
    'R': ([4, 1, 2, 0, 7, 5, 6, 3], [2, 0, 0, 1, 1, 0, 0, 2]),
    'F': ([1, 5, 2, 3, 0, 4, 6, 7], [1, 2, 0, 0, 2, 1, 0, 0]),
}
FACES = ['U', 'R', 'F']
MOV = [0, 1, 2, 3, 4, 5, 7]  # the 7 movable slots (DBL = 6 never moves)
LBL = {c: k for k, c in enumerate(MOV)}
NP, NO = 5040, 729
N = NP * NO
PERMS = list(itertools.permutations(range(7)))
PERM_INDEX = {p: i for i, p in enumerate(PERMS)}


def compose(a, b):
    """Position a followed by move b: slot i receives the corner that was in slot b.cp[i]."""
    acp, aco = a
    bcp, bco = b
    return [acp[bcp[i]] for i in range(8)], [(aco[bcp[i]] + bco[i]) % 3 for i in range(8)]


def build_moves(metric='htm'):
    """HTM: 90 and 180 degree turns each count 1 (9 moves). QTM: only 90 degree turns (6 moves)."""
    moves, names, faces = [], [], []
    for fi, f in enumerate(FACES):
        m1 = BASE[f]
        m2 = compose(m1, m1)
        m3 = compose(m2, m1)
        powers = [(m1, ''), (m2, '2'), (m3, "'")] if metric == 'htm' else [(m1, ''), (m3, "'")]
        for m, suffix in powers:
            moves.append(m)
            names.append(f + suffix)
            faces.append(fi)
    return moves, names, faces


def ori_digits(o):
    d = [(o // 3**k) % 3 for k in range(6)]
    d.append((-sum(d)) % 3)
    return d  # twist per movable slot, in MOV order


def ori_index_from_co(co):
    assert co[6] == 0 and sum(co) % 3 == 0
    return sum(co[MOV[k]] * 3**k for k in range(6))


def coord_tables(moves):
    nm = len(moves)
    pmove = np.zeros((NP, nm), np.int32)
    for i, p in enumerate(PERMS):
        cp = list(range(8))
        for k in range(7):
            cp[MOV[k]] = MOV[p[k]]
        for j, m in enumerate(moves):
            ncp, _ = compose((cp, [0] * 8), m)
            pmove[i, j] = PERM_INDEX[tuple(LBL[ncp[MOV[k]]] for k in range(7))]
    omove = np.zeros((NO, nm), np.int32)
    for o in range(NO):
        co = [0] * 8
        for k, t in enumerate(ori_digits(o)):
            co[MOV[k]] = t
        for j, m in enumerate(moves):
            _, nco = compose((list(range(8)), co), m)
            omove[o, j] = ori_index_from_co(nco)
    return pmove, omove


class Cube2:
    def __init__(self, metric='htm'):
        self.metric = metric
        self.moves, self.names, self.faces = build_moves(metric)
        self.nm = len(self.moves)
        self.pmove, self.omove = coord_tables(self.moves)
        self.P7 = np.array(PERMS, np.int8)  # corner (0..6) in each movable slot
        self.O7 = np.array([ori_digits(o) for o in range(NO)], np.int8)  # twist per slot
        # Plain Python copies for the search inner loop.
        self.pm = self.pmove.tolist()
        self.om = self.omove.tolist()

    def nb(self, s, j):
        """Neighbour of state(s) s under move j (vectorised)."""
        return self.pmove[s // NO, j].astype(np.int64) * NO + self.omove[s % NO, j]

    def bfs(self):
        """Exact distance of every position from solved, plus a BFS parent tree."""
        dist = np.full(N, -1, np.int8)
        parent = np.full(N, -1, np.int64)
        pmv = np.full(N, -1, np.int8)
        dist[0] = 0
        frontier = np.array([0], np.int64)
        levels = [frontier]
        d = 0
        while True:
            new = []
            for j in range(self.nm):
                nb = self.nb(frontier, j)
                mask = dist[nb] == -1
                u, idx = np.unique(nb[mask], return_index=True)
                if u.size:
                    dist[u] = d + 1
                    parent[u] = frontier[mask][idx]
                    pmv[u] = j
                    new.append(u)
            if not new:
                break
            frontier = np.concatenate(new)
            levels.append(frontier)
            d += 1
        return dist, parent, pmv, levels

    def decode(self, s):
        """Corner in each slot, and twist in each slot, for an array of states."""
        return self.P7[s // NO], self.O7[s % NO]

    def locate(self, s):
        """Slot of each corner and that corner's twist, for an array of states."""
        perm, ori = self.decode(s)
        n = len(s)
        loc = np.empty((n, 7), np.int8)
        rows = np.arange(n)[:, None]
        loc[rows, perm] = np.arange(7, dtype=np.int8)[None, :]
        cori = ori[rows, loc]
        return loc, cori

    def inverse(self, s):
        """Index of the inverse group element for each state."""
        perm, ori = self.decode(s)
        n = len(s)
        rows = np.arange(n)[:, None]
        ip = np.empty((n, 7), np.int64)
        ip[rows, perm] = np.arange(7)[None, :]
        io = np.empty((n, 7), np.int64)
        io[rows, perm] = (-ori.astype(np.int64)) % 3
        return self.perm_rank(ip) * NO + (io[:, :6] * (3 ** np.arange(6))).sum(1)

    _rank_lut = None

    def perm_rank(self, perms):
        if Cube2._rank_lut is None:
            lut = np.full(7**7, -1, np.int64)
            codes = (self.P7.astype(np.int64) * (7 ** np.arange(7))).sum(1)
            lut[codes] = np.arange(NP)
            Cube2._rank_lut = lut
        return Cube2._rank_lut[(perms.astype(np.int64) * (7 ** np.arange(7))).sum(1)]

    def slot_moves(self):
        """For each move: where a corner in movable slot k goes, and the twist it picks up."""
        newpos = np.zeros((self.nm, 7), np.int64)
        addori = np.zeros((self.nm, 7), np.int64)
        for j, (mcp, mco) in enumerate(self.moves):
            for i in range(8):
                src = mcp[i]
                if src == 6:
                    continue
                newpos[j, LBL[src]] = LBL[i]
                addori[j, LBL[src]] = mco[i]
        return newpos, addori

    def features(self, s):
        """One-hot input for a network: for each slot, which corner (7) and its twist (3)."""
        perm, ori = self.decode(s)
        n = len(s)
        x = np.zeros((n, 70), np.float32)
        rows = np.arange(n)[:, None]
        base = np.arange(7)[None, :] * 10
        x[rows, base + perm] = 1
        x[rows, base + 7 + ori] = 1
        return x
