#!/bin/sh
# Native reference on this machine: lab/3x3's cube3, one thread, one solve at a time.
# Writes data/native/<floor>__<set>.jsonl. Tables in data/tables (make; then cube3 build ...).
cd "$(dirname "$0")/.." || exit 1
export CUBE3_TABLES=data/tables OMP_NUM_THREADS=1
S=../../3x3/scrambles
run() { # floor set file
  out="data/native/$(echo "$1" | tr '@+' '__')__$2.jsonl"
  [ -s "$out" ] || ./build/cube3 solve "$1" "$3" 3000000000 > "$out" 2>/dev/null
}
for f in 'C8s@2+E6x8@2' 'C8s+P1x3i'; do
  run "$f" moves-12 $S/moves-12.txt
  run "$f" moves-14 $S/moves-14.txt
done
run 'C8s+P1x3i' moves-16-first10 data/moves-16-first10.txt
