"""A plain table for the gap between the perimeter-7 table and the exact table: a perimeter table
plus one bit per entry of the symmetry+inverse table, set where the distance is 9 or more.

    floor = exact distance            if the position's class is in the perimeter (distance <= k)
            9                         if its bit is set (distance >= 9)
            k + 1                     otherwise (it is beyond the perimeter, so at least k + 1)

The bit table uses the symmetry+inverse table's index (654 permutation classes x 2187 twists,
1,430,298 entries, 178,788 bytes packed), so its bytes include the same 2-byte permutation map.
Each variant is checked on all 88,179,840 positions through search.heur, the code the searches run.
Writes data/syminv_bit9.npy and results/threshold.json.
"""

import json
import os

import numpy as np
from numba import njit, prange

import cube
import nn
import search
import verify

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
T = 9
PERM_MAP = 2 * 40320


@njit(parallel=True, cache=True)
def _floors(out, dist, inv, cot, cls_id, sym_of, inv_of, bits, scp, sco, icp, ico, keys, vals, lo, hi):
    e1 = np.zeros(0, np.int64)
    eu = np.zeros(1, np.uint8)
    ef = np.zeros((1, 1), np.float32)
    ef1 = np.zeros(1, np.float32)
    for p in prange(40320):
        act = np.zeros(16, np.int64)
        for t in range(2187):
            i = p * 2187 + t
            out[i] = search.heur(6, i, 0, dist, inv, cot, e1, eu, e1, eu, cls_id, sym_of, inv_of, bits,
                                 scp, sco, icp, ico, ef, ef1, ef, ef1, ef, ef1, ef, ef1, keys, vals, lo, hi, act)


def main():
    dist = np.load(os.path.join(DATA, "corner.npy"))
    table = np.load(os.path.join(DATA, "syminv.npy"))
    bits = np.packbits(table >= T)  # bit j is (bits[j >> 3] >> (7 - (j & 7))) & 1
    np.save(os.path.join(DATA, f"syminv_bit{T}.npy"), bits)
    cls_id = np.load(os.path.join(DATA, "syminv_cls.npy")).astype(np.int64)
    sym_of = np.load(os.path.join(DATA, "syminv_sym.npy")).astype(np.int64)
    inv_of = np.load(os.path.join(DATA, "syminv_inv.npy")).astype(np.int64)
    inv, cot = nn.coord_tables()
    scp, sco, icp, ico = cube.symmetries()
    out = {"threshold": T, "bit_entries": int(table.size), "bit_bytes": int(bits.size), "perm_map_bytes": PERM_MAP}
    for k in (5, 6, 7):
        c = np.load(os.path.join(DATA, f"corr_perim{k}inv_const_m0.npz"))
        keys, vals = c["keys"].astype(np.int64), c["vals"]
        h = np.zeros(cube.N_STATES, np.uint8)
        _floors(h, dist, inv, cot, cls_id, sym_of, inv_of, bits, scp, sco, icp, ico, keys, vals, k + 1, T)
        assert (h <= dist).all(), "a floor above the truth"
        expect = np.where(dist <= k, dist, np.where(dist >= T, T, k + 1))
        assert np.array_equal(h, expect)
        name = f"perim{k}inv_bit{T}"
        out[name] = {"k": k, "perimeter_bytes": verify.ef_bytes(len(keys)),
                     "bytes": verify.ef_bytes(len(keys)) + int(bits.size) + PERM_MAP,
                     "mean_floor": float(h.mean()), "exact_fraction": float((h == dist).mean()),
                     "max_floor_minus_truth": int((h.astype(np.int64) - dist).max())}
        print(name, out[name], flush=True)
    json.dump(out, open(os.path.join(HERE, "results", "threshold.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
