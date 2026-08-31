// lines.js — spectral-line rest frequencies (GHz) and names.
// Values match redshift-search-graphs/RSG.py exactly; that file is the
// source of truth (verified by test/test_physics.mjs).

export const C_MS = 299792458; // speed of light, m/s

export const CO10 = 115.27120180; // CO(1-0) rest frequency, GHz

// Wavelength-defined lines, converted as in RSG.py: f[GHz] = 1e-9 * c / lambda
const ghzFromMicron = (um) => 1e-9 * C_MS / (um * 1e-6);

// Ancillary (non-CO) lines used by the graphical method (RSG.py order).
// kind: 'atomic' lines are trusted for robustness; 'faint' ([CI], H2O) are
// plotted/heard but excluded from RSGquality unless the survey is deep.
export const ANCILLARY = [
  { name: '[OIII]52',  freq: ghzFromMicron(51.81), kind: 'atomic' },
  { name: '[NIII]57',  freq: ghzFromMicron(57.32), kind: 'atomic' },
  { name: '[OI]63',    freq: ghzFromMicron(63.18), kind: 'atomic' },
  { name: '[OIII]88',  freq: ghzFromMicron(88.36), kind: 'atomic' },
  { name: '[NII]122',  freq: ghzFromMicron(121.9), kind: 'atomic' },
  { name: '[OI]145',   freq: ghzFromMicron(145.5), kind: 'atomic' },
  { name: '[CII]158',  freq: ghzFromMicron(157.7), kind: 'atomic' },
  { name: '[NII]205',  freq: ghzFromMicron(205.0), kind: 'atomic' },
  { name: '[CI](2-1)', freq: ghzFromMicron(370.5), kind: 'faint' },
  { name: '[CI](1-0)', freq: ghzFromMicron(609.6), kind: 'faint' },
  { name: 'H2O 2_11',  freq: 752.03314300,         kind: 'faint' },
  { name: 'H2O 2_02',  freq: 987.92675900,         kind: 'faint' },
];

// The CO ladder: rung J has rest frequency J * CO10 (the paper's linear
// approximation — this rigidity is what makes the ladder both a puzzle
// and a harmonic series).
export function coLadder(nRungs = 20) {
  return Array.from({ length: nRungs }, (_, i) => ({
    name: `CO(${i + 1}-${i})`,
    freq: (i + 1) * CO10,
    kind: 'co',
    J: i + 1,
  }));
}

// Full line set in RSG.py's RSGplot order: CO rungs first, then ancillary.
export function lineSet({ nCO = 20, includeFaint = true } = {}) {
  const lines = coLadder(nCO);
  for (const l of ANCILLARY) {
    if (includeFaint || l.kind !== 'faint') lines.push(l);
  }
  return lines;
}
