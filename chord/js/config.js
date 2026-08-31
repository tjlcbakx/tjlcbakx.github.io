// config.js — the build contract for each chapter's interactive, in one place.
// Every frequency here is a real number from Bakx & Dannerbauer (2022): the
// tuning is the paper's optimum (Table 1), and the detections are the worked
// examples of its Figs. 1, 3 and 4. Nothing is invented for effect.

// The paper's optimised ALMA band 3 + band 4 tuning.
export const BANDS = [[89.1, 112.0], [139.9, 162.7]];

// Fig. 1's galaxy: CO(3-2) + CO(5-4) → z = 2.700, with an impostor at 6.400.
const FIG1 = [93.463, 155.772];
// Fig. 3's galaxy: one bright line, a photometric redshift near 3.
const FIG3 = [144.089];
// Fig. 4's galaxy: the honest failure — 1.150 and 3.300 fit equally well.
const FIG4 = [107.229, 160.844];

export const CONFIGS = {
  ch4: {
    bands: BANDS, detected: [FIG1[1]], mode: 'count', startZ: 0.25, goalCount: 4,
  },
  ch5: {
    bands: BANDS, detected: FIG1, mode: 'joint', startZ: 0.4, showSolutions: true,
  },
  ch6: {
    bands: BANDS, detected: FIG4, mode: 'ab', startZ: 0.4, ab: [1.150, 3.300],
    // the same two frequencies also fit at 5.45 (rungs 6 and 9) — but that one
    // predicts CO(5-4) at 89.358 and CO(8-7) at 142.972 GHz, and neither was
    // detected, so it is the one candidate here the data can actually refute
    third: { z: 5.450 },
    showSolutions: true,
  },
  ch7a: {
    bands: BANDS, detected: FIG1, mode: 'exclude', startZ: 6.4, showSolutions: true,
  },
  ch7b: {
    bands: BANDS, detected: FIG3, mode: 'exclude', startZ: 0.6,
    photz: { z: 3.0, dz: 0.13 }, goalExclude: 2, requireZ: 3.0,
  },
  ch8a: {
    bands: BANDS, detected: FIG1, mode: 'case', startZ: 2.0,
    prompt: 'Two lines: 93.463 and 155.772 GHz. No photometric redshift. Your call.',
    answers: [
      { label: 'z = 2.70', z: 2.700, correct: true,
        response: 'Right. Both lines lock, and at the impostor redshift 6.40 the model '
          + 'demands lines at 109.04 and 140.195 GHz that nobody detected. Silence '
          + 'is what decides it.' },
      { label: 'z = 6.40', z: 6.400, correct: false,
        response: 'It fits the two lines you have — but drag to 6.40 and look: this '
          + 'redshift also predicts CO(7-6) at 109.04 and CO(9-8) at 140.195 GHz, '
          + 'both inside your windows, both silent. Try the ghosts.' },
      { label: 'not enough information — ask for more time', z: null, correct: false,
        response: 'Too cautious. You already hold the evidence: two lines that agree, '
          + 'and two predicted lines that never showed up. Go and use the silence.' },
    ],
  },
  ch8b: {
    bands: BANDS, detected: FIG3, mode: 'case', startZ: 1.0,
    photz: { z: 3.0, dz: 0.13 },
    prompt: 'One line: 144.089 GHz. Photometric redshift: 3.0, give or take 0.5. Your call.',
    answers: [
      { label: 'z = 3.00', z: 3.000, correct: true,
        response: 'Right — CO(5-4), and it is the one identification that both sits '
          + 'inside the photometric prior and predicts no second line you failed to '
          + 'see. Every neighbouring rung would have put another line in your windows.' },
      { label: 'z = 2.20', z: 2.200, correct: false,
        response: 'CO(4-3) would fit the line, yes — but z = 2.20 also puts CO(3-2) at '
          + '108.07 GHz, right in your lower window. Nothing is there. Dead.' },
      { label: 'z = 0.60', z: 0.600, correct: false,
        response: 'CO(2-1) fits the frequency, and nothing else would be in band — but '
          + 'the photometric redshift says 3.0 ± 0.5. z = 0.60 is nearly five sigma '
          + 'away. You would be betting against the photometry to win nothing.' },
      { label: 'not enough information — ask for more time', z: null, correct: false,
        response: 'You can do better than that here: the silence rules out every '
          + 'neighbouring rung, and the photometry rules out the far ones.' },
    ],
  },
  ch8c: {
    bands: BANDS, detected: FIG4, mode: 'case', startZ: 1.0,
    photz: { z: 2.3, dz: 0.13 },
    prompt: 'Two lines: 107.229 and 160.844 GHz. Photometric redshift: 2.3 ± 0.4. Your call.',
    answers: [
      { label: 'z = 1.15', z: 1.150, correct: false,
        response: 'It fits perfectly — CO(2-1) and CO(3-2), no leftover lines, well '
          + 'inside the photometric prior. And so does z = 3.30, exactly as well. '
          + 'Picking one is a coin flip with a citation on it.' },
      { label: 'z = 3.30', z: 3.300, correct: false,
        response: 'It fits perfectly — CO(4-3) and CO(6-5), no leftover lines, well '
          + 'inside the photometric prior. And so does z = 1.15, exactly as well. '
          + 'Picking one is a coin flip with a citation on it.' },
      { label: 'z = 5.45', z: 5.450, correct: false,
        response: 'Good catch — 5.45 does fit both lines (CO(6-5) and CO(9-8)). But it '
          + 'also demands CO(8-7) at 143.0 GHz, inside your upper window, and that one '
          + 'is silent. This is the one candidate the data really does kill.' },
      { label: 'request more telescope time', z: null, correct: true,
        response: 'Correct — and this is the hardest answer to give. 1.15 and 3.30 are '
          + 'both exact, both allowed by the photometry, and nothing in this dataset '
          + 'separates them: 2, 3 and 4, 6 are the same ladder multiplied by two. '
          + 'The right move is another observation, not a braver guess.' },
    ],
  },
  ch9: {},
};
