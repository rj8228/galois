#!/usr/bin/env python3
"""Checks every browser run and writes results/summary.json and results/frontier.json.

Reads results/runs/*.json (copied from data/browser/), T5's runs in ../browser/results/runs/ (for
comparison) and lab/3x3's native node counts. Prints the tables used in FINDINGS.md.
"""
import glob
import json
import os
import statistics as st

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAB = os.path.join(HERE, '..', '..', '3x3')
T5 = os.path.join(HERE, '..', 'browser', 'results', 'runs')


def load(path):
    with open(path) as f:
        return json.load(f)


def native_index():
    """scramble -> (length, nodes, nodes_per_bound) for the desktop floor, from lab/3x3."""
    out = {}
    for f in glob.glob(os.path.join(LAB, 'results', 'bench-*.json')):
        d = load(f)
        fl = d.get('floors', {}).get('C8s+P1x3i')
        if not fl:
            continue
        for s in fl['solves']:
            out[s['scramble']] = s
    return out


NAT = native_index()
runs = {os.path.basename(f)[:-5]: load(f) for f in sorted(glob.glob(os.path.join(HERE, 'results', 'runs', '*.json')))}
t5 = {os.path.basename(f)[:-5]: load(f) for f in sorted(glob.glob(os.path.join(T5, '*.json')))}
mean = lambda a: sum(a) / len(a) if a else None
problems = []
summary = {'runs': {}, 'node_check': {}, 't5': {}}

for name, r in runs.items():
    if r.get('kind') == 'node-check-shared':
        summary['node_check'][name] = {'identical': r['identical'], 'of': r['of']}
        if r['identical'] != r['of']:
            problems.append(f'{name}: {r["of"] - r["identical"]} node-count mismatches')
        continue
    if r.get('kind') != 'solve':
        continue
    sv = r['solves']
    ok = [s for s in sv if not s['dnf']]
    for s in ok:
        nat = NAT.get(s['scramble'])
        if not s.get('verified'):
            problems.append(f'{name}: unverified solution for {s["scramble"]}')
        if nat and not nat.get('dnf') and nat['length'] != s['length']:
            problems.append(f'{name}: length {s["length"]} != native {nat["length"]} for {s["scramble"]}')
    # Same nodes: one prover without a ceiling runs lab/3x3's unsplit search.
    same = None
    if r['provers'] == 1 and r['engine'] in ('shared', 'copies'):
        same = sum(1 for s in ok if (n := NAT.get(s['scramble'])) and n['nodes'] == s['nodes'] and n['length'] == s['length'])
    tails = [s['drain_ms'] - s['found_ms'] for s in ok if s.get('found_ms') is not None]
    row = {
        'engine': r['engine'], 'set': r['set'], 'provers': r['provers'], 'workers': r['workers'], 'sd': r['sd'],
        'solved': len(ok), 'of': len(sv),
        'mean_answer_ms': mean([s['found_ms'] for s in ok]),
        'median_answer_ms': st.median([s['found_ms'] for s in ok]) if ok else None,
        'mean_drain_ms': mean([s['drain_ms'] for s in ok]),
        'mean_tail_ms': mean(tails), 'max_tail_ms': max(tails) if tails else None,
        'mean_nodes': mean([s['nodes'] for s in ok]),
        'same_nodes_as_native': same,
        'wasm_memory_bytes': sum(r['wasm_memory']),
        'pss_after_setup': r['chromium_pss']['after_setup'], 'pss_peak': r['chromium_pss']['peak'],
        'isolated': r['isolation']['crossOriginIsolated'],
    }
    if r['engine'] == 'race':
        row['ended_by_ceiling'] = sum(1 for s in ok if s['end'] == 'ceiling')
        row['per_solve'] = [{'index': s['index'], 'length': s['length'], 'end': s['end'], 'answer_s': round(s['found_ms'] / 1e3, 3),
                             'ceiling_trace': [[round(t, 3), l] for t, l in s['ceiling']['trace']], 'bound_end': s['bound_end']} for s in sv]
    if r['set'].startswith('random'):
        row['per_solve_s'] = [round(s['found_ms'] / 1e3, 2) if not s['dnf'] else None for s in sv]
        row['per_solve_len'] = [s['length'] for s in sv]
    summary['runs'][name] = row

for name, r in t5.items():
    if r.get('kind') != 'solve' or r['floor'] != 'C8s+P1x3i':
        continue
    ok = [s for s in r['solves'] if not s['dnf']]
    summary['t5'][name] = {'set': r['set'], 'workers': r['workers'], 'sd': r['sd'], 'mean_answer_ms': mean([s['found_ms'] for s in ok]),
                          'mean_drain_ms': mean([s['drain_ms'] for s in ok]), 'wasm_memory_bytes': sum(r['wasm_memory_per_worker']),
                          'pss_after_setup': r['chromium_pss']['after_setup'],
                          'max_tail_ms': max(s['drain_ms'] - s['found_ms'] for s in ok)}

summary['problems'] = problems
with open(os.path.join(HERE, 'results', 'summary.json'), 'w') as f:
    json.dump(summary, f, indent=1)
    f.write('\n')

# frontier.json in the shared format
frontier = []
for name, row in summary['runs'].items():
    impl = {'shared': f'wasm-shared-{row["workers"]}w', 'race': f'wasm-race-{row["provers"]}p1c', 'copies': f'wasm-copies-{row["workers"]}w'}[row['engine']]
    frontier.append({
        'task': 'webengine', 'puzzle': '3x3', 'method': {'shared': 'IDA*, one shared table copy, atomic subtree counter, shared stop',
                                                         'race': 'IDA* provers + two-phase ceiling worker (T6 certificate), shared memory',
                                                         'copies': "T5's engine: private table copy per worker (fallback)"}[row['engine']],
        'floor': 'C8s+P1x3i', 'floor_bytes': 76_800_000, 'extra_bytes': None,
        'positions': row['of'], 'optimal': row['solved'], 'lookups_counting': None, 'mean_lookups': None,
        'mean_final_round_lookups': None, 'mean_extra_work': None, 'extra_work_unit': None,
        'mean_ms': round(row['mean_answer_ms'], 1) if row['mean_answer_ms'] is not None else None,
        'impl': impl,
        'notes': f'{row["set"]}, headless Chromium, 4-core Xeon; mean nodes {round(row["mean_nodes"])}; wasm memory {row["wasm_memory_bytes"] / 1e6:.0f} MB, PSS {row["pss_after_setup"] / 1e6:.0f} MB'
                 + (f'; ended by the ceiling {row["ended_by_ceiling"]}/{row["solved"]}' if 'ended_by_ceiling' in row else ''),
    })
with open(os.path.join(HERE, 'results', 'frontier.json'), 'w') as f:
    json.dump(frontier, f, indent=1)
    f.write('\n')

fmt = lambda ms: '–' if ms is None else (f'{ms:.1f} ms' if ms < 1000 else f'{ms / 1e3:.2f} s')
print('| Run | Solved | Mean answer | Median | Mean tail | Max tail | Mean nodes | Same nodes | wasm MB | PSS MB |')
for name, r in summary['runs'].items():
    print(f'| {name} | {r["solved"]}/{r["of"]} | {fmt(r["mean_answer_ms"])} | {fmt(r["median_answer_ms"])} | {fmt(r["mean_tail_ms"])} | {fmt(r["max_tail_ms"])} | {r["mean_nodes"]:,.0f} | {r["same_nodes_as_native"]} | {r["wasm_memory_bytes"] / 1e6:.0f} | {r["pss_after_setup"] / 1e6:.0f} |'
          + (f' ceiling {r["ended_by_ceiling"]}' if 'ended_by_ceiling' in r else ''))
print('\nT5:')
for name, r in summary['t5'].items():
    print(f'| {name} | {fmt(r["mean_answer_ms"])} | tail max {fmt(r["max_tail_ms"])} | {r["wasm_memory_bytes"] / 1e6:.0f} MB | PSS {r["pss_after_setup"] / 1e6:.0f} |')
print('\nnode checks:', summary['node_check'])
print('problems:', problems or 'none')
