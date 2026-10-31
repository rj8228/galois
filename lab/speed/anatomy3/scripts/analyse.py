"""Aggregates results/raw/*.jsonl into results/anatomy.json, results/frontier.json and the tables in
FINDINGS.md (between the <!-- tables:start --> and <!-- tables:end --> markers).

Checks, and fails loudly if any breaks:
  - every solution (and every compass/order/count rerun's first solution) replays to solved
  - every rerun of the final round finds a solution of the same length
  - lengths equal lab/3x3's results for the same scrambles and floor sets (where lab/3x3 finished;
    otherwise they are compared with the other floor set's length)
  - count mode's first solution comes after exactly as many lookups as the plain final round
"""
import json
import math
import os
import statistics as st
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, 'results', 'raw')
LAB3 = os.path.join(ROOT, '..', '..', '3x3', 'results')

FLOORS = {'desktop': 'C8s+P1x3i', 'phone': 'C8s@2+E6x8@2'}
SETS = ['moves-12', 'moves-14', 'moves-16', 'random-state']
SET_LABEL = {'moves-12': '12 moves', 'moves-14': '14 moves', 'moves-16': '16 moves', 'random-state': 'random state'}
TABLES = {'C8s+P1x3i': [('corners_sym', 'bytes_4bit'), ('phase1_sym', 'bytes_4bit')],
          'C8s@2+E6x8@2': [('corners_sym', 'bytes_2bit'), ('edges6', 'bytes_2bit')]}

problems = []


def load(dev, s):
    p = os.path.join(RAW, f'{dev}-{s}.jsonl')
    if not os.path.exists(p):
        return None, None
    rows = [json.loads(line) for line in open(p)]
    meta = rows[0]
    solves = sorted(rows[1:], key=lambda r: r['index'])
    return meta, solves


def ref_lengths(floor, s):
    p = os.path.join(LAB3, f'bench-{s}.json')
    d = json.load(open(p))['floors'].get(floor)
    if not d:
        return {}
    return {x['scramble']: x['length'] for x in d['solves'] if not x['dnf']}


def agg_rounds(rounds):
    keys = rounds[0].keys()
    return {k: sum(r[k] for r in rounds) for k in keys}


def pct(x):
    return f'{100 * x:.0f}%'


def num(x):
    if x is None:
        return '–'
    if x >= 100:
        return f'{x:,.0f}'
    return f'{x:,.1f}'


data = {}
for dev, floor in FLOORS.items():
    for s in SETS:
        meta, solves = load(dev, s)
        if not solves:
            continue
        ref = ref_lengths(floor, s)
        other = ref_lengths(FLOORS['phone' if dev == 'desktop' else 'desktop'], s)
        done = [r for r in solves if not r['capped'] and r['length'] >= 0]
        capped = [r for r in solves if r['capped']]
        for r in done:
            if not r['verified']:
                problems.append(f'{dev} {s} #{r["index"]}: solution does not replay')
            want = ref.get(r['scramble'], other.get(r['scramble']))
            if want is not None and want != r['length']:
                problems.append(f'{dev} {s} #{r["index"]}: length {r["length"]}, lab/3x3 says {want}')
            for e in ('compass', 'by_floor', 'by_mirror', 'count'):
                if e in r:
                    x = r[e]
                    if x['capped'] or x['found_length'] != r['length'] or not x['verified']:
                        problems.append(f'{dev} {s} #{r["index"]}: {e} rerun failed {x}')
            if 'count' in r and r['count']['first_at'] != r['rounds'][-1]['lookups']:
                problems.append(f'{dev} {s} #{r["index"]}: count first_at {r["count"]["first_at"]} != final round '
                                f'{r["rounds"][-1]["lookups"]}')
        checked = sum(1 for r in done if r['scramble'] in ref or r['scramble'] in other)
        data[(dev, s)] = dict(meta=meta, solves=solves, done=done, capped=capped, checked=checked)

if problems:
    print('PROBLEMS:')
    for p in problems:
        print('  ', p)
    sys.exit(1)

sizes = json.load(open(os.path.join(LAB3, 'sizes.json')))['tables']


def floor_bytes(floor):
    return sum(sizes[t][k] for t, k in TABLES[floor])


summary = {}
for (dev, s), d in data.items():
    done = d['done']
    if not done:
        summary[(dev, s)] = dict(n=len(d['solves']), done=0, capped=len(d['capped']))
        continue
    tot = [r['lookups'] for r in done]
    fin = [r['rounds'][-1]['lookups'] for r in done]
    proof = [t - f for t, f in zip(tot, fin)]
    allr = agg_rounds([x for r in done for x in r['rounds']])
    finr = agg_rounds([r['rounds'][-1] for r in done])
    proofr = agg_rounds([x for r in done for x in r['rounds'][:-1]]) if any(len(r['rounds']) > 1 for r in done) else None
    gen = allr['gen_tight'] + allr['gen_loose']
    cut = allr['cut_tight'] + allr['cut_loose']
    row = dict(
        n=len(d['solves']), done=len(done), capped=len(d['capped']), checked=d['checked'],
        mean_length=st.mean(r['length'] for r in done),
        mean_h0=st.mean(r['h0'] for r in done),
        mean_lookups=st.mean(tot), median_lookups=st.median(tot),
        mean_final=st.mean(fin), mean_proof=st.mean(proof),
        final_share=sum(fin) / sum(tot),
        final_share_median=st.median(f / t for f, t in zip(fin, tot)),
        mean_seconds=st.mean(r['seconds'] for r in done),
        cut_share=cut / gen,
        tight_share_of_generated=allr['gen_tight'] / gen,
        cut_rate_tight=allr['cut_tight'] / allr['gen_tight'] if allr['gen_tight'] else None,
        cut_rate_loose=allr['cut_loose'] / allr['gen_loose'] if allr['gen_loose'] else None,
        tests_share=allr['tests'] / gen,
        cut_share_final=(finr['cut_tight'] + finr['cut_loose']) / (finr['gen_tight'] + finr['gen_loose']),
        mean_expansions=st.mean(sum(x['expansions'] for x in r['rounds']) for r in done),
        children_per_expansion=gen / allr['expansions'],
        survivors_per_expansion=(gen - cut) / allr['expansions'],
        tight_expansion_share=allr['expansions_tight'] / allr['expansions'],
        lookups_per_round=[st.mean(r['rounds'][i]['lookups'] for r in done) if all(len(r['rounds']) > i for r in done)
                           else None for i in range(max(len(r['rounds']) for r in done))],
        rounds_from_end=[st.mean(r['rounds'][-1 - i]['lookups'] for r in done if len(r['rounds']) > i)
                         for i in range(4)],
    )
    for e in ('compass', 'by_floor', 'by_mirror'):
        rs = [r for r in done if e in r]
        if not rs:
            continue
        ef = [r[e]['final']['lookups'] for r in rs]
        et = [r['lookups'] - r['rounds'][-1]['lookups'] + r[e]['final']['lookups'] for r in rs]
        base_t = [r['lookups'] for r in rs]
        base_f = [r['rounds'][-1]['lookups'] for r in rs]
        row[e] = dict(n=len(rs), mean_final=st.mean(ef), mean_total=st.mean(et),
                      base_final=st.mean(base_f), base_total=st.mean(base_t),
                      saving_total=1 - sum(et) / sum(base_t), speedup_total=sum(base_t) / sum(et),
                      mean_extra=st.mean(r[e]['final']['extra'] for r in rs))
    rs = [r for r in done if 'count' in r]
    if rs:
        cnt = [r['count']['solutions'] for r in rs]
        raw = [r['count'].get('solutions_raw') for r in rs]
        full = [r['count']['final']['lookups'] for r in rs]
        first = [r['count']['first_at'] for r in rs]
        frac = [a / b for a, b in zip(first, full)]
        lc = [math.log(c) for c in cnt]
        lf = [math.log(a) for a in first]
        corr = st.correlation(lc, lf) if len(set(cnt)) > 1 else None
        buckets = {}
        for c, a, b, fr in zip(cnt, first, full, frac):
            k = '1' if c == 1 else '2–3' if c <= 3 else '4–10' if c <= 10 else '11–100' if c <= 100 else '>100'
            buckets.setdefault(k, []).append((a, b, fr))
        order = ['1', '2–3', '4–10', '11–100', '>100']
        row['doors'] = dict(
            n=len(rs), unique_share=sum(c == 1 for c in cnt) / len(cnt), median=st.median(cnt),
            mean=st.mean(cnt), max=max(cnt),
            unique_share_raw=sum(c == 1 for c in raw) / len(raw) if None not in raw else None,
            median_raw=st.median(raw) if None not in raw else None,
            mean_full_final=st.mean(full), mean_first=st.mean(first),
            first_fraction_mean=st.mean(frac), first_fraction_median=st.median(frac),
            corr_log_count_log_first=corr,
            by_count={k: dict(n=len(v), mean_first=st.mean(a for a, _, _ in v), mean_full=st.mean(b for _, b, _ in v),
                              mean_fraction=st.mean(f for _, _, f in v), predicted_fraction=None)
                      for k, v in sorted(buckets.items(), key=lambda kv: order.index(kv[0]))},
        )
    summary[(dev, s)] = row

# --------------------------------------------------------------- gravity
ENTRIES = {'corners_sym': 6053616, 'edges6': 42577920, 'phase1_sym': 140908410}
for (dev, s) in list(summary):
    meta, rows = load(dev, s + '-gravity')
    if not rows:
        continue
    rows = [r for r in rows if 'gravity' in r]
    for r in rows:
        g = r['gravity']
        if g['capped'] or g['found_length'] != r['length'] or not g['verified']:
            problems.append(f'{dev} {s} #{r["index"]}: gravity rerun failed')
        if dev == 'phone' and g['allowed'] != g['survived']:
            problems.append(f'{dev} {s} #{r["index"]}: phone masks should be exact')
    tg = sum(r['gravity']['tight_generated'] for r in rows)
    fl = sum(r['gravity']['final']['lookups'] for r in rows)
    al = sum(r['gravity']['allowed'] for r in rows)
    ad = sum(r['gravity']['allowed_down_only'] for r in rows)
    sv = sum(r['gravity']['survived'] for r in rows)
    te = sum(r['gravity']['tight_expansions'] for r in rows)
    mr = sum(r['gravity']['mask_reads'] for r in rows)
    md = sum(r['gravity']['mask_reads_down_only'] for r in rows)
    ent = sum(ENTRIES[t] for t, _ in TABLES[FLOORS[dev]])
    summary[(dev, s)]['gravity'] = dict(
        n=len(rows), final_lookups=fl / len(rows), tight_generated_share=tg / fl,
        allowed_of_tight=al / tg, allowed_down_of_tight=ad / tg, survived_of_tight=sv / tg,
        lookups_saved_share=(tg - al) / fl, lookups_saved_share_down=(tg - ad) / fl,
        mask_reads_per_tight_expansion=mr / te, mask_reads_down_per_tight_expansion=md / te,
        children_per_tight_expansion=tg / te,
        mask_bytes_full=ent * 36 / 8, mask_bytes_down=ent * 18 / 8, floor_bytes=floor_bytes(FLOORS[dev]))
if problems:
    print('PROBLEMS:')
    for p in problems:
        print('  ', p)
    sys.exit(1)

# --------------------------------------------------------------- outputs
out = {f'{dev}/{s}': v for (dev, s), v in summary.items()}
json.dump(out, open(os.path.join(ROOT, 'results', 'anatomy.json'), 'w'), indent=1)

frontier = []
for (dev, s), v in summary.items():
    if not v.get('done'):
        continue
    floor = FLOORS[dev]
    base = dict(task='3x3-anatomy', puzzle='3x3', floor=floor, floor_bytes=floor_bytes(floor), extra_bytes=0,
                positions=v['n'], optimal=v['done'], lookups_counting='exp8', mean_extra_work=None,
                extra_work_unit=None, impl='c')
    capnote = f'; {v["capped"]} of {v["n"]} capped, means over the {v["done"]} finished' if v['capped'] else ''
    frontier.append(dict(base, method=f'IDA*, move order ({SET_LABEL[s]} scrambles)', mean_lookups=round(v['mean_lookups'], 1),
                         mean_final_round_lookups=round(v['mean_final'], 1), mean_ms=round(1000 * v['mean_seconds'], 2),
                         notes=f'lookup = one generated child; final round {pct(v["final_share"])}, cut on arrival '
                               f'{pct(v["cut_share"])}' + capnote))
    for e, label in (('compass', 'perfect compass for the found solution (bound)'), ('by_floor', 'children by floor'),
                     ('by_mirror', 'children by mirror floor')):
        if e not in v:
            continue
        x = v[e]
        extra = None
        if e == 'by_mirror' and dev == 'phone':
            extra = sizes['corners_sym']['bytes_4bit'] + sizes['edges6']['bytes_4bit']
        frontier.append(dict(base, method=f'IDA*, {label} ({SET_LABEL[s]} scrambles)', positions=x['n'],
                             optimal=x['n'], extra_bytes=extra if extra else 0, mean_lookups=round(x['mean_total'], 1),
                             mean_final_round_lookups=round(x['mean_final'], 1),
                             mean_extra_work=round(x['mean_extra'], 1) if x['mean_extra'] else None,
                             extra_work_unit='inverse table reads' if x['mean_extra'] else None, mean_ms=None,
                             notes=f'{pct(x["saving_total"])} fewer lookups than move order on these scrambles'
                                   + capnote))
json.dump(frontier, open(os.path.join(ROOT, 'results', 'frontier.json'), 'w'), indent=1)

# --------------------------------------------------------------- tables
L = []
order = [(dev, s) for s in SETS for dev in ('phone', 'desktop') if (dev, s) in summary]


def name(dev, s):
    v = summary[(dev, s)]
    extra = f' ({v["done"]} of {v["n"]})' if v.get('done', 0) != v['n'] else f' ({v["n"]})'
    return f'{dev.capitalize()} `{FLOORS[dev]}`, {SET_LABEL[s]}{extra}'


L.append('### Anatomy\n')
L.append('One *lookup* is one generated child (one evaluation of the floor set: 9 table reads for the phone set, 7 for '
         'the desktop set; one move from the end, a compare with solved). Children are all read before the search '
         'descends (exp8 counting). Means over the solves that finished.\n')
L.append('| Floor, scrambles (solves) | Length | Lookups per solve | Final round | Proof rounds | Final share (median) | '
         'Expansions | Cut on arrival | Generated under tight parents | Cut rate: tight / loose parent | Mean ms |')
L.append('| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |')
for k in order:
    v = summary[k]
    if not v.get('done'):
        L.append(f'| {name(*k)} | all capped | | | | | | | | | |')
        continue
    L.append(f'| {name(*k)} | {v["mean_length"]:.2f} | {num(v["mean_lookups"])} | {num(v["mean_final"])} | '
             f'{num(v["mean_proof"])} | {pct(v["final_share"])} ({pct(v["final_share_median"])}) | '
             f'{num(v["mean_expansions"])} | {100 * v["cut_share"]:.1f}% | {pct(v["tight_share_of_generated"])} | '
             f'{100 * v["cut_rate_tight"]:.1f}% / {100 * v["cut_rate_loose"]:.1f}% | {1000 * v["mean_seconds"]:,.1f} |')
L.append('')
L.append('### Per expansion\n')
L.append('| Floor, scrambles | Children per expansion | Survivors per expansion | Expansions at a tight node | '
         'Cut on arrival, final round only | Rounds from the end: last, −1, −2, −3 (mean lookups) |')
L.append('| --- | --: | --: | --: | --: | --- |')
for k in order:
    v = summary[k]
    if not v.get('done'):
        continue
    rr = ', '.join(num(x) for x in v['rounds_from_end'])
    L.append(f'| {name(*k)} | {v["children_per_expansion"]:.2f} | {v["survivors_per_expansion"]:.2f} | '
             f'{pct(v["tight_expansion_share"])} | {100 * v["cut_share_final"]:.1f}% | {rr} |')
L.append('')
L.append('### Compass: the final round in a different order\n')
L.append('*Perfect compass*: at every node on the found solution\'s path, that solution\'s next move is tried first '
         '(an upper bound for any order with the same floor). *By floor*: surviving children in ascending floor. '
         '*By mirror floor*: ascending max(h(x), h(x⁻¹)), then h(x) + h(x⁻¹); the phone set reads 4-bit `C8s+E6x8` on the '
         'inverse for this (not counted as lookups; listed as extra reads), the desktop set already has its inverse '
         'lookups. Totals keep the proof rounds unchanged.\n')
L.append('| Floor, scrambles | Final round: move order | Perfect compass | By floor | By mirror floor | '
         'Total: move order | Perfect compass | By floor | By mirror floor |')
L.append('| --- | --: | --: | --: | --: | --: | --: | --: | --: |')
for k in order:
    v = summary[k]
    if 'compass' not in v:
        continue
    c = v['compass']

    def cell(e, key):
        if e not in v:
            return '–'
        x = v[e]
        if key == 'mean_final':
            return num(x['mean_final'])
        return f'{num(x["mean_total"])} ({x["speedup_total"]:.2f}×)'

    L.append(f'| {name(*k)} | {num(c["base_final"])} | {cell("compass", "mean_final")} | {cell("by_floor", "mean_final")} | '
             f'{cell("by_mirror", "mean_final")} | {num(c["base_total"])} | {cell("compass", "t")} | '
             f'{cell("by_floor", "t")} | {cell("by_mirror", "t")} |')
L.append('')
L.append('### Doors home: shortest solutions per position\n')
L.append('Counted by finishing the final round after the first solution. *Canonical* counts move sequences the search '
         'can generate (opposite faces in one fixed order, so U D and D U count once); *all sequences* counts both '
         'orders, like the 2×2 lab (which has no opposite faces). *Find* is the final round\'s lookups up to the first '
         'solution, *full* the whole final round.\n')
L.append('| Floor, scrambles | Exactly one (canonical) | Median (canonical) | Mean | Max | Exactly one (all sequences) | '
         'Median (all sequences) | Find / full final round (mean, median) | corr(log count, log find) |')
L.append('| --- | --: | --: | --: | --: | --: | --: | --: | --: |')
for k in order:
    v = summary[k]
    if 'doors' not in v:
        continue
    d = v['doors']
    raw1 = pct(d['unique_share_raw']) if d['unique_share_raw'] is not None else '–'
    rawm = num(d['median_raw']) if d['median_raw'] is not None else '–'
    corr = f'{d["corr_log_count_log_first"]:+.2f}' if d['corr_log_count_log_first'] is not None else '–'
    L.append(f'| {name(*k)} | {pct(d["unique_share"])} | {num(d["median"])} | {num(d["mean"])} | {d["max"]:,} | {raw1} | '
             f'{rawm} | {pct(d["first_fraction_mean"])}, {pct(d["first_fraction_median"])} | {corr} |')
L.append('')
L.append('Cost of the find by number of shortest solutions (canonical):\n')
L.append('| Floor, scrambles | Solutions | Positions | Find (mean lookups) | Full final round | Find / full |')
L.append('| --- | --- | --: | --: | --: | --: |')
for k in order:
    v = summary[k]
    if 'doors' not in v:
        continue
    for b, x in v['doors']['by_count'].items():
        L.append(f'| {name(*k)} | {b} | {x["n"]} | {num(x["mean_first"])} | {num(x["mean_full"])} | '
                 f'{pct(x["mean_fraction"])} |')
L.append('')
L.append('### Gravity: what downhill masks on the direct lookups would let through\n')
L.append('The final round again, at every tight node (g + h = bound, one move or more from the end). *Full masks*: every '
         'direct lookup at the parent\'s maximum must go down, every one at maximum − 1 must not go up (two 18-bit masks '
         'per table entry). *Down only*: just the first rule (one 18-bit mask). Inverse lookups cannot use masks (the move '
         'acts on the other side) and are read as usual for the children the masks let through. *Lookups saved* is the '
         'share of the final round\'s lookups a mask would skip. Mask memory counts every entry of the floor\'s tables.\n')
L.append('| Floor, scrambles | Children per tight node | Survive | Let through: full masks | Down only | '
         'Lookups saved: full / down only | Mask reads per tight node: full / down only | Mask memory: full / down only (floor) |')
L.append('| --- | --: | --: | --: | --: | --: | --: | --: |')
for k in order:
    v = summary[k]
    if 'gravity' not in v:
        continue
    g = v['gravity']
    L.append(f'| {name(*k)} | {g["children_per_tight_expansion"]:.2f} | {100 * g["survived_of_tight"]:.1f}% | '
             f'{100 * g["allowed_of_tight"]:.1f}% | {100 * g["allowed_down_of_tight"]:.1f}% | '
             f'{pct(g["lookups_saved_share"])} / {pct(g["lookups_saved_share_down"])} | '
             f'{g["mask_reads_per_tight_expansion"]:.1f} / {g["mask_reads_down_per_tight_expansion"]:.1f} | '
             f'{g["mask_bytes_full"] / 1e6:,.0f} / {g["mask_bytes_down"] / 1e6:,.0f} MB ({g["floor_bytes"] / 1e6:.1f} MB) |')
L.append('')
caps = [f'{name(*k)}: {summary[k]["capped"]} capped' for k in order if summary[k].get('capped')]
L.append('**Capped runs:** ' + ('; '.join(caps) if caps else 'none') + '.\n')
L.append(f'**Checks:** every solution and every rerun\'s first solution replayed to solved; '
         f'{sum(summary[k].get("checked", 0) for k in order)} lengths compared with `lab/3x3` results, 0 differences.')

text = '\n'.join(L) + '\n'
fp = os.path.join(ROOT, 'FINDINGS.md')
if os.path.exists(fp):
    s = open(fp).read()
    a, b = '<!-- tables:start -->', '<!-- tables:end -->'
    if a in s and b in s:
        s = s[:s.index(a) + len(a)] + '\n\n' + text + '\n' + s[s.index(b):]
        open(fp, 'w').write(s)
        print('FINDINGS.md tables updated')
else:
    print(text)
print(json.dumps({k: {kk: vv for kk, vv in v.items() if not isinstance(vv, (dict, list))} for k, v in out.items()},
                 indent=1)[:4000])
