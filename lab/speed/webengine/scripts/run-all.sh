#!/bin/sh
# Every browser run in FINDINGS, one at a time (4-core machine). Output: data/browser/*.json, log on stderr.
cd "$(dirname "$0")/.." || exit 1
R="node scripts/run-browser.mjs solve"
D='C8s+P1x3i'
for n in 1 2 4; do $R shared $D moves-14 $n; done
for n in 1 2 4; do $R copies $D moves-14 $n; done
for n in 1 2 4; do $R shared $D moves-16-first10 $n; done
$R copies $D moves-16-first10 4
$R race $D moves-14 3
$R race $D moves-16-first10 3
$R shared $D moves-16 4 all
$R race $D moves-16 3 all
$R shared $D random-idx0-idx7 4
$R copies $D random-idx0-idx7 4 all 2 6e9
$R race $D random-0-4-5-6-7 3 all 2 3e10 900
$R shared $D random-0-4-5-6-7 4 all 2 3e10
