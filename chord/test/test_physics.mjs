// test_physics.mjs — pins game/js/physics.js to the Python original.
// Run:  node game/test/test_physics.mjs      (reference JSON is committed;
// regenerate with:  ~/miniconda3/bin/python3 game/test/make_reference.py)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  giveMultiFactors, giveALMA, coverageCurve, qualityLineSet, rsgQuality,
  jointSolutions, candidateRedshifts, scoreSample, figureOfMerit,
} from '../js/physics.js';

const here = dirname(fileURLToPath(import.meta.url));
const ref = JSON.parse(readFileSync(join(here, 'python_reference.json'), 'utf8'));

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) { failures++; console.error(`FAIL  ${label}  ${detail}`); }
  else console.log(`ok    ${label}`);
}
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// --- giveMultiFactors ------------------------------------------------------
for (const { a, b, out } of ref.giveMultiFactors) {
  const got = giveMultiFactors(a, b);
  check(`giveMultiFactors(${a},${b})`, close(got, out), `got ${got}, want ${out}`);
}

// --- giveALMA (bands 3–8; band 9 deliberately deviates, see physics.js) ----
for (const { band, ratio, lsb, usb } of ref.giveALMA) {
  const got = giveALMA(band, ratio);
  const ok = close(got.lsb[0], lsb[0]) && close(got.lsb[1], lsb[1])
          && close(got.usb[0], usb[0]) && close(got.usb[1], usb[1]);
  check(`giveALMA(${band}, ${ratio})`, ok,
    `got ${JSON.stringify(got)}, want lsb=${lsb} usb=${usb}`);
}

// --- line-in-band counts across z ------------------------------------------
const bandsOf = (c) => c.down.map((lo, i) => [lo, c.up[i]]);
const CONFIGS = {
  optimal_b3b4: { down: [89.1, 139.9], up: [112.0, 162.7] },
  band3_fill: { down: [84.2], up: [114.9] },
  fig1_tuning: { down: [89.1, 139.9], up: [112.0, 162.7] },
};
for (const [name, cfg] of Object.entries(CONFIGS)) {
  const got = coverageCurve(ref.z_grid, qualityLineSet(20, false), bandsOf(cfg));
  const want = ref.seen_counts[name];
  const bad = got.findIndex((g, i) => g !== want[i]);
  check(`seen_counts ${name}`, bad === -1,
    bad === -1 ? '' : `first mismatch at z=${ref.z_grid[bad]}: got ${got[bad]}, want ${want[bad]}`);
}

// --- RSGquality -------------------------------------------------------------
for (const [key, r] of Object.entries(ref.rsgQuality)) {
  const got = rsgQuality(bandsOf(r), ref.z_sample, { includeCI: r.includeCI });
  // tolerance: a couple of grid-boundary samples out of 3000 may flip
  const ok = got.every((g, i) => close(g, r.out[i], 2 / ref.z_sample.length + 1e-12));
  check(`rsgQuality ${key}`, ok, `got [${got.map((x) => x.toFixed(5))}], want [${r.out.map((x) => x.toFixed(5))}]`);
}

// --- scoreSample: the sandbox's per-galaxy verdicts must be the same
// classification as the paper's score, not a second opinion ------------------
for (const [name, cfg] of Object.entries(CONFIGS)) {
  const bands = bandsOf(cfg);
  const { quality, fractions } = scoreSample(bands, ref.z_sample);
  const [noLines, oneLine, twoLines, moreLines, robustSingle, nonRobustDouble] = quality;
  const sum = fractions.robust + fractions.ambiguous + fractions.silent;
  const robustWanted = robustSingle + (twoLines - nonRobustDouble) + moreLines;
  const ambiguousWanted = (oneLine - robustSingle) + nonRobustDouble;
  check(`scoreSample partitions the sample ${name}`,
    close(sum, 1, 1e-9) && close(fractions.robust, robustWanted, 1e-9)
    && close(fractions.ambiguous, ambiguousWanted, 1e-9)
    && close(fractions.silent, noLines, 1e-9),
    `got ${JSON.stringify(fractions)} vs quality ${quality.map((x) => x.toFixed(4))}`);
}

// --- the sandbox's score is the paper's own figure of merit ----------------
for (const [name, cfg] of Object.entries(CONFIGS)) {
  const { quality, fractions } = scoreSample(bandsOf(cfg), ref.z_sample);
  check(`figureOfMerit = robust + half of ambiguous ${name}`,
    close(figureOfMerit(quality), fractions.robust + 0.5 * fractions.ambiguous, 1e-9),
    `got ${figureOfMerit(quality)} vs ${fractions.robust + 0.5 * fractions.ambiguous}`);
}

// --- Paper worked examples (validated against the paper, not RSG.py) -------
// Fig. 1: CO(3-2)+CO(5-4) at 93.463 & 155.772 GHz → z ≈ 2.70, impostor ≈ 6.40
{
  const bands = bandsOf(CONFIGS.optimal_b3b4);
  const sols = jointSolutions([93.463, 155.772], bands, { zMax: 7 });
  const zs = sols.map((s) => s.z.toFixed(2));
  check('Fig1 joint solutions ≈ 2.70 & 6.40',
    zs.some((z) => Math.abs(z - 2.70) < 0.02) && zs.some((z) => Math.abs(z - 6.40) < 0.03),
    `got z = [${zs.join(', ')}]`);
}
// Fig. 3: single line at 144.089 GHz → candidates include z ≈ 3.00 (CO(5-4))
{
  const cands = candidateRedshifts([144.089], bandsOf(CONFIGS.optimal_b3b4), { zMax: 7 });
  check('Fig3 single line has z ≈ 3.00 candidate',
    cands.some((c) => Math.abs(c.z - 3.0) < 0.02 && c.line.name === 'CO(5-4)'),
    `got [${cands.map((c) => `${c.line.name}@${c.z.toFixed(2)}`).join(', ')}]`);
}
// Fig. 4: 107.229 + 160.844 GHz fits both z ≈ 1.15 and z ≈ 3.30
{
  const sols = jointSolutions([107.229, 160.844], bandsOf(CONFIGS.optimal_b3b4), { zMax: 7 });
  const zs = sols.map((s) => s.z);
  check('Fig4 degenerate pair z ≈ 1.15 & 3.30',
    zs.some((z) => Math.abs(z - 1.15) < 0.02) && zs.some((z) => Math.abs(z - 3.30) < 0.02),
    `got z = [${zs.map((z) => z.toFixed(2)).join(', ')}]`);
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
