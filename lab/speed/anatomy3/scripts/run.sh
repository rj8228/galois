#!/bin/sh
# Runs every measurement in FINDINGS.md. Raw output: results/raw/*.jsonl (one line per scramble).
# Needs the tables in data/tables:  CUBE3_TABLES=data/tables ./anat3 build corners_sym edges6 phase1_sym
set -e
cd "$(dirname "$0")/.."
export CUBE3_TABLES=data/tables OMP_NUM_THREADS=${THREADS:-4}
S=../../3x3/scrambles
R=results/raw
mkdir -p $R data
D=C8s+P1x3i
P=C8s@2+E6x8@2
PM=C8s+E6x8i   # 4-bit tables read on the inverse, only to order children by the mirror floor
run() { out=$1; shift; [ -s "$out" ] && { echo "skip $out"; return; }; echo "run $out"; ./anat3 anat "$@" > "$out.tmp"; mv "$out.tmp" "$out"; }
for n in 12 14; do
  run $R/desktop-moves-$n.jsonl $D $S/moves-$n.txt 20000000000 cfmn
  run $R/phone-moves-$n.jsonl   $P $S/moves-$n.txt 20000000000 cfmn $PM
done
run $R/desktop-moves-16.jsonl $D $S/moves-16.txt 20000000000 cfm
# Phone set at 16 moves: about 4 minutes per solve, so only the first 12 scrambles of the file.
grep -v '^#' $S/moves-16.txt | head -12 > data/moves-16-first12.txt
run $R/phone-moves-16.jsonl $P data/moves-16-first12.txt 20000000000 c
# Downhill masks (gravity): the final round again, counting what masks on the direct lookups let through.
for n in 12 14; do
  run $R/desktop-moves-$n-gravity.jsonl $D $S/moves-$n.txt 20000000000 g
  run $R/phone-moves-$n-gravity.jsonl   $P $S/moves-$n.txt 20000000000 g
done
run $R/desktop-moves-16-gravity.jsonl $D $S/moves-16.txt 20000000000 g
# Random states, desktop set: the first 8 of the file (about 12 minutes each).
grep -v '^#' $S/random-state.txt | head -8 > data/random-state-first8.txt
run $R/desktop-random-state.jsonl $D data/random-state-first8.txt 60000000000 c
