"""Visual prototypes for the atlas, drawn from results/aggregates.json. Final in-app versions come later."""
import json
import os

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
agg = json.load(open(os.path.join(HERE, 'results', 'aggregates.json')))
OUT = os.path.join(HERE, 'results')
INK, MUTED, LINE, ACCENT, ACCENT2 = '#1b2a4a', '#56637c', '#d5deea', '#c8402f', '#e9a89f'
plt.rcParams.update({'font.size': 10, 'axes.edgecolor': LINE, 'axes.labelcolor': MUTED, 'xtick.color': MUTED,
                     'ytick.color': MUTED, 'axes.spines.top': False, 'axes.spines.right': False})

# 1. Where the time went: proof rounds against the final round, per floor (all positions).
names = ['2 KB + mirror', '20 KB', '20 KB + mirror', '100 KB + mirror', '400 KB + mirror']
proof = [agg['floors'][n]['mean_proof'] for n in names]
find = [agg['floors'][n]['mean_find'] for n in names]
fig, ax = plt.subplots(figsize=(6.4, 3.2))
for i, n in enumerate(names):
    tot = proof[i] + find[i]
    ax.barh(i, proof[i] / tot, height=0.5, color=MUTED, alpha=0.55)
    ax.barh(i, find[i] / tot, left=proof[i] / tot, height=0.5, color=ACCENT)
    ax.text(1.01, i, f'{tot:,.0f} lookups', va='center', color=INK, fontsize=9)
ax.set_yticks(range(len(names)), names)
ax.set_xlim(0, 1)
ax.set_xticks([0, 0.25, 0.5, 0.75, 1], ['0%', '25%', '50%', '75%', '100%'])
ax.set_title('Where the time went: proof rounds (grey) and the final round (red)', fontsize=10, color=INK, loc='left')
ax.invert_yaxis()
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'where_the_time_went.png'), dpi=150)

# 2. Doors home: share of positions with a single shortest solution, and the median count, by distance.
ds = sorted(int(d) for d in agg['doors_by_distance'])
uniq = [agg['doors_by_distance'][str(d)]['share_unique'] for d in ds]
med = [agg['doors_by_distance'][str(d)]['median'] for d in ds]
fig, ax = plt.subplots(figsize=(6.4, 3.0))
ax.bar(ds, uniq, width=0.6, color=ACCENT)
for d, u, m in zip(ds, uniq, med):
    ax.text(d, u + 0.02, f'{m:g}', ha='center', fontsize=8, color=INK)
ax.set_xticks(ds)
ax.set_ylim(0, 1.12)
ax.set_yticks([0, 0.5, 1], ['0%', '50%', '100%'])
ax.set_xlabel('Moves from solved')
ax.set_title('Doors home: share of positions with one shortest solution (bars); median count above',
             fontsize=10, color=INK, loc='left')
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'doors_home.png'), dpi=150)

# 3. Work map: share of all work by distance × starting gap, 20 KB + mirror floor.
wm = agg['floors']['20 KB + mirror']['work_map']
cells = [(int(k.split(',')[0]), int(k.split(',')[1]), v['work_share']) for k, v in wm.items()]
dmax = max(d for d, _, _ in cells)
gmax = max(g for _, g, _ in cells)
grid = [[0.0] * (dmax + 1) for _ in range(gmax + 1)]
for d, g, s in cells:
    grid[g][d] = s
fig, ax = plt.subplots(figsize=(6.4, 3.2))
im = ax.imshow(grid, origin='lower', cmap='Reds', aspect='auto', vmin=0)
for d, g, s in cells:
    if s >= 0.01:
        ax.text(d, g, f'{s:.0%}', ha='center', va='center', fontsize=7, color='white' if s > 0.12 else INK)
ax.set_xlabel('Moves from solved')
ax.set_ylabel('Starting gap (truth − floor)')
ax.set_title('Where the work is: share of all lookups, 20 KB + mirror floor', fontsize=10, color=INK, loc='left')
fig.colorbar(im, ax=ax, shrink=0.8)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'work_map.png'), dpi=150)
print('plots written')
