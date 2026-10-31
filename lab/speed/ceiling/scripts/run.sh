#!/bin/sh
# Every measurement for T6. Skips result files that exist. Needs data/tables (see README.md).
set -e
cd "$(dirname "$0")/.."
export CUBE3_TABLES=data/tables
python3 scripts/inputs.py
mkdir -p results/raw
run() { out=results/raw/$1.jsonl; shift; [ -s "$out" ] || "$@" > "$out"; }
# Finder duel: target-D search (cap) and trace from scratch (cap), 4 positions at a time
run duel-moves-14 ./race ceil duel data/in-moves-14.txt 30 30 1
run duel-moves-16 ./race ceil duel data/in-moves-16.txt 60 60 1
OMP_NUM_THREADS=2 run duel-random-state ./race ceil duel data/in-random-state.txt 120 250 1
# The race: one solve at a time
for s in moves-14 moves-16; do
  run run-$s-1t1 ./race ceil run data/in-$s.txt 1t 1 120
  run run-$s-split2 ./race ceil run data/in-$s.txt split 2 120
  run run-$s-race2 ./race ceil run data/in-$s.txt race 2 120
  run run-$s-split4 ./race ceil run data/in-$s.txt split 4 120
  run run-$s-race4 ./race ceil run data/in-$s.txt race 4 120
done
head -n 4 data/in-random-state.txt > data/rs4.txt
run run-random-state-race2 ./race ceil run data/rs4.txt race 2 900
run run-random-state-race4 ./race ceil run data/rs4.txt race 4 900
run run-random-state-split4 ./race ceil run data/rs4.txt split 4 900
