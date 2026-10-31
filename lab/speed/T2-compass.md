# T2 Compass: learned move ordering for the final round

**Branch** `speed-compass` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/compass/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules, baseline numbers and result format.

## Why

In IDA\*'s final round, the search stops at the first solution it reaches. The order in which a node's children are tried changes how soon that happens. It never changes which positions are proven or which length is returned. So a compass can be wrong without breaking optimality, which makes it a safe place for a learned model.

How much a compass can win, measured with `lab/2x2/exp8_doors_and_compass.py` (exp8 counting, 1,000 benchmark positions):

| Floor | Move order | Floor first | Network D first | True distance first (perfect) |
|---|--:|--:|--:|--:|
| 20 KB + mirror | 1,787 (final round 969) | 1,791 | 1,782 | 873 (final round 55) |
| 400 KB + mirror | 107 (final round 82) | 113 | 108 | 80 (final round 55) |

The cheap orders win nothing. The perfect order halves the work at 20 KB. Network D was trained to guess distances, not to rank siblings, and it is flat far from solved, where most positions are.

## Goal

Build a compass that recovers as much of the perfect order's gain as possible, at a small memory and time cost. Report the **recovered share**: (L_move − L_compass) / (L_move − L_perfect).

## Try at least three compasses, including one that isn't learned

- **Not learned.** Order by:
  - the sum (not the max) of the component floors
  - the mirror floor
  - a second, different floor
  - a two-move look-ahead minimum

  Report how each one's extra reads offset its gain.
- **Learned rankers.** Write them in numpy with hand-written backprop, like `lab/2x2/nets.py`; numba is fine.
  - Inputs: the child position's features (the 70-value one-hot from `cube2.features`), optionally plus its floor values. Symmetry-aware inputs are worth a try.
  - Objective: rank siblings. Use a listwise softmax over a parent's children, where the target is the children one move closer (d(child) = d(parent) − 1). Pairwise logistic loss is an alternative.
  - Training data: sample parents where the search actually spends time. Record the nodes expanded in final rounds of IDA\* over many positions, and mix in uniform positions. Label them with the truth table. Keep the 1,000 benchmark positions out of training.
- **Tiny table compasses.** For example, a small table indexed by an abstraction that stores preferred next moves.

## Evaluate

- Use exp8 counting, with floors 2 KB + mirror, 20 KB + mirror, 100 KB + mirror and 400 KB + mirror, on the 1,000 benchmark positions.
- Report total and final-round lookups, and the recovered share.
- Report model size in bytes, evaluations per solve, and an estimate of time per evaluation (multiply-adds, or measured in a compiled loop). A compass that costs more time than it saves is not a win. Say where the break-even is.
- Every solution must be optimal; check against the truth table.

## Carrying it to the 3×3

Answer this in FINDINGS. The 3×3 has no truth table. What training data and labels would a 3×3 compass use? Positions along optimal solutions found by `lab/3x3`'s solver are one source. How large could the model be inside a browser-speed search?

## Results

`results/frontier.json` rows for every compass × floor, and the trained weights if they are under 5 MB. Otherwise ship a script that retrains them deterministically.

## Done when

- At least three compasses are evaluated on all four floors.
- The best one's recovered share and time cost are stated plainly.
- The 3×3 question is answered.
- The pull request is open into `phase-8-speed-lab`.
