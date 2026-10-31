# Findings: testing a guaranteed-optimal solver on the 2×2

Every number below was checked against the exact distance of all 3,674,160 positions (half-turn metric unless noted). Benchmark: 1,000 positions drawn uniformly at random (true mean 8.75 moves).

## The framework

A **ceiling** is a solution you found; anything may propose it. A **floor** is a number that is never higher than the true answer. When the floor meets the ceiling, the answer is proven optimal. The prover (IDA*) raises the floor until it does. Across all tests, every certificate matched the truth table: 1,000 of 1,000, for every admissible floor.

## 1. Truth, entropy, symmetry

- Distances match the published counts exactly: God's number 11 (half turns) and 14 (quarter turns).
- 68.4% of positions are 9 or 10 moves out; the mean is 8.76. The rim is where all the work is.
- Counting move sequences proves God's number ≥ 9 (true value 11).
- Scramble length is a poor label: after 8 random moves, 42% of positions are closer than 8; after 11 or more, essentially all are.
- Inverse and the 120° rotation about the URF–DBL axis preserve distance on every position. Together they make the exact table 6× smaller (613,058 classes) with no loss.

## 2. Floors from group theory

- 121 floors (twists only, permutation only, every subset of 1–5 tracked corners): none is ever too high.
- Each equals the smallest true distance among positions it cannot tell apart, as the coset argument predicts. Verified for all of them.
- Best collection per memory budget (4 bits per entry): 2 KB → mean 4.84; 20 KB → 5.93; 100 KB → 6.77; 400 KB → 7.69.
- The symmetry-reduced exact table is ~300 KB, so on the 2×2 symmetry beats partial floors. The 3×3 cannot afford an exact table, so partial floors are where the work is.
- The 2×2 table is essentially Korf's 3×3 corner table (mean 8.756 vs 8.764).

## 3. The prover

| Floor | Optimal | Mean nodes |
|---|---|---|
| None (blind, counted) | – | 18,139,852 to prove a 10-move answer |
| Twists only | 100% | 214,344 |
| Permutation only | 100% | 90,238 |
| Best tables, 2 KB | 100% | 18,609 |
| Best tables, 20 KB | 100% | 2,319 |
| Best tables, 100 KB | 100% | 627 |
| Best tables, 400 KB | 100% | 162 |
| Net C + correction table (268 KB) | 100% | 372 |
| Net E + correction table (57 KB) | 100% | 8,332 |
| Net E + corrections, max with 20 KB tables | 100% | 1,690 |
| Net A (scramble labels), no guarantee | 19.7% | gave up on 8.7% |
| Net B (collapsed), no guarantee | 0.3% | gave up on 99.7% |
| Net C alone, no guarantee | 8.7% | gave up on 91.3% |

Each extra move of average floor cuts the work roughly 5× (branching factor is 6), though how evenly the floor is spread matters too. Heuristics that can be too high (nodes capped at 20,000 per position) made exact search blow up.

## 4. Neural networks

| Network | Inputs | Labels | Too high on | Notes |
|---|---|---|---|---|
| A | scrambles | scramble length | 68.3% | learns the neck, overestimates the rim |
| B | uniform | true distance | 31.4% | collapsed: guesses ~8.7 for every position |
| C | uniform | true, overestimates ×30 | 1.47% | 54,131 corrections → 268 KB total |
| D | scrambles | true distance | 9.4% | learns the neck; flattens at ~7.8 on the rim |
| E | scrambles | true, overestimates ×30 | 0.04% | 1,415 corrections → 57 KB total |

- Uniform sampling shows a network positions within 3 moves 0.01% of the time; scrambles do 27% of the time. Entropy starves the narrow neck of the funnel, and B never learned it.
- B slid into the flat valley of its own loss ("predict the average"), the local-minimum problem from gradient descent, seen directly.
- With correction tables, neural floors are exact. Per byte they still lose to group-theory tables on the 2×2, mainly because they are weakest at the rim, where most positions are.

## 5. Gravity

- The true distance has zero false valleys: rolling downhill solves 100% of positions optimally.
- Floors are bad landscapes: a floor from part of the cube has a fake bottom where that part is solved. Pure rolling reached solved 0–18% of the time.
- Network D has false valleys at only 4.6% of positions, yet they caught most balls (4.2% reached solved).
- Heat (simulated annealing) helps imperfect landscapes (400 KB floor: 18% → 37%), hurts the perfect one (100% → 82%), and proves nothing.

## 6. The full framework (ceiling from network D, floor from 400 KB tables, IDA*)

- Beam search guided by D (width 64) found a solution for 66.9% of positions and the optimal one for 58.4%. Guided by B: 2%.
- 26.5% of positions were certified with zero search: the floor already equalled the network's ceiling.
- Mean prover work fell from 162 to 123 nodes (−24%), because a ceiling lets the prover skip its last pass.
- All 1,000 certificates matched the truth table.

## 7. Exhaustive check: the prover on every position

IDA* with the 400 KB group-theory floor was run on all 3,674,160 positions (`exp6_exhaustive.py`):

- Every solution was replayed move by move and solved its position.
- Every solution length equalled the truth table: 0 mismatches. The length counts reproduce the published distribution exactly.
- Work: 607 million nodes in total, 165 per position on average, 15,375 at most; 97 seconds on 2 cores.

So the scalable method (a floor that is never too high, plus IDA*) solves the entire 2×2 optimally in the half-turn metric. Positions are counted with whole-cube rotations folded in; each of the 24 orientations solves the same way with relabelled moves.

## What this says

1. Proof comes from floors, and group theory gives floors that are provably never too high and scale through cosets and symmetry.
2. AI earns its place as a ceiling finder, and only with the right data: scrambles for coverage, true or value-iterated labels for correctness.
3. AI can also compress floors, but only with a correction table, and today it is weakest exactly where floors matter most.
4. Anything that can be too high is worse than useless inside an exact prover.

## Next experiments

- Neural floors that are strong at the rim: longer training, larger networks, a cross-entropy admissibility loss, symmetry-aware inputs, the group's Fourier basis (Pan & Kondor).
- Value-iteration labels instead of table labels, since bigger cubes have no table.
- 3×3: the 2×2 table becomes the corner floor, plus edge floors, 48-way symmetry, compressed floors with corrections, Kociemba or a learned beam for ceilings, IDA* in a web worker.
- Bigger cubes: one floor per orbit (corners, edges, centres), learned ceilings, and the gap shown honestly.

## 8. Anatomy of an optimal solve (exp7, exp8)

Same 1,000 random positions. Where IDA*'s work goes, and three levers measured against it.

- **The last round is most of the work:** 54% (20 KB floor) to 75% (400 KB) of all lookups happen in the final round, the one that *finds* the solution. The rounds before it are the *proof* that nothing shorter exists.
- **Most lookups are wasted:** 81–83% of positions generated are cut on arrival (g + h > bound), three quarters of them under a parent sitting exactly on the bound, where only moves that lower the floor can survive.
- **Mirror (inverse) lookups are free strength:** max(h(x), h(x⁻¹)) is still never too high. Mean work: twists only 214,344 → 38,749; 2 KB 18,609 → 12,480; 20 KB 2,319 → 1,766; 100 KB 627 → 380; 400 KB 162 → 84. Places only is unchanged (a permutation and its inverse are equally far in the place puzzle). The perfect floor needs 32.
- **Doors home:** 33.9% of all positions have exactly one shortest solution. Median count of shortest solutions by distance: 1 up to 8 moves, 2 at 9, 11 at 10, 55 at 11 (max 196).
- **Compass (best-first ordering of children) changes speed, never the answer:** with the 20 KB + inverse floor, ordering by the floor or by network D gives nothing (1,787 → 1,791 / 1,782 lookups), but ordering by the true distance shrinks the last round from 969 to 55 lookups and halves the total (873). With the 400 KB + inverse floor the room is smaller (107 → 80). A compass may be wrong without breaking optimality, so it is a safe place for a learned model; the current models do not rank siblings well.
