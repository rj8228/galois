#!/bin/sh
# Runs every timing in FINDINGS.md. Raw output: results/raw/*.jsonl (one line per solve; skips files that exist).
# Needs: make; CUBE3_TABLES=data/tables ./grav3 build corners_sym phase1_sym; ... ./grav3 masks corners_sym phase1_sym
# Modes: 0 baseline (lab/3x3's dfs), 1 down masks uint32, 2 full masks (down + up), 3 down masks packed in 3 bytes.
# Timed runs go one at a time on an otherwise idle machine. Sets are cut into chunks of 10 scrambles and the
# modes take turns chunk by chunk, so a drift in machine speed hits every mode alike.
set -e
cd "$(dirname "$0")/.."
export CUBE3_TABLES=data/tables
S=../../3x3/scrambles
R=results/raw
D=C8s+P1x3i
CAP=20000000000
mkdir -p $R data/chunks
./grav3 maskcheck $D 2000000 > results/maskcheck.json
GRAV3_WRONG_FRAME=1 ./grav3 maskcheck $D 200000 > results/maskcheck-wrong-frame.json || true
# set threads modes tag
timed() {
  set=$1 th=$2 modes=$3 tag=$4
  out=$R/$set-t$th
  [ -s "$out-m${modes%% *}.jsonl" ] && { echo "skip $out"; return; }
  grep -v '^#' $S/$set.txt | split -l 10 -d - data/chunks/$set.
  for m in $modes; do : > "$out-m$m.jsonl.tmp"; done
  for c in data/chunks/$set.*; do
    for m in $modes; do
      echo "run $set threads $th mode $m $c"
      if [ "$th" = 1 ]; then
        OMP_NUM_THREADS=1 ./grav3 gsolve $D $c $CAP $m 2>/dev/null >> "$out-m$m.jsonl.tmp"
      else
        OMP_NUM_THREADS=$th CUBE3_SPLIT=3 ./grav3 gsolve $D $c $CAP $m 2>/dev/null >> "$out-m$m.jsonl.tmp"
      fi
    done
  done
  for m in $modes; do mv "$out-m$m.jsonl.tmp" "$out-m$m.jsonl"; done
  rm -f data/chunks/$set.*
}
timed moves-12 1 "0 1 2 3"
timed moves-14 1 "0 1 2 3"
timed moves-16 1 "0 1 2 3"
timed moves-16 2 "0 1 2"
# Random states: lab/3x3's two cheapest desktop solves (#7, 33 s; #4, 208 s), baseline and down masks.
grep -v '^#' $S/random-state.txt | sed -n '8p;5p' > data/random-two.txt
if [ ! -s $R/random-two-t1-m0.jsonl ]; then
  for m in 0 1; do OMP_NUM_THREADS=1 ./grav3 gsolve $D data/random-two.txt 3000000000 $m 2>/dev/null > $R/random-two-t1-m$m.jsonl.tmp; done
  for m in 0 1; do mv $R/random-two-t1-m$m.jsonl.tmp $R/random-two-t1-m$m.jsonl; done
fi
