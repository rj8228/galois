#!/bin/sh
# Every measurement for T7, one process at a time on 4 threads. Skips result files that exist.
# Needs data/tables with the masks (see README.md).
set -e
cd "$(dirname "$0")/.."
export CUBE3_TABLES=data/tables
python3 scripts/inputs.py
mkdir -p results/raw
run() { out=results/raw/$1.jsonl; shift; [ -s "$out" ] || { "$@" > "$out.tmp" && mv "$out.tmp" "$out"; }; }
# (e) on all 20 random states, 30 min cap each
run rs-race-masks-help ./comb comb run data/in-random-state.txt race 4 1 1 1800
# the 16-move set, all five configurations
run m16-split ./comb comb run data/in-moves-16.txt split 4 0 0 120
run m16-split-masks ./comb comb run data/in-moves-16.txt split 4 1 0 120
run m16-race ./comb comb run data/in-moves-16.txt race 4 0 0 120
run m16-race-masks ./comb comb run data/in-moves-16.txt race 4 1 0 120
run m16-race-masks-help ./comb comb run data/in-moves-16.txt race 4 1 1 120
# 5 random states: (b), (c), and (e) with the other help threshold, max(2 s, 10%)
head -n 5 data/in-random-state.txt > data/rs5.txt
run rs5-split-masks ./comb comb run data/rs5.txt split 4 1 0 1800
run rs5-race ./comb comb run data/rs5.txt race 4 0 0 1800
COMB_HELP_MIN=2 COMB_HELP_FRAC=0.10 run rs5-race-masks-help-2s10 ./comb comb run data/rs5.txt race 4 1 1 1800
