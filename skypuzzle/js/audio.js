/* audio.js — all sound is synthesised; the game loads no audio files.
 *
 * click()    ~40 ms: 1.8 kHz sine, exponential decay (tau ~ 12 ms), plus a
 *            short band-passed noise burst. Played when a piece snaps home.
 * thunk()    dull low knock: a drop that landed near the *wrong* source.
 * fanfare()  three rising tones + an octave, on completing the board.
 *
 * One AudioContext, created lazily on the first user gesture (browsers
 * refuse to start one before that).
 */

import { CFG } from './config.js';

let ctx = null;
let enabled = true;

export function isEnabled() { return enabled; }

export function setEnabled(v) {
  enabled = !!v;
  if (enabled) unlock();
}

/** Create/resume the AudioContext. Safe to call on every user gesture. */
export function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function ready() {
  if (!enabled) return null;
  const c = unlock();
  return c && c.state === 'running' ? c : c;   // still queue while resuming
}

function noiseBuffer(c, seconds) {
  const n = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Snap: the piece clicks into its true sky position. */
export function click() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const g = CFG.clickGain;

  const osc = c.createOscillator();
  const og = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.04);
  og.gain.setValueAtTime(g, t);
  og.gain.exponentialRampToValueAtTime(1e-4, t + 0.048);   // tau ~ 12 ms
  osc.connect(og).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.06);

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.03);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  bp.Q.value = 1.2;
  const ng = c.createGain();
  ng.gain.setValueAtTime(g * 0.55, t);
  ng.gain.exponentialRampToValueAtTime(1e-4, t + 0.03);
  src.connect(bp).connect(ng).connect(c.destination);
  src.start(t);
  src.stop(t + 0.04);
}

/** Near miss: something belongs here, but not this piece. */
export function thunk() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
  g.gain.setValueAtTime(CFG.clickGain * 0.6, t);
  g.gain.exponentialRampToValueAtTime(1e-4, t + 0.14);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.16);
}

/** All pieces placed. */
export function fanfare() {
  const c = ready();
  if (!c) return;
  const t0 = c.currentTime + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const t = t0 + i * 0.16;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(CFG.clickGain * 0.8, t + 0.02);
    g.gain.exponentialRampToValueAtTime(1e-4, t + (i === 3 ? 0.9 : 0.30));
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + (i === 3 ? 1.0 : 0.35));
  });
}
