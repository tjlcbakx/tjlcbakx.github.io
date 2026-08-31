#!/usr/bin/env python3
"""Generate python_reference.json: ground-truth values from the original
RSG.py, against which test_physics.mjs pins the JS port.

Run from this directory:  python3 make_reference.py
"""
import json
import sys
import os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RSG_DIR = os.path.join(HERE, '..', '..', 'redshift-search-graphs')
sys.path.insert(0, RSG_DIR)

import RSG  # noqa: E402

ref = {}

# --- giveMultiFactors ------------------------------------------------------
pairs = [[2, 4], [2, 3], [3, 5], [4, 6], [2, 6], [3, 6], [4, 8], [5, 7], [6, 9]]
ref['giveMultiFactors'] = [
    {'a': a, 'b': b, 'out': float(RSG.giveMultiFactors(a, b))} for a, b in pairs
]

# --- giveALMA --------------------------------------------------------------
ref['giveALMA'] = []
for band in range(3, 9):
    for ratio in [0.0, 0.5, 1.0]:
        low, upp = RSG.giveALMA(band, ratio)
        ref['giveALMA'].append({'band': band, 'ratio': ratio,
                                'lsb': [float(x) for x in low],
                                'usb': [float(x) for x in upp]})

# --- line-in-band counts on a z grid (RSGquality's internal "seen") -------
# Recomputed here with RSG.py's own constants, same recipe as RSGquality.
def seen_counts(filter_down, filter_up, z_values, nr_of_CO_lines=20, includeCI=False):
    SL = [(i + 1) * RSG.CO10 for i in range(nr_of_CO_lines)]
    extra = [RSG.OIII52, RSG.NIII57, RSG.OI63, RSG.OIII88, RSG.NII121,
             RSG.OI145, RSG.CII157, RSG.NII205]
    if includeCI:
        extra += [RSG.CI370, RSG.CI609]
    SL = np.array(SL + extra)
    fd, fu = np.array(filter_down), np.array(filter_up)
    out = []
    for z in z_values:
        f = SL / (1 + z)
        s = np.zeros(len(f))
        for j in range(len(fd)):
            s[(f > fd[j]) & (f < fu[j])] = 1
        out.append(int(s.sum()))
    return out

Z_GRID = [float(z) for z in np.arange(0.0, 7.01, 0.05)]
CONFIGS = {
    'optimal_b3b4': {'down': [89.1, 139.9], 'up': [112.0, 162.7]},
    'band3_fill':   {'down': [84.2], 'up': [114.9]},
    'fig1_tuning':  {'down': [89.1, 139.9], 'up': [112.0, 162.7]},
}
ref['z_grid'] = Z_GRID
ref['seen_counts'] = {
    name: seen_counts(c['down'], c['up'], Z_GRID) for name, c in CONFIGS.items()
}

# --- RSGquality ------------------------------------------------------------
# Deterministic sample: a smoothed HerBS-like redshift distribution stand-in.
rng = np.random.default_rng(42)
z_sample = np.clip(rng.normal(2.5, 1.0, 3000), 0.1, 7.0)
ref['z_sample_stats'] = {'mean': float(z_sample.mean()), 'n': len(z_sample)}
ref['z_sample'] = [float(z) for z in z_sample]

ref['rsgQuality'] = {}
for name, c in CONFIGS.items():
    for includeCI in (False, True):
        key = f'{name}_ci{int(includeCI)}'
        q = RSG.RSGquality(c['down'], c['up'], z_sample, includeCI=includeCI)
        ref['rsgQuality'][key] = {'down': c['down'], 'up': c['up'],
                                  'includeCI': includeCI,
                                  'out': [float(x) for x in q]}

out_path = os.path.join(HERE, 'python_reference.json')
with open(out_path, 'w') as f:
    json.dump(ref, f)
print(f'wrote {out_path}')
