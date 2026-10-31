#!/bin/sh
# Every measurement for T7, one process at a time on 4 threads. Skips result files that exist.
# Needs data/tables with the masks (see README.md).
set -e
cd "$(dirname "$0")/.."
export CUBE3_TABLES=data/tables
python3 scripts/inputs.py
mkdir -p results/raw
run() { out=results/raw/$1.jsonl; shift; [ -s "$out" ] || { "$@" > "$out.tmp" && mv "$out.tmp" "$out"; }; }
# (e) on all 20 random states, 30 min cap each, help once stuck for max(60 s, 25% of elapsed).
# The brief's max(5 s, 25%) is measured on the first 5 (rs5-race-masks-help-5s25): it yields at 5 s every time.
run rs-race-masks-help env COMB_HELP_MIN=60 COMB_HELP_FRAC=0.25 ./comb comb run data/in-random-state.txt race 4 1 1 1800
# the 16-move set, all five configurations
run m16-split ./comb comb run data/in-moves-16.txt split 4 0 0 120
run m16-split-masks ./comb comb run data/in-moves-16.txt split 4 1 0 120
run m16-race ./comb comb run data/in-moves-16.txt race 4 0 0 120
run m16-race-masks ./comb comb run data/in-moves-16.txt race 4 1 0 120
run m16-race-masks-help env COMB_HELP_MIN=60 COMB_HELP_FRAC=0.25 ./comb comb run data/in-moves-16.txt race 4 1 1 120
# 5 random states: (b), (c), and (e) with the brief's help threshold, max(5 s, 25%)
head -n 5 data/in-random-state.txt > data/rs5.txt
run rs5-race-masks-help-5s25 env COMB_HELP_MIN=5 COMB_HELP_FRAC=0.25 ./comb comb run data/rs5.txt race 4 1 1 1800
run rs5-split-masks ./comb comb run data/rs5.txt split 4 1 0 1800
run rs5-race ./comb comb run data/rs5.txt race 4 0 0 1800
# one thread, lab/3x3's dfs, for this machine's nodes per second
head -n 5 data/in-moves-16.txt | cut -d' ' -f2- > data/m16-5.scr
run m16-5-1t env OMP_NUM_THREADS=1 ./comb gsolve C8s+P1x3i data/m16-5.scr 100000000000 0
