// audio.js — the sonification engine. Implements SONIFICATION.md; all pitches
// derive from physics.js line positions. No fake sounds: beats between the
// detected tones and the model ladder are physical interference.

import { observedFreq, inBands } from './physics.js';

export const GHZ_TO_HZ = 4; // f_audio = 4 × f_obs(GHz); linear ⇒ chords survive

const RAMP = 0.04;    // s — minimum ramp for any gain/frequency change
const ATTACK = 0.08;  // s — slow onsets: nothing clicks or stabs
const IDLE_MS = 2500; // physics voices duck to silence after this much stillness
const MASTER_LP = 1400; // Hz — hard ceiling; the mosquito band is unreachable

const MUTE_KEY = 'chord.muted';

export class SonificationEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bed = null;    // physics voices live here; ducks when idle
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this.started = false;
    this.detected = new Map(); // obsFreqGHz -> voice
    this.model = new Map();    // line name -> voice
    this.chorusVoices = [];
    this.photz = null;         // { voice, zPhot, sigma }
    this._idleTimer = null;
    this._noise = null;
    this._listeners = new Set();
    // Several chapters are mounted at once but share one engine; the last
    // interactive the player touched owns the voices, and only that one is
    // allowed to silence them when it scrolls away.
    this.owner = null;
  }

  // Must be called from a user gesture (mobile autoplay policy).
  async start() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = MASTER_LP;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(lp).connect(comp).connect(this.ctx.destination);
      this.bed = this.ctx.createGain();
      this.bed.gain.value = 0;
      this.bed.connect(this.master);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.started = true;
    this._emit();
    this.poke();
  }

  // "Don't be a mosquito": sound only while the player acts. Call on every
  // interaction; the bed wakes instantly and ducks to silence after IDLE_MS.
  poke() {
    if (!this.ctx) return;
    clearTimeout(this._idleTimer);
    this.bed.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
    this._idleTimer = setTimeout(() => {
      if (this.ctx) this.bed.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    }, IDLE_MS);
  }

  claim(owner) { this.owner = owner; }

  owns(who) { return this.owner === null || this.owner === who; }

  releaseIfOwner(who) { if (this.owner === who) this.owner = null; }

  get running() { return this.ctx && this.ctx.state === 'running' && !this.muted; }

  // Mute state is global and persistent (SONIFICATION.md §7); subscribers
  // keep the on-screen toggles in sync.
  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit() { for (const fn of this._listeners) fn(this); }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, RAMP);
    }
    this._emit();
  }

  toggleMute() { this.setMuted(!this.muted); }

  // --- voice plumbing ------------------------------------------------------

  _noiseBuffer() {
    if (!this._noise) {
      const n = Math.floor(this.ctx.sampleRate * 2);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
    }
    return this._noise;
  }

  _makeVoice({ freqHz, type, gain, lowpassHz = null, tremoloHz = null, dest = null }) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freqHz;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(gain, t, ATTACK);
    let head = osc;
    let filter = null;
    if (lowpassHz) {
      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpassHz;
      head.connect(filter);
      head = filter;
    }
    let trem = null;
    if (tremoloHz) { // ghost notes: hollow 6 Hz flutter
      trem = this.ctx.createOscillator();
      trem.frequency.value = tremoloHz;
      const depth = this.ctx.createGain();
      depth.gain.value = 0.5;
      trem.connect(depth).connect(g.gain);
      trem.start();
    }
    head.connect(g).connect(dest || this.bed); // bed, not master: idle-ducked
    osc.start();
    return { osc, g, filter, trem, gain, extra: [] };
  }

  _killVoice(v) {
    const t = this.ctx.currentTime;
    v.g.gain.setTargetAtTime(0, t, RAMP);
    const stop = t + 0.3;
    v.osc.stop(stop);
    if (v.trem) v.trem.stop(stop);
    for (const e of v.extra || []) this._killVoice(e);
  }

  // --- the data: detected lines (steady reference tones) -------------------

  setDetectedLines(obsFreqsGHz) {
    if (!this.ctx) return;
    for (const [f, v] of this.detected) {
      if (!obsFreqsGHz.includes(f)) { this._killVoice(v); this.detected.delete(f); }
    }
    for (const f of obsFreqsGHz) {
      if (!this.detected.has(f)) {
        // sine + faint octave: warm but unmistakably "a signal"
        const v = this._makeVoice({ freqHz: f * GHZ_TO_HZ, type: 'sine', gain: 0.15 });
        // the octave rides along inside the voice so it dies with its parent
        v.extra.push(this._makeVoice({ freqHz: 2 * f * GHZ_TO_HZ, type: 'sine', gain: 0.03 }));
        this.detected.set(f, v);
      }
    }
  }

  // --- the model: predicted ladder at the candidate z ----------------------
  // lines: full line set; bands: [[lo,hi],...]; ghosts: Set of line names to
  // voice as ghost notes (predicted but not detected — exclusion mode).
  updateModel(z, lines, bands, { ghosts = new Set(), silent = new Set() } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const inBand = new Map();
    for (const line of lines) {
      if (silent.has(line.name)) continue; // excluded: the door is shut
      const f = observedFreq(line.freq, z);
      if (inBands(f, bands)) inBand.set(line.name, { line, f });
    }
    for (const [name, v] of this.model) {
      if (!inBand.has(name)) { this._killVoice(v); this.model.delete(name); }
    }
    for (const [name, { line, f }] of inBand) {
      const freqHz = f * GHZ_TO_HZ;
      const ghost = ghosts.has(name);
      const existing = this.model.get(name);
      if (existing && existing.isGhost === ghost) {
        existing.osc.frequency.setTargetAtTime(freqHz, t, RAMP / 2);
      } else {
        if (existing) this._killVoice(existing);
        const v = line.kind === 'co'
          ? this._makeVoice({
              // low-passed at ~2.5 harmonics: organ-warm, never buzzy
              freqHz, type: 'sawtooth', gain: ghost ? 0.06 : 0.08,
              lowpassHz: ghost ? 800 : 2.5 * freqHz, tremoloHz: ghost ? 6 : null,
            })
          : this._makeVoice({ freqHz, type: 'triangle', gain: ghost ? 0.05 : 0.07,
              lowpassHz: ghost ? 800 : null, tremoloHz: ghost ? 6 : null });
        v.isGhost = ghost;
        this.model.set(name, v);
      }
    }
  }

  stopModel() {
    if (!this.ctx) return;
    for (const v of this.model.values()) this._killVoice(v);
    this.model.clear();
  }

  // --- the photometric-redshift prior (SONIFICATION.md §2) -----------------
  // A band-filtered hiss whose loudness is the Gaussian prior itself:
  // gain ∝ exp(−Δz²/2σ²), σ = dz(1+z_phot). Warm where the galaxy probably is.
  setPhotZ(zPhot, { dz = 0.13 } = {}) {
    if (!this.ctx) { this._pendingPhotz = { zPhot, dz }; return; }
    this.clearPhotZ();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(g).connect(this.bed);
    src.start();
    this.photz = { src, gain: g, zPhot, sigma: dz * (1 + zPhot) };
  }

  // Call with the cursor redshift: the hiss swells inside the prior.
  updatePhotZ(z) {
    if (!this.photz || !this.ctx) return 0;
    const { sigma, zPhot } = this.photz;
    const w = Math.exp(-((z - zPhot) ** 2) / (2 * sigma * sigma));
    this.photz.gain.gain.setTargetAtTime(0.10 * w, this.ctx.currentTime, 0.08);
    return w;
  }

  clearPhotZ() {
    if (!this.photz || !this.ctx) { this.photz = null; return; }
    const t = this.ctx.currentTime;
    this.photz.gain.gain.setTargetAtTime(0, t, RAMP);
    this.photz.src.stop(t + 0.3);
    this.photz = null;
  }

  // --- UI confirmations (SONIFICATION.md §5) -------------------------------

  // One enveloped note at an observed frequency — the "pluck" of Ch. 2.
  pluck(obsFreqGHz, { kind = 'co', dur = 1.4, gain = 0.13, delay = 0 } = {}) {
    if (!this.running) return;
    const t0 = this.ctx.currentTime + delay;
    const freqHz = obsFreqGHz * GHZ_TO_HZ;
    const osc = this.ctx.createOscillator();
    osc.type = kind === 'co' ? 'sawtooth' : 'triangle';
    osc.frequency.value = freqHz;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(2.8 * freqHz, MASTER_LP), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(freqHz, 120), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.05); // ≥ no click, still a pluck
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Arpeggiate the actual in-band chord at z — physics-derived, just enveloped.
  lockChime(z, lines, bands) {
    if (!this.running) return;
    const freqs = lines
      .map((l) => observedFreq(l.freq, z))
      .filter((f) => inBands(f, bands))
      .sort((a, b) => a - b);
    freqs.forEach((f, i) => {
      const t0 = this.ctx.currentTime + i * 0.12;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f * GHZ_TO_HZ;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);
      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 1.3);
    });
  }

  // The earned one: the full in-band chord, sustained, slow attack. Once per
  // puzzle — SONIFICATION.md §5 says it must feel like something.
  robustChord(z, lines, bands) {
    if (!this.running) return;
    const freqs = lines
      .map((l) => observedFreq(l.freq, z))
      .filter((f) => inBands(f, bands))
      .sort((a, b) => a - b);
    const t0 = this.ctx.currentTime;
    for (const [i, f] of freqs.entries()) {
      for (const [mult, gain] of [[1, 0.11], [2, 0.035]]) {
        const osc = this.ctx.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = f * mult * GHZ_TO_HZ;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + 0.5); // slow swell
        g.gain.setValueAtTime(gain, t0 + 2.0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 3.6);
        osc.connect(g).connect(this.master);
        osc.start(t0);
        osc.stop(t0 + 3.7);
      }
    }
  }

  // A candidate is eliminated: a damped door-shut, not a buzzer.
  exclusionThud() {
    if (!this.running) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t0);
    lp.frequency.exponentialRampToValueAtTime(90, t0 + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.45);
  }

  // --- the population chorus (Ch. 8) ---------------------------------------
  // entries: [{ freqsGHz: [...], state: 'robust'|'ambiguous'|'silent' }]
  // The mix *is* the score: robust galaxies hold a clean chord, ambiguous
  // ones beat against themselves, silent ones are simply not there.
  playChorus(entries, { duration = 2.6 } = {}) {
    if (!this.running) return;
    this.stopChorus();
    const t0 = this.ctx.currentTime;
    const bus = this.ctx.createGain();
    bus.gain.value = 0;
    bus.gain.setTargetAtTime(1, t0, 0.2);
    bus.connect(this.master);
    let voices = 0;
    for (const e of entries) {
      if (e.state === 'silent' || !e.freqsGHz.length) continue;
      for (const f of e.freqsGHz.slice(0, 2)) {
        if (voices >= 16) break; // §7 voice budget
        voices++;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        // ambiguous galaxies are detuned by their own redshift error: a real
        // beat, not a sound effect (the error is what makes them ambiguous).
        const detune = e.state === 'ambiguous' ? 1 + (e.beatHz ?? 5) / (f * GHZ_TO_HZ) : 1;
        osc.frequency.value = f * GHZ_TO_HZ * detune;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1200;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.045, t0 + 0.35);
        g.gain.setValueAtTime(0.045, t0 + duration - 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
        osc.connect(lp).connect(g).connect(bus);
        osc.start(t0);
        osc.stop(t0 + duration + 0.1);
        this.chorusVoices.push({ osc, g, extra: [] });
      }
    }
  }

  stopChorus() {
    if (!this.ctx) return;
    for (const v of this.chorusVoices) {
      try { this._killVoice(v); } catch { /* already stopped */ }
    }
    this.chorusVoices = [];
  }

  // Everything off — used when a chapter unmounts.
  stopAll() {
    if (!this.ctx) return;
    this.stopModel();
    this.stopChorus();
    this.clearPhotZ();
    for (const v of this.detected.values()) this._killVoice(v);
    this.detected.clear();
  }

  // Beat rate (Hz) between a detected tone and the nearest model tone —
  // used by the visual twin (pulsing glow), not to synthesize anything.
  beatRate(obsFreqGHz, z, lines, bands) {
    const fd = obsFreqGHz * GHZ_TO_HZ;
    let best = Infinity;
    for (const line of lines) {
      const f = observedFreq(line.freq, z);
      if (!inBands(f, bands)) continue;
      best = Math.min(best, Math.abs(f * GHZ_TO_HZ - fd));
    }
    return best;
  }
}
