# T1 Search atlas: a dataset of where the optimal solver spends its time

**Branch** `speed-atlas` from `origin/phase-8-speed-lab` · **Folder** `lab/speed/atlas/` · **Pull request into** `phase-8-speed-lab`

Read [README.md](README.md) first: it has the shared rules, baseline numbers and result format.

## Why

The other tasks each attack one part of the work: the proof rounds, the final round, or reads that are cut on arrival. This task builds the map they aim at. For every one of the 3,674,160 2×2 positions, it records how the optimal solver spends its time. The map also feeds the visuals that will go into the app.

## What to compute, per position

Store per-position arrays in `data/` (git-ignored). Commit only aggregates.

- **Basics.** Distance `d`, from `lab/2x2/data/dist_htm.npy`.
  - Doors home: the number of distinct shortest solutions, counted backwards over the BFS layers as in `lab/2x2/exp8_doors_and_compass.py`.
  - Symmetry class, under the inverse and the three rotations about the URF–DBL axis (see `lab/2x2/exp1_truth.py`). Check that `d` and the doors count are the same across each class.
- **Floors.** For the floors twists only, places only, and 2 KB, 20 KB, 100 KB and 400 KB (`lab/2x2/data/floor_*.npy`), each with and without the mirror lookup max(h(x), h(x⁻¹)): the floor `h` and the gap `d − h`.
- **Full IDA\* anatomy, for every position.** Do this for at least 20 KB + mirror and 400 KB + mirror, and for 2 KB + mirror if time allows. Record:
  - total lookups
  - proof lookups (all rounds before the last)
  - find lookups (the last round)
  - lookups cut on arrival, split by whether the parent was tight (g + h = bound)
  - expansions and number of rounds
  - the solution length, which must equal `d`

  Use numba or C with multiprocessing; plain Python is too slow for 3.67 million solves. Count lookups as exp7 does.

## Questions to answer in FINDINGS.md

1. **Heavy tail.** What share of all work comes from the top 0.1%, 1% and 10% of positions? What marks them: distance, gap, doors home, or something else?
2. **Proof against find,** by distance and by floor.
3. **Few doors, slow find?** At a fixed distance, does a low doors-home count predict a costly final round? Give the partial correlation controlling for distance, not the raw one: distance confounds it.
4. **The gap law.** How does work grow with the starting gap, and is it close to b^gap for some b? Per floor.
5. **Where would one more byte help most?** Map mean work by distance ring × gap, and say where extra floor memory or a compass would pay off most.
6. Anything surprising.

## Visual prototypes

Commit small SVG or PNG files plus the aggregated JSON they read, 1 MB in total at most. The final in-app versions will be built when the tasks are stitched together, so keep these simple and put your effort into the data.

1. **Where the time went,** for one solve and on average: proof, find, and cut on arrival.
2. **Doors home:** the distribution of shortest-solution counts by distance.
3. **Work map:** mean lookups by distance × starting gap.

## Results

- `results/frontier.json`: anatomy baselines for every floor with and without mirror, both on the 1,000-position benchmark and over all positions.
- `results/aggregates.json`: everything the visuals and FINDINGS tables use.

## Done when

- Every one of the 3,674,160 solutions has been checked for length against the truth table.
- All six questions are answered with numbers.
- The visuals are committed.
- The pull request is open into `phase-8-speed-lab`.
