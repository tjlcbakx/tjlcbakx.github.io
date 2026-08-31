// physics.js — the one physics engine for the whole game.
// A faithful port of redshift-search-graphs/RSG.py (Bakx & Dannerbauer 2022,
// MNRAS 515, 678). Graph rendering, sonification and sandbox scoring must all
// read from here; nothing else computes line positions.
//
// Parity with the Python original is enforced by test/test_physics.mjs.
// Where RSG.py contains a no-op quirk we port the *behavior*, not the text,
// and mark it with "RSG.py quirk".

import { CO10, coLadder, ANCILLARY, lineSet } from './lines.js';

export { CO10, coLadder, ANCILLARY, lineSet };

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

// A line emitted at restFreq arrives at restFreq / (1 + z): the whole
// spectrum is compressed by one rigid factor. Everything else follows.
export const observedFreq = (restFreq, z) => restFreq / (1 + z);

// The redshift that would put a line of restFreq at obsFreq.
export const redshiftFor = (restFreq, obsFreq) => restFreq / obsFreq - 1;

// bands: array of [lo, hi] in GHz (may overlap; a line is counted once).
export const inBands = (freq, bands) =>
  bands.some(([lo, hi]) => freq > lo && freq < hi);

// Which lines of `lines` fall inside `bands` at redshift z.
export function visibleLines(z, lines, bands) {
  return lines.filter((l) => inBands(observedFreq(l.freq, z), bands));
}

export const countAtZ = (z, lines, bands) => visibleLines(z, lines, bands).length;

// Counts across a redshift grid — the orange/blue shading of the RSG.
// RSG.py's RSGplot shades using CO + the 8 atomic lines only (SL_vis[:28]),
// i.e. lineSet({includeFaint:false}); pass that in for figure parity.
export function coverageCurve(zArray, lines, bands) {
  return zArray.map((z) => countAtZ(z, lines, bands));
}

// ---------------------------------------------------------------------------
// Candidate redshifts for observed lines (the circles of Fig. 1)
// ---------------------------------------------------------------------------

// For each observed frequency, every line of `lines` offers one candidate
// redshift. `classifyLines` (default: CO + atomic, no faint) sets the
// single/multi count at each candidate, as in RSGplot.
export function candidateRedshifts(obsFreqs, bands, {
  zMin = 0, zMax = 7,
  lines = lineSet({ includeFaint: true }),
  classifyLines = lineSet({ includeFaint: false }),
} = {}) {
  const out = [];
  for (const obs of obsFreqs) {
    for (const line of lines) {
      const z = redshiftFor(line.freq, obs);
      if (z <= zMin || z >= zMax) continue;
      out.push({
        z,
        obsFreq: obs,
        line,
        nLines: countAtZ(z, classifyLines, bands),
      });
    }
  }
  out.sort((a, b) => a.z - b.z);
  return out;
}

// Group candidates from several observed lines by agreeing redshift: the
// "arrows lining up" check of Fig. 1. Two candidates agree if their z differ
// by < zTol. Returns solutions with the number of observed lines they explain.
export function jointSolutions(obsFreqs, bands, opts = {}) {
  const zTol = opts.zTol ?? 0.02;
  const perLine = obsFreqs.map((f) => candidateRedshifts([f], bands, opts));
  const solutions = [];
  for (const cand of perLine[0] ?? []) {
    const members = [cand];
    for (let i = 1; i < perLine.length; i++) {
      const match = perLine[i].find((c) => Math.abs(c.z - cand.z) < zTol);
      if (match) members.push(match);
    }
    if (members.length === obsFreqs.length) {
      solutions.push({
        z: members.reduce((s, m) => s + m.z, 0) / members.length,
        members,
        nLines: cand.nLines,
      });
    }
  }
  return solutions;
}

// ---------------------------------------------------------------------------
// Robustness classification (port of RSGquality's grid logic)
// ---------------------------------------------------------------------------

// Faithful port of RSG.py giveMultiFactors, quirks included: it scans
// divisors up to (not including) max(a,b), keeps the *largest*, and for a
// common divisor m returns min*(m-1)/m - min (which is negative, collapsing
// the neighbour-solution offset — see its use below).
export function giveMultiFactors(a, b) {
  let multiFac = 1;
  for (let i = 2; i < Math.max(a, b); i++) {
    if (a % i === 0 && b % i === 0) multiFac = i;
  }
  if (multiFac === 1) return Math.min(a, b);
  return (Math.min(a, b) * (multiFac - 1)) / multiFac - Math.min(a, b);
}

// Nearest index in a uniform grid starting at 0 with spacing `step`,
// replicating np.argmin(|grid - target|) (first index wins ties).
function nearestIndex(target, step, n) {
  let i = Math.round(target / step);
  if (i < 0) i = 0;
  if (i > n - 1) i = n - 1;
  // argmin tie-breaking: prefer the lower index on exact ties
  const d = (j) => Math.abs(j * step - target);
  if (i > 0 && d(i - 1) <= d(i)) i = i - 1;
  else if (i < n - 1 && d(i + 1) < d(i)) i = i + 1;
  return i;
}

// The line list RSGquality uses: CO ladder + 8 atomic lines, plus the two
// [CI] lines only when the survey is deep enough to trust them.
export function qualityLineSet(nCO = 20, includeCI = false) {
  const lines = coLadder(nCO);
  for (const l of ANCILLARY) {
    if (l.kind === 'atomic') lines.push(l);
    else if (includeCI && l.name.startsWith('[CI]')) lines.push(l);
  }
  return lines;
}

// Classify a uniform redshift grid [0, zMaxLin]:
//   seen[i]    — number of lines in band at z_i
//   seenOne[i] — for 1-line redshifts: >0 robust, 0 degenerate
//   seenTwo[i] — for 2-line redshifts: >0 robust, 0 degenerate
// This is the reusable core of RSG.py's RSGquality; the game's per-candidate
// robustness checks and the sandbox score both read from it.
export function classifyGrid(bands, zMaxLin, {
  includeCI = false,
  nCO = 20,
  linArrSize = 10000,
  sigmaThreshold = 5,
  dzUncertainty = 0.13,
} = {}) {
  const lines = qualityLineSet(nCO, includeCI);
  const n = linArrSize;
  const step = zMaxLin / (n - 1);
  const zLin = Float64Array.from({ length: n }, (_, i) => i * step);
  const seen = new Float64Array(n);
  const seenOne = new Float64Array(n).fill(1);
  const seenTwo = new Float64Array(n).fill(1);

  // Which lines are in band at each z (deduplicated across bands)
  const seenLines = (z) => lines.map((l) => (inBands(observedFreq(l.freq, z), bands) ? 1 : 0));
  for (let i = 0; i < n; i++) {
    seen[i] = seenLines(zLin[i]).reduce((a, b) => a + b, 0);
  }

  for (let i = 0; i < n; i++) {
    const z = zLin[i];

    if (seen[i] === 1) {
      const flags = seenLines(z);
      const Jco = flags.indexOf(1) + 1; // 1-based line index, = J for CO rungs
      if (Jco > nCO) {
        seenOne[i] = 2; // a lone non-CO line is robust: no ladder to slide on
      } else {
        // Mistaking CO(J) for CO(J±k) shifts z by k·dz, dz = (1+z)/J (eq. 1).
        const dz = (1 + z) / Jco;
        for (let l = 0; l < nCO; l++) {
          if (l + 1 === Jco) continue;
          if (Math.abs(((l + 1 - Jco) * dz) / (1 + z)) > sigmaThreshold * dzUncertainty) continue;
          const k = Math.abs(l + 1 - Jco);
          for (const sign of [+1, -1]) {
            // RSG.py quirk: the neighbour is probed at (k+1)·dz, and
            // solutions below z=1 are never allowed to condemn.
            const idx = nearestIndex(z + sign * dz * (k + 1), step, n);
            if (seen[idx] > 1 && seenOne[i] !== 0) continue;
            if (zLin[idx] < 1) continue;
            seenOne[i] = 0; // an unexcludable neighbour exists: degenerate
          }
        }
      }
    }

    if (seen[i] === 2) {
      const flags = seenLines(z);
      const nonCO = flags.slice(nCO).reduce((a, b) => a + b, 0);
      if (nonCO > 0) {
        // CO + non-CO pair: robust (RSG.py quirk: its `== 2` is a no-op,
        // but the value stays 1 which already counts as robust).
      } else {
        const Js = [];
        flags.forEach((f, idx) => { if (f === 1) Js.push(idx + 1); });
        const jOther = giveMultiFactors(Js[0], Js[1]);
        const Jco = Math.min(Js[0], Js[1]);
        const dz = (1 + z) / Jco;
        if (Math.abs((jOther * dz) / (1 + z)) > dzUncertainty * sigmaThreshold) {
          // far enough: robust (RSG.py quirk: no-op comparison, value stays 1)
        } else {
          const k = jOther;
          for (const sign of [+1, -1]) {
            const idx = nearestIndex(z + sign * dz * (k + 1), step, n);
            if (seen[idx] !== 2 && seenTwo[i] !== 0) continue;
            if (zLin[idx] < 1) continue;
            seenTwo[i] = 0; // neighbour also shows exactly two lines: degenerate
          }
        }
      }
    }
  }

  return { zLin, step, seen, seenOne, seenTwo };
}

// Full port of RSG.py RSGquality: score a band setup against a redshift
// sample. Returns fractions of the sample:
//   [noLines, oneLine, twoLines, moreLines, robustSingle, nonRobustDouble]
export function rsgQuality(bands, redshiftArray, opts = {}) {
  return scoreSample(bands, redshiftArray, opts).quality;
}

// One pass over the grid, two views of the answer: RSGquality's six fractions
// (the paper's own score, pinned by the parity test) and the per-galaxy verdict
// the sandbox needs to colour its histogram. Both come from the same
// classification, so the picture can never disagree with the number.
//
//   'silent'    — no line in any window: nothing to work with
//   'ambiguous' — lines seen, but an unexcludable neighbour solution exists
//   'robust'    — the redshift is pinned down
export function scoreSample(bands, redshiftArray, opts = {}) {
  const zMaxLin = 1.5 * Math.max(...redshiftArray);
  const { step, zLin, seen, seenOne, seenTwo } =
    classifyGrid(bands, zMaxLin, opts);
  const n = zLin.length;
  const N = redshiftArray.length;
  let noLines = 0, oneLine = 0, twoLines = 0, moreLines = 0;
  let robustSingle = 0, nonRobustDouble = 0;
  const states = new Array(N);
  redshiftArray.forEach((z, k) => {
    const i = nearestIndex(z, step, n);
    const s = seen[i];
    if (s === 0) { noLines++; states[k] = 'silent'; }
    else if (s === 1) {
      oneLine++;
      if (seenOne[i] > 0) { robustSingle++; states[k] = 'robust'; }
      else states[k] = 'ambiguous';
    } else if (s === 2) {
      twoLines++;
      if (seenTwo[i] === 0) { nonRobustDouble++; states[k] = 'ambiguous'; }
      else states[k] = 'robust';
    } else { moreLines++; states[k] = 'robust'; }
  });
  return {
    quality: [noLines, oneLine, twoLines, moreLines, robustSingle, nonRobustDouble]
      .map((x) => x / N),
    states,
    fractions: {
      robust: states.filter((s) => s === 'robust').length / N,
      ambiguous: states.filter((s) => s === 'ambiguous').length / N,
      silent: noLines / N,
    },
  };
}

// The paper's own figure of merit for a tuning, from tuningOptimization.py:
//   twoLines + moreLines - 0.5*nonRobustDouble + robustSingle
//     + 0.5*(oneLine - robustSingle)
// which is exactly "a pinned-down galaxy counts 1, a galaxy with lines but no
// unique answer counts a half, a silent galaxy counts nothing". Takes the
// six-element vector returned by rsgQuality.
export function figureOfMerit(quality) {
  const [, oneLine, twoLines, moreLines, robustSingle, nonRobustDouble] = quality;
  return twoLines + moreLines - 0.5 * nonRobustDouble + robustSingle
    + 0.5 * (oneLine - robustSingle);
}

// ---------------------------------------------------------------------------
// ALMA tunings (port of RSG.py giveALMA)
// ---------------------------------------------------------------------------

// lowerFreqRatio in [0,1] slides the tuning from the bottom to the top of the
// band. Returns { lsb: [lo, hi], usb: [lo, hi] } — each sideband is split in
// two spectral windows in reality, but RSG.py models the pair as one span.
// Deliberate deviation: RSG.py's band 9 has df = 602-720-15.5 (negative,
// clearly a typo); here band 9 uses the correct 602–720 GHz span.
export function giveALMA(band, lowerFreqRatio) {
  const edges = { 3: [84, 116], 4: [125, 163], 5: [158, 211], 6: [211, 275], 7: [275, 373], 8: [385, 500], 9: [602, 720], 10: [787, 950] };
  if (!(band in edges)) return { lsb: [0, 0], usb: [0, 0] };
  const [f0, f1] = edges[band];
  const df = f1 - f0 - 15.5;
  const lo = f0 + df * lowerFreqRatio;
  return { lsb: [lo, lo + 11.75], usb: [lo + 3.75, lo + 15.5] };
}
