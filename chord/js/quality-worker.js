// quality-worker.js — scoring a tuning costs ~10^5 line-in-band tests, which
// is far too much for a drag handler. The sandbox posts { bands, sample } here
// and gets the paper's own score back. The physics is the same module the rest
// of the game uses; nothing is approximated for speed.

import { scoreSample, figureOfMerit } from './physics.js';
import { SAMPLES, smoothSample } from './data/samples.js';

const cache = new Map();
function sampleFor(key) {
  if (!cache.has(key)) cache.set(key, smoothSample(SAMPLES[key].z));
  return cache.get(key);
}

self.onmessage = ({ data }) => {
  const { id, bands, sample = 'herbs', bins = 28, zMax = 7 } = data;
  const zs = sampleFor(sample);
  const { quality, states, fractions } = scoreSample(bands, zs);
  // Where does the tuning fail? Same verdicts, binned in redshift, so the
  // histogram under the graph is the score spatially resolved.
  const hist = Array.from({ length: bins }, () => ({ robust: 0, ambiguous: 0, silent: 0 }));
  zs.forEach((z, i) => {
    const b = Math.floor((z / zMax) * bins);
    if (b >= 0 && b < bins) hist[b][states[i]]++;
  });
  self.postMessage({ id, quality, fractions, hist, score: figureOfMerit(quality), n: zs.length });
};
